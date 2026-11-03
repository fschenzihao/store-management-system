// @vitest-environment node

import type BetterSqlite3 from 'better-sqlite3';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  listConsumptionRecordsByCategory,
  listConsumptionRecordsByCustomer,
} from '../db/dal/consumption-record.ts';
import {
  createCraftCategory,
  deleteCraftCategory,
} from '../db/dal/craft-category.ts';
import { getCustomerAccount } from '../db/dal/customer-account.ts';
import { createCustomer } from '../db/dal/customer.ts';
import { listRechargeRecordsByCustomer } from '../db/dal/recharge-record.ts';
import { BusinessError } from '../db/dal/shared.ts';
import { createConsumption, createRecharge } from '../db/transactions.ts';
import { createTestDatabase } from './helpers/database.ts';

const UTC_TIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

function captureError(operation: () => unknown): unknown {
  try {
    operation();
  } catch (error) {
    return error;
  }
  throw new Error('预期操作失败，但实际执行成功');
}

describe('充值与消费事务', () => {
  let categoryId: number;
  let customerId: number;
  let database: BetterSqlite3.Database;

  beforeEach(() => {
    database = createTestDatabase();
    customerId = createCustomer(database, {
      customerName: '资金客户',
      customerPhone: '13800000010',
    }).customer.customerId;
    categoryId = createCraftCategory(database, {
      categoryName: '拼豆',
    }).categoryId;
  });

  afterEach(() => {
    database.close();
  });

  it('充值成功后同时写入流水并增加余额', () => {
    const result = createRecharge(database, {
      amountCents: 12_345,
      customerId,
      platform: '微信',
    });

    expect(result.account.balanceCents).toBe(12_345);
    expect(result.rechargeRecord).toMatchObject({
      amountCents: 12_345,
      customerId,
      platform: '微信',
    });
    expect(result.rechargeRecord.rechargeTime).toMatch(UTC_TIME_PATTERN);
    expect(getCustomerAccount(database, customerId)?.balanceCents).toBe(12_345);
    expect(listRechargeRecordsByCustomer(database, customerId)).toHaveLength(1);
  });

  it('消费成功后同时写入流水并扣减余额', () => {
    createRecharge(database, {
      amountCents: 5000,
      customerId,
      platform: '支付宝',
    });
    const result = createConsumption(database, {
      categoryId,
      consumptionAmountCents: 1250,
      customerId,
      durationMinutes: 90,
    });

    expect(result.account.balanceCents).toBe(3750);
    expect(result.consumptionRecord).toMatchObject({
      categoryId,
      consumptionAmountCents: 1250,
      customerId,
      durationMinutes: 90,
    });
    expect(getCustomerAccount(database, customerId)?.balanceCents).toBe(3750);
    expect(listConsumptionRecordsByCustomer(database, customerId)).toHaveLength(
      1,
    );
    expect(listConsumptionRecordsByCategory(database, categoryId)).toHaveLength(
      1,
    );
  });

  it('余额不足时消费失败且不写入流水', () => {
    createRecharge(database, {
      amountCents: 1000,
      customerId,
      platform: '现金',
    });

    const error = captureError(() =>
      createConsumption(database, {
        categoryId,
        consumptionAmountCents: 1001,
        customerId,
        durationMinutes: 30,
      }),
    );
    expect(error).toBeInstanceOf(BusinessError);
    expect(error).toMatchObject({ code: 'INSUFFICIENT_BALANCE' });
    expect(getCustomerAccount(database, customerId)?.balanceCents).toBe(1000);
    expect(listConsumptionRecordsByCustomer(database, customerId)).toHaveLength(
      0,
    );
  });

  it('新增资金流水前预校验客户和手工品类', () => {
    const rechargeError = captureError(() =>
      createRecharge(database, {
        amountCents: 100,
        customerId: 9999,
        platform: '微信',
      }),
    );
    expect(rechargeError).toMatchObject({ code: 'CUSTOMER_NOT_FOUND' });

    const consumptionError = captureError(() =>
      createConsumption(database, {
        categoryId: 9999,
        consumptionAmountCents: 0,
        customerId,
        durationMinutes: 0,
      }),
    );
    expect(consumptionError).toMatchObject({ code: 'CATEGORY_NOT_FOUND' });
    expect(listRechargeRecordsByCustomer(database, customerId)).toHaveLength(0);
    expect(listConsumptionRecordsByCustomer(database, customerId)).toHaveLength(
      0,
    );
  });

  it('充值余额更新失败时回滚已写入的充值流水', () => {
    database.exec(`
      CREATE TRIGGER reject_balance_update
      BEFORE UPDATE ON customer_account
      BEGIN
        SELECT RAISE(ABORT, 'forced recharge balance failure');
      END;
    `);

    expect(() =>
      createRecharge(database, {
        amountCents: 800,
        customerId,
        platform: '微信',
      }),
    ).toThrow('forced recharge balance failure');
    expect(listRechargeRecordsByCustomer(database, customerId)).toHaveLength(0);
    expect(getCustomerAccount(database, customerId)?.balanceCents).toBe(0);
  });

  it('消费余额更新失败时回滚已写入的消费流水', () => {
    createRecharge(database, {
      amountCents: 2000,
      customerId,
      platform: '微信',
    });
    database.exec(`
      CREATE TRIGGER reject_balance_update
      BEFORE UPDATE ON customer_account
      BEGIN
        SELECT RAISE(ABORT, 'forced consumption balance failure');
      END;
    `);

    expect(() =>
      createConsumption(database, {
        categoryId,
        consumptionAmountCents: 600,
        customerId,
        durationMinutes: 45,
      }),
    ).toThrow('forced consumption balance failure');
    expect(listConsumptionRecordsByCustomer(database, customerId)).toHaveLength(
      0,
    );
    expect(getCustomerAccount(database, customerId)?.balanceCents).toBe(2000);
  });

  it('已有消费记录的手工品类不能删除', () => {
    createRecharge(database, {
      amountCents: 100,
      customerId,
      platform: '现金',
    });
    createConsumption(database, {
      categoryId,
      consumptionAmountCents: 100,
      customerId,
      durationMinutes: 10,
    });

    expect(() => deleteCraftCategory(database, categoryId)).toThrow(
      '手工品类已存在消费记录，不能删除',
    );
  });

  it('拒绝非整数分金额和非法消费时长', () => {
    const rechargeError = captureError(() =>
      createRecharge(database, {
        amountCents: 10.5,
        customerId,
        platform: '微信',
      }),
    );
    expect(rechargeError).toMatchObject({ code: 'INVALID_INPUT' });

    const consumptionError = captureError(() =>
      createConsumption(database, {
        categoryId,
        consumptionAmountCents: 0,
        customerId,
        durationMinutes: -1,
      }),
    );
    expect(consumptionError).toMatchObject({ code: 'INVALID_INPUT' });
    expect(listRechargeRecordsByCustomer(database, customerId)).toHaveLength(0);
    expect(listConsumptionRecordsByCustomer(database, customerId)).toHaveLength(
      0,
    );
  });
});
