import type BetterSqlite3 from 'better-sqlite3';

import type { ConsumptionRecord } from './dal/consumption-record.ts';
import type { CustomerAccount } from './dal/customer-account.ts';
import type { TableSession } from './dal/table-session.ts';

import { CATEGORY_STATUS_ON, getCraftCategory } from './dal/craft-category.ts';
import { getCustomer } from './dal/customer.ts';
import {
  assertNonNegativeInteger,
  assertPositiveInteger,
  BusinessError,
  getUtcTimestamp,
  isForeignKeyError,
} from './dal/shared.ts';
import { getStoreTable } from './dal/store-table.ts';
import {
  closeTableSessionRow,
  extendTableSessionRow,
  getActiveTableSession,
  getTableSession,
  insertTableSession,
  TABLE_SESSION_ACTIVE,
  TIMING_MODE_ELAPSED,
  TIMING_MODE_PURCHASED,
  updateTableSessionDurationRow,
} from './dal/table-session.ts';
import { performSettlementConsumption } from './transactions.ts';

/** 开台参数：桌位为座位级，每位顾客独立开台与计时。 */
export interface OpenTableSessionInput {
  categoryId: number;
  customerId: number;
  /** 购买时长（分钟）；实际计时模式可省略或传 0。 */
  durationMinutes?: number;
  /** 预估应付金额，开台时不扣款，结账时作为购买时长模式的应付上限。 */
  estimatedAmountCents: number;
  tableId: number;
  /** 计时方式：1=按购买时长倒计时（默认）、2=实际计时。 */
  timingMode?: number;
}

export interface ExtendTableSessionInput {
  durationMinutes: number;
  /** 本次续时追加的预估应付金额，续时节不扣款。 */
  estimatedAmountCents: number;
}

/** 结账参数：实收金额允许低于应付金额（折扣/免单），但不得超过应付金额。 */
export interface SettleTableSessionInput {
  amountCents: number;
}

export interface TableSessionSettlementResult {
  account: CustomerAccount;
  consumptionRecord: ConsumptionRecord;
  session: TableSession;
}

function parseUtcTimestamp(value: string): number {
  const parsed = new Date(`${value.replace(' ', 'T')}Z`).getTime();
  if (Number.isNaN(parsed)) {
    throw new BusinessError('INVALID_INPUT', `时间格式非法：${value}`);
  }
  return parsed;
}

/** UTC 文本时间加分钟，返回同样格式的 UTC 文本。 */
export function addMinutesToUtcTimestamp(
  baseTimestamp: string,
  minutes: number,
): string {
  const nextMs = parseUtcTimestamp(baseTimestamp) + minutes * 60_000;
  return new Date(nextMs).toISOString().slice(0, 19).replace('T', ' ');
}

function mapReferenceError(
  database: BetterSqlite3.Database,
  customerId: number,
  categoryId: number,
): never {
  if (!getCustomer(database, customerId)) {
    throw new BusinessError(
      'CUSTOMER_NOT_FOUND',
      `客户不存在（ID: ${customerId}）`,
    );
  }
  if (!getCraftCategory(database, categoryId)) {
    throw new BusinessError(
      'CATEGORY_NOT_FOUND',
      `手工品类不存在（ID: ${categoryId}）`,
    );
  }
  throw new BusinessError(
    'INVALID_REFERENCE',
    '开台会话关联的客户或手工品类不存在',
  );
}

/**
 * 开台：仅写入会话并开始计时，不写消费流水、不扣减余额。
 * 支持按购买时长倒计时与实际计时两种模式；同一座位已有进行中会话时返回 `TABLE_OCCUPIED`。
 */
