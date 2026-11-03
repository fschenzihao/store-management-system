import type BetterSqlite3 from 'better-sqlite3';

import type { CustomerAccount } from './customer-account.ts';

import { getCustomerAccount } from './customer-account.ts';
import {
  BusinessError,
  getUtcTimestamp,
  hasSqliteCode,
  isForeignKeyError,
  normalizeOptionalText,
  normalizeRequiredText,
} from './shared.ts';

export interface Customer {
  createTime: string;
  customerId: number;
  customerName: string;
  customerPhone: string;
  remark: null | string;
  updateTime: string;
  wechatId: null | string;
  wechatName: null | string;
}

export interface CreateCustomerInput {
  customerName: string;
  customerPhone: string;
  remark?: null | string;
  wechatId?: null | string;
  wechatName?: null | string;
}

export interface UpdateCustomerInput {
  customerName?: string;
  customerPhone?: string;
  remark?: null | string;
  wechatId?: null | string;
  wechatName?: null | string;
}

export interface CreateCustomerResult {
  account: CustomerAccount;
  customer: Customer;
}

interface CustomerRow {
  create_time: string;
  customer_id: number;
  customer_name: string;
  customer_phone: string;
  remark: null | string;
  update_time: string;
  wechat_id: null | string;
  wechat_name: null | string;
}

function mapCustomer(row: CustomerRow): Customer {
  return {
    createTime: row.create_time,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    remark: row.remark,
    updateTime: row.update_time,
    wechatId: row.wechat_id,
    wechatName: row.wechat_name,
  };
}

export function getCustomer(
  database: BetterSqlite3.Database,
  customerId: number,
): Customer | null {
  const row = database
    .prepare('SELECT * FROM customer WHERE customer_id = ?')
    .get(customerId) as CustomerRow | undefined;
  return row ? mapCustomer(row) : null;
}

export function listCustomers(database: BetterSqlite3.Database): Customer[] {
  const rows = database
    .prepare('SELECT * FROM customer ORDER BY customer_id')
    .all() as CustomerRow[];
  return rows.map((row) => mapCustomer(row));
}

function translateCustomerUniqueError(error: unknown): never {
  if (hasSqliteCode(error, 'SQLITE_CONSTRAINT_UNIQUE')) {
    if (
      error instanceof Error &&
      error.message.includes('customer.wechat_id')
    ) {
      throw new BusinessError(
        'DUPLICATE_WECHAT_ID',
        '微信 ID 已被其他客户使用',
      );
    }
    throw new BusinessError('DUPLICATE_CUSTOMER_PHONE', '客户手机号已存在');
  }
  throw error;
}

/** 客户建档与零余额账户初始化必须在同一事务中完成。 */
export function createCustomer(
  database: BetterSqlite3.Database,
  input: CreateCustomerInput,
): CreateCustomerResult {
  const values = {
    customerName: normalizeRequiredText(input.customerName, '客户名', 50),
    customerPhone: normalizeRequiredText(input.customerPhone, '客户手机', 20),
    remark: normalizeOptionalText(input.remark, '备注', 500),
    wechatId: normalizeOptionalText(input.wechatId, '微信 ID', 64),
    wechatName: normalizeOptionalText(input.wechatName, '微信名', 100),
  };
  try {
    return database
      .transaction(() => {
        const timestamp = getUtcTimestamp();
        const result = database
          .prepare(
            `INSERT INTO customer
            (customer_name, customer_phone, wechat_id, wechat_name, remark,
             create_time, update_time)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(
            values.customerName,
            values.customerPhone,
            values.wechatId,
            values.wechatName,
            values.remark,
            timestamp,
            timestamp,
          );
        const customerId = Number(result.lastInsertRowid);
        database
          .prepare(
            'INSERT INTO customer_account (customer_id, balance_cents) VALUES (?, 0)',
          )
          .run(customerId);
        const customer = getCustomer(database, customerId);
        const account = getCustomerAccount(database, customerId);
        if (!customer || !account) {
          throw new Error('客户建档后读取客户或账户失败');
        }
        return { account, customer };
      })
      .immediate();
  } catch (error) {
    translateCustomerUniqueError(error);
  }
}

export function updateCustomer(
  database: BetterSqlite3.Database,
  customerId: number,
  input: UpdateCustomerInput,
): Customer {
  const current = getCustomer(database, customerId);
  if (!current) {
    throw new BusinessError(
      'CUSTOMER_NOT_FOUND',
      `客户不存在（ID: ${customerId}）`,
    );
  }
  const values = {
    customerName:
      input.customerName === undefined
        ? current.customerName
        : normalizeRequiredText(input.customerName, '客户名', 50),
    customerPhone:
      input.customerPhone === undefined
        ? current.customerPhone
        : normalizeRequiredText(input.customerPhone, '客户手机', 20),
    remark:
      input.remark === undefined
        ? current.remark
        : normalizeOptionalText(input.remark, '备注', 500),
    wechatId:
      input.wechatId === undefined
        ? current.wechatId
        : normalizeOptionalText(input.wechatId, '微信 ID', 64),
    wechatName:
      input.wechatName === undefined
        ? current.wechatName
        : normalizeOptionalText(input.wechatName, '微信名', 100),
  };
  try {
    database
      .prepare(
        `UPDATE customer SET
          customer_name = ?, customer_phone = ?, wechat_id = ?,
          wechat_name = ?, remark = ?, update_time = ?
         WHERE customer_id = ?`,
      )
      .run(
        values.customerName,
        values.customerPhone,
        values.wechatId,
        values.wechatName,
        values.remark,
        getUtcTimestamp(),
        customerId,
      );
    const customer = getCustomer(database, customerId);
    if (!customer) {
      throw new Error('客户更新后读取失败');
    }
    return customer;
  } catch (error) {
    translateCustomerUniqueError(error);
  }
}

/** 有账户或业务流水的客户保留历史数据，不允许物理删除。 */
export function deleteCustomer(
  database: BetterSqlite3.Database,
  customerId: number,
): void {
  try {
    database
      .transaction(() => {
        if (!getCustomer(database, customerId)) {
          throw new BusinessError(
            'CUSTOMER_NOT_FOUND',
            `客户不存在（ID: ${customerId}）`,
          );
        }
        const relatedData: string[] = [];
        if (
          database
            .prepare(
              'SELECT 1 FROM customer_account WHERE customer_id = ? LIMIT 1',
            )
            .get(customerId)
        ) {
          relatedData.push('账户');
        }
        if (
          database
            .prepare(
              'SELECT 1 FROM recharge_record WHERE customer_id = ? LIMIT 1',
            )
            .get(customerId)
        ) {
          relatedData.push('充值记录');
        }
        if (
          database
            .prepare(
              'SELECT 1 FROM consumption_record WHERE customer_id = ? LIMIT 1',
            )
            .get(customerId)
        ) {
          relatedData.push('消费记录');
        }
        if (relatedData.length > 0) {
          throw new BusinessError(
            'CUSTOMER_HAS_RELATED_DATA',
            `客户存在关联${relatedData.join('、')}，不能删除`,
          );
        }
        database
          .prepare('DELETE FROM customer WHERE customer_id = ?')
          .run(customerId);
      })
      .immediate();
  } catch (error) {
    if (isForeignKeyError(error)) {
      throw new BusinessError(
        'CUSTOMER_HAS_RELATED_DATA',
        '客户存在关联账户或业务记录，不能删除',
      );
    }
    throw error;
  }
}
