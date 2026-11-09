import type BetterSqlite3 from 'better-sqlite3';

import { CATEGORY_STATUS_ON, getCraftCategory } from './craft-category.ts';
import { getCustomer } from './customer.ts';
import {
  assertPositiveInteger,
  BusinessError,
  getUtcTimestamp,
} from './shared.ts';

/** 默认客户配置键：取值为 customer.customer_id 的十进制文本。 */
export const SETTING_KEY_DEFAULT_CUSTOMER = 'default_customer_id';

/** 默认手工品类配置键：取值为 craft_category.category_id 的十进制文本。 */
export const SETTING_KEY_DEFAULT_CATEGORY = 'default_category_id';

/** 系统设置：默认客户与默认手工品类，未配置时为 null。 */
export interface StoreSetting {
  defaultCategoryId: null | number;
  defaultCategoryName: null | string;
  defaultCustomerId: null | number;
  defaultCustomerName: null | string;
  /** 配置项最后修改时间；从未保存过配置时为 null。 */
  updateTime: null | string;
}

/** 保存系统设置：undefined 表示不修改，null 表示清空。 */
export interface SaveStoreSettingInput {
  defaultCategoryId?: null | number | undefined;
  defaultCustomerId?: null | number | undefined;
}

interface SystemSettingRow {
  create_time: string;
  remark: null | string;
  setting_key: string;
  setting_value: null | string;
  update_time: string;
}

function getSystemSetting(
  database: BetterSqlite3.Database,
  settingKey: string,
): null | SystemSettingRow {
  const row = database
    .prepare('SELECT * FROM system_setting WHERE setting_key = ?')
    .get(settingKey) as SystemSettingRow | undefined;
  return row ?? null;
}

/** 配置值解析：仅接受十进制正整数文本，其余情况按未配置处理。 */
function parseSettingId(value: null | string | undefined): null | number {
  if (!value || !/^[1-9]\d*$/.test(value)) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

/** 读取系统设置，引用已失效或品类已下架时对应字段回退为 null。 */
export function getStoreSetting(
  database: BetterSqlite3.Database,
): StoreSetting {
  const customerId = parseSettingId(
    getSystemSetting(database, SETTING_KEY_DEFAULT_CUSTOMER)?.setting_value,
  );
  const customer =
    customerId === null ? null : getCustomer(database, customerId);

  const storedCategoryId = parseSettingId(
    getSystemSetting(database, SETTING_KEY_DEFAULT_CATEGORY)?.setting_value,
  );
  const storedCategory =
    storedCategoryId === null
      ? null
      : getCraftCategory(database, storedCategoryId);
  // 下架品类不可作为默认品类，按未配置处理
  const category =
    storedCategory?.status === CATEGORY_STATUS_ON ? storedCategory : null;

  const rows = database
    .prepare('SELECT update_time FROM system_setting')
    .all() as { update_time: string }[];
  const updateTime =
    rows.length === 0
      ? null
      : (rows
          .map((row) => row.update_time)
          .toSorted((a, b) => a.localeCompare(b))
          .at(-1) ?? null);

  return {
    defaultCategoryId: category?.categoryId ?? null,
    defaultCategoryName: category?.categoryName ?? null,
    defaultCustomerId: customer?.customerId ?? null,
    defaultCustomerName: customer?.customerName ?? null,
    updateTime,
  };
}

/** 写入单个配置项：值为 null 时保存 NULL，表示该项未配置。 */
function upsertSettingValue(
  database: BetterSqlite3.Database,
  settingKey: string,
  settingValue: null | string,
  timestamp: string,
): void {
  database
    .prepare(
      `INSERT INTO system_setting (setting_key, setting_value, create_time, update_time)
       VALUES (?, ?, ?, ?)
       ON CONFLICT (setting_key) DO UPDATE
       SET setting_value = excluded.setting_value,
           update_time = excluded.update_time`,
    )
    .run(settingKey, settingValue, timestamp, timestamp);
}

/** 校验默认客户：必须是存在且为正整数 ID 的客户。 */
function resolveDefaultCustomerId(
  database: BetterSqlite3.Database,
  customerId: number,
): string {
  assertPositiveInteger(customerId, '默认客户');
  if (!getCustomer(database, customerId)) {
    throw new BusinessError(
      'CUSTOMER_NOT_FOUND',
      `客户不存在（ID: ${customerId}）`,
    );
  }
  return String(customerId);
}

/** 校验默认手工品类：必须是存在且处于上架状态的品类。 */
function resolveDefaultCategoryId(
  database: BetterSqlite3.Database,
  categoryId: number,
): string {
  assertPositiveInteger(categoryId, '默认手工品类');
  const category = getCraftCategory(database, categoryId);
  if (!category) {
    throw new BusinessError(
      'CATEGORY_NOT_FOUND',
      `手工品类不存在（ID: ${categoryId}）`,
    );
  }
  if (category.status !== CATEGORY_STATUS_ON) {
    throw new BusinessError(
      'CATEGORY_OFF_SHELF',
      `手工品类已下架，不能设为默认品类（ID: ${categoryId}）`,
    );
  }
  return String(categoryId);
}

/**
 * 保存系统设置。
 *
 * - 字段省略表示保持原值，传 null 表示清空；
 * - 默认客户必须存在，默认品类必须存在且为上架状态；
 * - 所有写入在同一事务中完成，提交成功后返回最新配置。
 */
export function saveStoreSetting(
  database: BetterSqlite3.Database,
  input: SaveStoreSettingInput,
): StoreSetting {
  const customerId = input.defaultCustomerId;
  const categoryId = input.defaultCategoryId;
  if (customerId === undefined && categoryId === undefined) {
    throw new BusinessError(
      'INVALID_INPUT',
      '修改系统设置至少包含一个配置字段',
    );
  }

  database
    .transaction(() => {
      const timestamp = getUtcTimestamp();
      if (customerId !== undefined) {
        upsertSettingValue(
          database,
          SETTING_KEY_DEFAULT_CUSTOMER,
          customerId === null
            ? null
            : resolveDefaultCustomerId(database, customerId),
          timestamp,
        );
      }
      if (categoryId !== undefined) {
        upsertSettingValue(
          database,
          SETTING_KEY_DEFAULT_CATEGORY,
          categoryId === null
            ? null
            : resolveDefaultCategoryId(database, categoryId),
          timestamp,
        );
      }
    })
    .immediate();

  return getStoreSetting(database);
}