export function openTableSession(
  database: BetterSqlite3.Database,
  input: OpenTableSessionInput,
): TableSession {
  assertPositiveInteger(input.tableId, '桌位 ID');
  assertPositiveInteger(input.customerId, '客户 ID');
  assertPositiveInteger(input.categoryId, '手工品类 ID');
  assertNonNegativeInteger(input.estimatedAmountCents, '预估消费金额（分）');

  const timingMode = input.timingMode ?? TIMING_MODE_PURCHASED;
  if (
    timingMode !== TIMING_MODE_PURCHASED &&
    timingMode !== TIMING_MODE_ELAPSED
  ) {
    throw new BusinessError(
      'INVALID_INPUT',
      '计时方式只能是 1（按购买时长）或 2（实际计时）',
    );
  }
  const purchased = timingMode === TIMING_MODE_PURCHASED;
  const durationMinutes = input.durationMinutes ?? 0;
  assertNonNegativeInteger(durationMinutes, '购买时长（分钟）');
  if (purchased) {
    assertPositiveInteger(durationMinutes, '购买时长（分钟）');
  } else if (durationMinutes !== 0) {
    throw new BusinessError('INVALID_INPUT', '实际计时模式不需要填写购买时长');
  }

  try {
    return database
      .transaction(() => {
        if (!getStoreTable(database, input.tableId)) {
          throw new BusinessError(
            'TABLE_NOT_FOUND',
            `桌位不存在（ID: ${input.tableId}）`,
          );
        }
        if (getActiveTableSession(database, input.tableId)) {
          throw new BusinessError(
            'TABLE_OCCUPIED',
            '该座位已有进行中的消费，请先结束后再开台',
          );
        }
        if (!getCustomer(database, input.customerId)) {
          throw new BusinessError(
            'CUSTOMER_NOT_FOUND',
            `客户不存在（ID: ${input.customerId}）`,
          );
        }
        const category = getCraftCategory(database, input.categoryId);
        if (!category) {
          throw new BusinessError(
            'CATEGORY_NOT_FOUND',
            `手工品类不存在（ID: ${input.categoryId}）`,
          );
        }
        if (category.status !== CATEGORY_STATUS_ON) {
          throw new BusinessError(
            'CATEGORY_OFF_SHELF',
            `手工品类已下架，不能用于开台（ID: ${input.categoryId}）`,
          );
        }
        const startTime = getUtcTimestamp();
        return insertTableSession(database, {
          categoryId: input.categoryId,
          customerId: input.customerId,
          // 实际计时模式不设结束时间，库内两列仅作约束占位，映射层不向业务暴露
          plannedDurationMinutes: purchased ? durationMinutes : 1,
          plannedEndTime: purchased
            ? addMinutesToUtcTimestamp(startTime, durationMinutes)
            : startTime,
          startTime,
          tableId: input.tableId,
          timingMode,
          totalAmountCents: input.estimatedAmountCents,
          totalDurationMinutes: purchased ? durationMinutes : 0,
        });
      })
      .immediate();
  } catch (error) {
    if (isForeignKeyError(error)) {
      mapReferenceError(database, input.customerId, input.categoryId);
    }
    throw error;
  }
}

/**
 * 续时：从「计划结束时间与当前时间中较晚者」继续累加时长与预估金额，不写流水、不扣款。
 * 实际计时模式按实际用时结算，不支持续时。
 */
export function extendTableSession(
  database: BetterSqlite3.Database,
  sessionId: number,
  input: ExtendTableSessionInput,
): TableSession {
  assertPositiveInteger(sessionId, '会话 ID');
  assertPositiveInteger(input.durationMinutes, '续时时长（分钟）');
  assertNonNegativeInteger(input.estimatedAmountCents, '续时预估金额（分）');

  return database
    .transaction(() => {
      const session = getTableSession(database, sessionId);
      if (!session) {
        throw new BusinessError(
          'SESSION_NOT_FOUND',
          `开台会话不存在（ID: ${sessionId}）`,
        );
      }
      if (session.status !== TABLE_SESSION_ACTIVE) {
        throw new BusinessError(
          'SESSION_ALREADY_CLOSED',
          '该开台会话已结束，不能续时',
        );
      }
      if (session.timingMode === TIMING_MODE_ELAPSED) {
        throw new BusinessError(
          'INVALID_INPUT',
          '实际计时模式按实际用时结算，无需续时',
        );
      }
      const now = getUtcTimestamp();
      const plannedEndTime = session.plannedEndTime ?? now;
      const baseTime = plannedEndTime > now ? plannedEndTime : now;
      extendTableSessionRow(
        database,
        sessionId,
        {
          plannedDurationMinutes:
            session.plannedDurationMinutes + input.durationMinutes,
          plannedEndTime: addMinutesToUtcTimestamp(
            baseTime,
            input.durationMinutes,
          ),
          totalAmountCents:
            session.totalAmountCents + input.estimatedAmountCents,
          totalDurationMinutes:
            session.totalDurationMinutes + input.durationMinutes,
        },
        now,
      );
      const updated = getTableSession(database, sessionId);
      if (!updated) {
        throw new Error('续时后会话读取失败');
      }
      return updated;
    })
    .immediate();
}

