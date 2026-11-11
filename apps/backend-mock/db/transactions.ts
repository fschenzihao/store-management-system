import type BetterSqlite3 from 'better-sqlite3';

import type {
  ConsumptionRecord,
  CreateConsumptionInput,
} from './dal/consumption-record.ts';
import type { CustomerAccount } from './dal/customer-account.ts';
import type {
  CreateRechargeInput,
  RechargePlatform,
  RechargeRecord,
} from './dal/recharge-record.ts';

import { insertConsumptionRecord } from './dal/consumption-record.ts';
import { CATEGORY_STATUS_ON, getCraftCategory } from './dal/craft-category.ts';
import { getCustomerAccount } from './dal/customer-account.ts';
import { getCustomer } from './dal/customer.ts';
import { insertRechargeRecord } from './dal/recharge-record.ts';
import {
  assertNonNegativeInteger,
  assertPositiveInteger,
  BusinessError,
  getUtcTimestamp,
  isForeignKeyError,
} from './dal/shared.ts';

export interface RechargeTransactionResult {
  account: CustomerAccount;
  rechargeRecord: RechargeRecord;
}

export interface ConsumptionTransactionResult {
  account: CustomerAccount;
  consumptionRecord: ConsumptionRecord;
}

const RECHARGE_PLATFORMS: ReadonlySet<RechargePlatform> =
  new Set<RechargePlatform>(['微信', '支付宝', '现金']);

function validateRechargeInput(input: CreateRechargeInput): void {
  assertPositiveInteger(input.customerId, '客户 ID');
  assertPositiveInteger(input.amountCents, '充值金额（分）');
  if (!RECHARGE_PLATFORMS.has(input.platform)) {
    throw new BusinessError(
      'INVALID_INPUT',
      '充值平台仅允许微信、支付宝或现金',
    );
  }
}

function validateConsumptionInput(input: CreateConsumptionInput): void {
  assertPositiveInteger(input.customerId, '客户 ID');
  assertPositiveInteger(input.categoryId, '手工品类 ID');
  assertNonNegativeInteger(input.durationMinutes, '消费时长（分钟）');
  assertNonNegativeInteger(input.consumptionAmountCents, '消费金额（分）');
  // 桌号为可选字段：null/undefined 表示未指定，提供时必须为正整数
  if (input.tableNumber !== undefined && input.tableNumber !== null) {
    assertPositiveInteger(input.tableNumber, '桌号');
  }
  // 是否全天为可选字段：null/undefined 表示未指定，提供时只能是 0 或 1
  if (
    input.isFullDay !== undefined &&
    input.isFullDay !== null &&
    input.isFullDay !== 0 &&
    input.isFullDay !== 1
  ) {
    throw new BusinessError('INVALID_INPUT', '是否全天只能是 0 或 1');
  }
}

function requireCustomer(
  database: BetterSqlite3.Database,
  customerId: number,
): void {
  if (!getCustomer(database, customerId)) {
    throw new BusinessError(
      'CUSTOMER_NOT_FOUND',
      `客户不存在（ID: ${customerId}）`,
    );
  }
}

function requireAccount(
  database: BetterSqlite3.Database,
  customerId: number,
): CustomerAccount {
  const account = getCustomerAccount(database, customerId);
  if (!account) {
    throw new BusinessError(
      'CUSTOMER_ACCOUNT_NOT_FOUND',
      `客户账户不存在（客户 ID: ${customerId}）`,
    );
  }
  assertNonNegativeInteger(account.balanceCents, '账户余额（分）');
  return account;
}

function updateAccountBalance(
  database: BetterSqlite3.Database,
  customerId: number,
  currentBalanceCents: number,
  nextBalanceCents: number,
): CustomerAccount {
  const result = database
    .prepare(
      `UPDATE customer_account SET balance_cents = ?
       WHERE customer_id = ? AND balance_cents = ?`,
    )
    .run(nextBalanceCents, customerId, currentBalanceCents);
  if (result.changes !== 1) {
    throw new BusinessError('BALANCE_CHANGED', '客户账户余额已变化，请重试');
  }
  return requireAccount(database, customerId);
}

/**
 * 充值流水与余额增加在同一 IMMEDIATE 事务中提交，任一步骤失败整体回滚。
 */
