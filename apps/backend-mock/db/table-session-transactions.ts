import type BetterSqlite3 from 'better-sqlite3';

import type { ConsumptionRecord } from './dal/consumption-record.ts';
import type { CustomerAccount } from './dal/customer-account.ts';
import type { TableSession } from './dal/table-session.ts';

import { getCraftCategory } from './dal/craft-category.ts';
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
} from './dal/table-session.ts';
import { performConsumption } from './transactions.ts';

/** 开台参数：桌位为座位级，每位顾客独立开台与计时。 */
export interface OpenTableSessionInput {
  categoryId: number;
  consumptionAmountCents: number;
  customerId: number;
  durationMinutes: number;
  tableId: number;
}

export interface ExtendTableSessionInput {
  consumptionAmountCents: number;
  durationMinutes: number;
}

export interface TableSessionTransactionResult {
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
 * 开台：写入会话 + 消费流水 + 扣减余额，三者同一 IMMEDIATE 事务提交。
 * 同一座位已有进行中会话时返回 `TABLE_OCCUPIED`。
 */
export function openTableSession(
  database: BetterSqlite3.Database,
  input: OpenTableSessionInput,
): TableSessionTransactionResult {
  assertPositiveInteger(input.tableId, '桌位 ID');
  assertPositiveInteger(input.customerId, '客户 ID');
  assertPositiveInteger(input.categoryId, '手工品类 ID');
  assertPositiveInteger(input.durationMinutes, '购买时长（分钟）');
  assertNonNegativeInteger(input.consumptionAmountCents, '消费金额（分）');

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
        const startTime = getUtcTimestamp();
        const session = insertTableSession(database, {
          categoryId: input.categoryId,
          customerId: input.customerId,
          plannedDurationMinutes: input.durationMinutes,
          plannedEndTime: addMinutesToUtcTimestamp(
            startTime,
            input.durationMinutes,
          ),
          startTime,
          tableId: input.tableId,
          totalAmountCents: input.consumptionAmountCents,
          totalDurationMinutes: input.durationMinutes,
        });
        const { account, consumptionRecord } = performConsumption(database, {
          categoryId: input.categoryId,
          consumptionAmountCents: input.consumptionAmountCents,
          customerId: input.customerId,
          durationMinutes: input.durationMinutes,
          sessionId: session.sessionId,
        });
        return { account, consumptionRecord, session };
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
 * 续时：从「计划结束时间与当前时间中较晚者」继续累加，写流水并扣余额。
 */
export function extendTableSession(
  database: BetterSqlite3.Database,
  sessionId: number,
  input: ExtendTableSessionInput,
): TableSessionTransactionResult {
  assertPositiveInteger(sessionId, '会话 ID');
  assertPositiveInteger(input.durationMinutes, '续时时长（分钟）');
  assertNonNegativeInteger(input.consumptionAmountCents, '续时金额（分）');

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
            '该开台会话已结束，不能续时',
          );
        }
        const now = getUtcTimestamp();
        const baseTime =
          session.plannedEndTime > now ? session.plannedEndTime : now;
        const { account, consumptionRecord } = performConsumption(database, {
          categoryId: session.categoryId,
          consumptionAmountCents: input.consumptionAmountCents,
          customerId: session.customerId,
          durationMinutes: input.durationMinutes,
          sessionId,
        });
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
              session.totalAmountCents + input.consumptionAmountCents,
            totalDurationMinutes:
              session.totalDurationMinutes + input.durationMinutes,
          },
          now,
        );
        const updated = getTableSession(database, sessionId);
        if (!updated) {
          throw new Error('续时后会话读取失败');
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
 * 结束会话并释放座位：只更新会话状态，已产生的消费流水不再改动。
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
