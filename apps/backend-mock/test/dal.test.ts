// @vitest-environment node

import type BetterSqlite3 from 'better-sqlite3';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  CATEGORY_STATUS_OFF,
  CATEGORY_STATUS_ON,
  createCraftCategory,
  deleteCraftCategory,
  getCraftCategory,
  listCraftCategories,
  setCraftCategoryStatus,
  updateCraftCategory,
} from '../db/dal/craft-category.ts';
import { getCustomerAccount } from '../db/dal/customer-account.ts';
import {
  createCustomer,
  deleteCustomer,
  listCustomers,
  updateCustomer,
} from '../db/dal/customer.ts';
import { createTestDatabase } from './helpers/database.ts';

const UTC_TIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

describe('数据访问层', () => {
  let database: BetterSqlite3.Database;

  beforeEach(() => {
    database = createTestDatabase();
  });

  afterEach(() => {
    database.close();
  });

  it('维护手工品类并使用 UTC 文本时间', () => {
    const created = createCraftCategory(database, { categoryName: ' 拼豆 ' });
    expect(created.categoryName).toBe('拼豆');
    expect(created.createTime).toMatch(UTC_TIME_PATTERN);

    const updated = updateCraftCategory(database, created.categoryId, {
      categoryName: '拼豆手工',
    });
    expect(updated.categoryName).toBe('拼豆手工');
    expect(listCraftCategories(database)).toHaveLength(1);

    deleteCraftCategory(database, created.categoryId);
    expect(getCraftCategory(database, created.categoryId)).toBeNull();
  });

  it('品类默认上架，支持备注、状态切换与按状态过滤', () => {
    const created = createCraftCategory(database, {
      categoryName: '拼豆钥匙扣',
      remark: ' 热门项目 ',
    });
    expect(created.status).toBe(CATEGORY_STATUS_ON);
    expect(created.remark).toBe('热门项目');
    expect(created.updateTime).toMatch(UTC_TIME_PATTERN);

    const offShelf = setCraftCategoryStatus(
      database,
      created.categoryId,
      CATEGORY_STATUS_OFF,
    );
    expect(offShelf.status).toBe(CATEGORY_STATUS_OFF);
    expect(offShelf.remark).toBe('热门项目');
    expect(
      listCraftCategories(database, { status: CATEGORY_STATUS_OFF }),
    ).toHaveLength(1);
    expect(
      listCraftCategories(database, { status: CATEGORY_STATUS_ON }),
    ).toHaveLength(0);

    const updated = updateCraftCategory(database, created.categoryId, {
      categoryName: '拼豆钥匙扣',
      remark: null,
      status: CATEGORY_STATUS_ON,
    });
    expect(updated.remark).toBeNull();
    expect(updated.status).toBe(CATEGORY_STATUS_ON);
    expect(() =>
      updateCraftCategory(database, created.categoryId, {
        categoryName: '拼豆钥匙扣',
        remark: '超'.repeat(501),
      }),
    ).toThrow('备注长度不能超过 500 个字符');
  });

  it('客户建档时同步创建零余额账户，并支持资料更新', () => {
    const { account, customer } = createCustomer(database, {
      customerName: ' 小明 ',
      customerPhone: ' 13800000000 ',
      remark: ' 喜欢蓝色 ',
      wechatId: 'bead-customer',
      wechatName: '明明',
    });
    expect(customer.customerName).toBe('小明');
    expect(customer.createTime).toMatch(UTC_TIME_PATTERN);
    expect(customer.updateTime).toMatch(UTC_TIME_PATTERN);
    expect(account).toEqual({
      balanceCents: 0,
      customerId: customer.customerId,
    });

    const updated = updateCustomer(database, customer.customerId, {
      customerPhone: '13900000000',
      remark: '',
      wechatId: null,
    });
    expect(updated.customerPhone).toBe('13900000000');
    expect(updated.remark).toBeNull();
    expect(updated.wechatId).toBeNull();
    expect(updated.wechatName).toBe('明明');
    expect(
      getCustomerAccount(database, customer.customerId)?.balanceCents,
    ).toBe(0);
  });

  it('账户初始化失败时回滚客户建档', () => {
    database.exec(`
      CREATE TRIGGER reject_account_insert
      BEFORE INSERT ON customer_account
      BEGIN
        SELECT RAISE(ABORT, 'forced account insert failure');
      END;
    `);

    expect(() =>
      createCustomer(database, {
        customerName: '事务客户',
        customerPhone: '13800000001',
      }),
    ).toThrow('forced account insert failure');
    expect(listCustomers(database)).toHaveLength(0);
  });

  it('删除客户前检查关联账户或业务数据', () => {
    const { customer } = createCustomer(database, {
      customerName: '关联客户',
      customerPhone: '13800000002',
    });

    expect(() => deleteCustomer(database, customer.customerId)).toThrow(
      '客户存在关联账户，不能删除',
    );
    expect(listCustomers(database)).toHaveLength(1);
  });
});