/**
 * 结账并关台：按实收金额写入一条消费流水、扣减余额，随后结束会话释放座位。
 *
 * - 购买时长模式：实收金额不得超过开台与续时累计的应付金额，消费时长取累计购买时长。
 * - 实际计时模式：消费时长按开台至结账的实际用时（不足 1 分钟按 1 分钟）计算，
 *   实收金额由门店按实际用时确定，不受开台预估金额限制。
 *
 * 任一步骤失败整体回滚，余额不足时会话保持使用中。
 */
export function settleTableSession(
  database: BetterSqlite3.Database,
  sessionId: number,
  input: SettleTableSessionInput,
): TableSessionSettlementResult {
  assertPositiveInteger(sessionId, '会话 ID');
  assertNonNegativeInteger(input.amountCents, '结账金额（分）');

  try {
    return database
      .transaction(() => {
        const session = getTableSession(database, sessionId);
        if (!session) {
          throw new BusinessError(
            'SESSION_NOT_FOUND',
            `开台会话不存在（ID: ${sessionId}）`,
          );
        }
        if (session.status !== TABLE_SESSION_ACTIVE) {
          throw new BusinessError(
            'SESSION_ALREADY_CLOSED',
            '该开台会话已结束，不能结账',
          );
        }
        const elapsed = session.timingMode === TIMING_MODE_ELAPSED;
        if (!elapsed && input.amountCents > session.totalAmountCents) {
          throw new BusinessError(
            'INVALID_INPUT',
            `结账金额不能超过应付金额 ${session.totalAmountCents} 分`,
          );
        }
        const now = getUtcTimestamp();
        // 实际计时模式向上取整到分钟，至少计 1 分钟
        const durationMinutes = elapsed
          ? Math.max(
              1,
              Math.ceil(
                (parseUtcTimestamp(now) -
                  parseUtcTimestamp(session.startTime)) /
                  60_000,
              ),
            )
          : session.totalDurationMinutes;
        if (elapsed) {
          updateTableSessionDurationRow(
            database,
            sessionId,
            durationMinutes,
            now,
          );
        }
        const table = getStoreTable(database, session.tableId);
        const { account, consumptionRecord } = performSettlementConsumption(
          database,
          {
            categoryId: session.categoryId,
            consumptionAmountCents: input.amountCents,
            customerId: session.customerId,
            durationMinutes,
            sessionId,
            tableNumber: table?.seatNo ?? null,
          },
        );
        closeTableSessionRow(database, sessionId, now);
        const updated = getTableSession(database, sessionId);
        if (!updated) {
          throw new Error('结账后会话读取失败');
        }
        return { account, consumptionRecord, session: updated };
      })
      .immediate();
  } catch (error) {
    if (isForeignKeyError(error)) {
      const session = getTableSession(database, sessionId);
      mapReferenceError(
        database,
        session?.customerId ?? 0,
        session?.categoryId ?? 0,
      );
    }
    throw error;
  }
}

/**
 * 关台（免结账）：结束会话并释放座位，不生成消费流水、不扣减余额。
 */
export function closeTableSession(
  database: BetterSqlite3.Database,
  sessionId: number,
): TableSession {
  assertPositiveInteger(sessionId, '会话 ID');
  return database
    .transaction(() => {
      const session = getTableSession(database, sessionId);
      if (!session) {
        throw new BusinessError(
          'SESSION_NOT_FOUND',
          `开台会话不存在（ID: ${sessionId}）`,
        );
      }
      if (session.status !== TABLE_SESSION_ACTIVE) {
        throw new BusinessError(
          'SESSION_ALREADY_CLOSED',
          '该开台会话已结束，不能重复结束',
        );
      }
      closeTableSessionRow(database, sessionId, getUtcTimestamp());
      const updated = getTableSession(database, sessionId);
      if (!updated) {
        throw new Error('结束会话后读取失败');
      }
      return updated;
    })
    .immediate();
}
