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
import { getCraftCategory } from './dal/craft-category.ts';
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

const RECHARGE_PLATFORMS: readonly RechargePlatform[] = new Set([
  '微信',
  '支付宝',
  '现金',
]);

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
      .transaction(() => {
        requireCustomer(database, input.customerId);
        if (!getCraftCategory(database, input.categoryId)) {
          throw new BusinessError(
            'CATEGORY_NOT_FOUND',
            `手工品类不存在（ID: ${input.categoryId}）`,
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
      })
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