export function createRecharge(
  database: BetterSqlite3.Database,
  input: CreateRechargeInput,
): RechargeTransactionResult {
  validateRechargeInput(input);
  try {
    return database
      .transaction(() => {
        requireCustomer(database, input.customerId);
        const account = requireAccount(database, input.customerId);
        const nextBalanceCents = account.balanceCents + input.amountCents;
        if (!Number.isSafeInteger(nextBalanceCents)) {
          throw new BusinessError(
            'BALANCE_OVERFLOW',
            '充值后余额超出安全整数范围',
          );
        }
        const rechargeRecord = insertRechargeRecord(database, {
          ...input,
          rechargeTime: getUtcTimestamp(),
        });
        const updatedAccount = updateAccountBalance(
          database,
          input.customerId,
          account.balanceCents,
          nextBalanceCents,
        );
        return { account: updatedAccount, rechargeRecord };
      })
      .immediate();
  } catch (error) {
    if (isForeignKeyError(error)) {
      throw new BusinessError(
        'CUSTOMER_NOT_FOUND',
        `客户不存在（ID: ${input.customerId}）`,
      );
    }
    throw error;
  }
}

/**
 * 消费流水与余额扣减在同一 IMMEDIATE 事务中提交，余额不足时不写入流水。
 */
export function createConsumption(
  database: BetterSqlite3.Database,
  input: CreateConsumptionInput,
): ConsumptionTransactionResult {
  validateConsumptionInput(input);
  try {
    return database
      .transaction(() => performConsumption(database, input))
      .immediate();
  } catch (error) {
    if (isForeignKeyError(error)) {
      if (!getCustomer(database, input.customerId)) {
        throw new BusinessError(
          'CUSTOMER_NOT_FOUND',
          `客户不存在（ID: ${input.customerId}）`,
        );
      }
      if (!getCraftCategory(database, input.categoryId)) {
        throw new BusinessError(
          'CATEGORY_NOT_FOUND',
          `手工品类不存在（ID: ${input.categoryId}）`,
        );
      }
      throw new BusinessError(
        'INVALID_REFERENCE',
        '消费记录关联的客户或手工品类不存在',
      );
    }
    throw error;
  }
}

interface PerformConsumptionOptions {
  /**
   * 结账场景专用：品类可能在会话进行中被下架，已发生消费的结账不应被上架状态拦截。
   * 普通消费入口必须保持严格校验。
   */
  skipCategoryStatusCheck?: boolean;
}

/**
 * 校验客户、品类与余额，写入消费流水并扣减余额。
 *
 * 仅供已经开启事务的业务流程（普通消费、开台会话结账）调用，调用方负责事务边界。
 */
function performConsumptionInternal(
  database: BetterSqlite3.Database,
  input: CreateConsumptionInput,
  options: PerformConsumptionOptions = {},
): ConsumptionTransactionResult {
  requireCustomer(database, input.customerId);
  const category = getCraftCategory(database, input.categoryId);
  if (!category) {
    throw new BusinessError(
      'CATEGORY_NOT_FOUND',
      `手工品类不存在（ID: ${input.categoryId}）`,
    );
  }
  // 下架品类不可用于新增消费，历史消费记录不受影响
  if (
    !options.skipCategoryStatusCheck &&
    category.status !== CATEGORY_STATUS_ON
  ) {
    throw new BusinessError(
      'CATEGORY_OFF_SHELF',
      `手工品类已下架，不能用于新增消费（ID: ${input.categoryId}）`,
    );
  }
  const account = requireAccount(database, input.customerId);
  if (account.balanceCents < input.consumptionAmountCents) {
    throw new BusinessError(
      'INSUFFICIENT_BALANCE',
      `余额不足：当前 ${account.balanceCents} 分，需要 ${input.consumptionAmountCents} 分`,
    );
  }
  const consumptionRecord = insertConsumptionRecord(database, input);
  const updatedAccount = updateAccountBalance(
    database,
    input.customerId,
    account.balanceCents,
    account.balanceCents - input.consumptionAmountCents,
  );
  return { account: updatedAccount, consumptionRecord };
}

/** 普通消费：品类必须处于上架状态。 */
export function performConsumption(
  database: BetterSqlite3.Database,
  input: CreateConsumptionInput,
): ConsumptionTransactionResult {
  return performConsumptionInternal(database, input);
}

/** 开台会话结账：跳过品类上架校验，其余校验与普通消费一致。 */
export function performSettlementConsumption(
  database: BetterSqlite3.Database,
  input: CreateConsumptionInput,
): ConsumptionTransactionResult {
  return performConsumptionInternal(database, input, {
    skipCategoryStatusCheck: true,
  });
}
