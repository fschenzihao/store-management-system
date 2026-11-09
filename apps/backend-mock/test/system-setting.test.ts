// @vitest-environment node

import type BetterSqlite3 from 'better-sqlite3';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  CATEGORY_STATUS_OFF,
  createCraftCategory,
  setCraftCategoryStatus,
} from '../db/dal/craft-category.ts';
import { createCustomer } from '../db/dal/customer.ts';
import { BusinessError } from '../db/dal/shared.ts';
import { getStoreSetting, saveStoreSetting } from '../db/dal/system-setting.ts';
import { createTestDatabase } from './helpers/database.ts';

const UTC_TIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

/** 执行写操作并返回抛出的业务错误，便于断言错误码。 */
function captureBusinessError(run: () => void): BusinessError {
  try {
    run();
  } catch (error) {
    if (error instanceof BusinessError) {
      return error;
    }
    throw error;
  }
  throw new Error('期望抛出 BusinessError，但未抛出');
}

describe('系统设置', () => {
  let database: BetterSqlite3.Database;

  beforeEach(() => {
    database = createTestDatabase();
  });

  afterEach(() => {
    database.close();
  });

  it('未配置时返回空设置', () => {
    expect(getStoreSetting(database)).toEqual({
      defaultCategoryId: null,
      defaultCategoryName: null,
      defaultCustomerId: null,
      defaultCustomerName: null,
      updateTime: null,
    });
  });

  it('保存默认客户与默认品类并回填名称', () => {
    const { customer } = createCustomer(database, {
      customerName: '小明',
      customerPhone: '13800000000',
    });
    const category = createCraftCategory(database, { categoryName: '拼豆' });

    const saved = saveStoreSetting(database, {
      defaultCategoryId: category.categoryId,
      defaultCustomerId: customer.customerId,
    });

    expect(saved).toMatchObject({
      defaultCategoryId: category.categoryId,
      defaultCategoryName: '拼豆',
      defaultCustomerId: customer.customerId,
      defaultCustomerName: '小明',
    });
    expect(saved.updateTime).toMatch(UTC_TIME_PATTERN);
    expect(getStoreSetting(database)).toEqual(saved);
  });

  it('字段省略时保持原值，传 null 时清空', () => {
    const first = createCustomer(database, {
      customerName: '小红',
      customerPhone: '13800000001',
    }).customer;
    const second = createCustomer(database, {
      customerName: '小刚',
      customerPhone: '13800000002',
    }).customer;
    const category = createCraftCategory(database, { categoryName: '奶油胶' });

    saveStoreSetting(database, {
      defaultCategoryId: category.categoryId,
      defaultCustomerId: first.customerId,
    });

    const customerUpdated = saveStoreSetting(database, {
      defaultCustomerId: second.customerId,
    });
    expect(customerUpdated.defaultCustomerName).toBe('小刚');
    expect(customerUpdated.defaultCategoryId).toBe(category.categoryId);

    const cleared = saveStoreSetting(database, { defaultCustomerId: null });
    expect(cleared.defaultCustomerId).toBeNull();
    expect(cleared.defaultCustomerName).toBeNull();
    expect(cleared.defaultCategoryId).toBe(category.categoryId);
  });

  it('拒绝不存在的客户与品类', () => {
    expect(
      captureBusinessError(() =>
        saveStoreSetting(database, { defaultCustomerId: 999 }),
      ).code,
    ).toBe('CUSTOMER_NOT_FOUND');
    expect(
      captureBusinessError(() =>
        saveStoreSetting(database, { defaultCategoryId: 999 }),
      ).code,
    ).toBe('CATEGORY_NOT_FOUND');
  });

  it('拒绝下架品类，且读取时回退已下架的默认值', () => {
    const category = createCraftCategory(database, { categoryName: '马赛克' });
    saveStoreSetting(database, { defaultCategoryId: category.categoryId });

    setCraftCategoryStatus(database, category.categoryId, CATEGORY_STATUS_OFF);

    expect(
      captureBusinessError(() =>
        saveStoreSetting(database, { defaultCategoryId: category.categoryId }),
      ).code,
    ).toBe('CATEGORY_OFF_SHELF');

    const settings = getStoreSetting(database);
    expect(settings.defaultCategoryId).toBeNull();
    expect(settings.defaultCategoryName).toBeNull();
  });

  it('客户被删除后默认客户回退为空', () => {
    const { customer } = createCustomer(database, {
      customerName: '临时客户',
      customerPhone: '13800000003',
    });
    saveStoreSetting(database, { defaultCustomerId: customer.customerId });

    database
      .prepare('DELETE FROM customer_account WHERE customer_id = ?')
      .run(customer.customerId);
    database
      .prepare('DELETE FROM customer WHERE customer_id = ?')
      .run(customer.customerId);

    const settings = getStoreSetting(database);
    expect(settings.defaultCustomerId).toBeNull();
    expect(settings.defaultCustomerName).toBeNull();
  });

  it('缺少字段或取值非法时返回 INVALID_INPUT', () => {
    expect(
      captureBusinessError(() => saveStoreSetting(database, {})).code,
    ).toBe('INVALID_INPUT');

    for (const invalidValue of [0, -1, 1.5]) {
      expect(
        captureBusinessError(() =>
          saveStoreSetting(database, { defaultCustomerId: invalidValue }),
        ).code,
      ).toBe('INVALID_INPUT');
      expect(
        captureBusinessError(() =>
          saveStoreSetting(database, { defaultCategoryId: invalidValue }),
        ).code,
      ).toBe('INVALID_INPUT');
    }
  });
});
