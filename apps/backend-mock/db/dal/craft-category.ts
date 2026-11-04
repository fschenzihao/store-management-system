import type BetterSqlite3 from 'better-sqlite3';

import {
  BusinessError,
  getUtcTimestamp,
  hasSqliteCode,
  isForeignKeyError,
  normalizeOptionalText,
  normalizeRequiredText,
} from './shared.ts';

/** 品类状态数字枚举：1=上架、2=下架，展示文案由前端映射表/i18n 负责。 */
export const CATEGORY_STATUS_ON = 1;
export const CATEGORY_STATUS_OFF = 2;

export type CraftCategoryStatus =
  | typeof CATEGORY_STATUS_OFF
  | typeof CATEGORY_STATUS_ON;

export function normalizeCraftCategoryStatus(
  value: unknown,
  fieldName = '品类状态',
): CraftCategoryStatus {
  if (value !== CATEGORY_STATUS_ON && value !== CATEGORY_STATUS_OFF) {
    throw new BusinessError(
      'INVALID_INPUT',
      `${fieldName}只能是 1（上架）或 2（下架）`,
    );
  }
  return value;
}

export interface CraftCategory {
  categoryId: number;
  categoryName: string;
  status: CraftCategoryStatus;
  remark: null | string;
  createTime: string;
  updateTime: string;
}

export interface CreateCraftCategoryInput {
  categoryName: string;
  status?: CraftCategoryStatus;
  remark?: null | string | undefined;
}

export interface UpdateCraftCategoryInput {
  categoryName: string;
  status?: CraftCategoryStatus;
  remark?: null | string | undefined;
}

export interface ListCraftCategoriesOptions {
  status?: CraftCategoryStatus;
}

interface CraftCategoryRow {
  category_id: number;
  category_name: string;
  status: CraftCategoryStatus;
  remark: null | string;
  create_time: string;
  update_time: string;
}

function mapCraftCategory(row: CraftCategoryRow): CraftCategory {
  return {
    categoryId: row.category_id,
    categoryName: row.category_name,
    status: row.status,
    remark: row.remark,
    createTime: row.create_time,
    updateTime: row.update_time,
  };
}

export function getCraftCategory(
  database: BetterSqlite3.Database,
  categoryId: number,
): CraftCategory | null {
  const row = database
    .prepare('SELECT * FROM craft_category WHERE category_id = ?')
    .get(categoryId) as CraftCategoryRow | undefined;
  return row ? mapCraftCategory(row) : null;
}

export function listCraftCategories(
  database: BetterSqlite3.Database,
  options: ListCraftCategoriesOptions = {},
): CraftCategory[] {
  if (options.status === undefined) {
    const rows = database
      .prepare('SELECT * FROM craft_category ORDER BY category_id')
      .all() as CraftCategoryRow[];
    return rows.map((row) => mapCraftCategory(row));
  }
  const status = normalizeCraftCategoryStatus(options.status);
  const rows = database
    .prepare(
      'SELECT * FROM craft_category WHERE status = ? ORDER BY category_id',
    )
    .all(status) as CraftCategoryRow[];
  return rows.map((row) => mapCraftCategory(row));
}

export function createCraftCategory(
  database: BetterSqlite3.Database,
  input: CreateCraftCategoryInput,
): CraftCategory {
  const categoryName = normalizeRequiredText(input.categoryName, '品类名', 50);
  const status =
    input.status === undefined
      ? CATEGORY_STATUS_ON
      : normalizeCraftCategoryStatus(input.status);
  const remark = normalizeOptionalText(input.remark, '备注', 500);
  const timestamp = getUtcTimestamp();
  try {
    const result = database
      .prepare(
        'INSERT INTO craft_category (category_name, status, remark, create_time, update_time) VALUES (?, ?, ?, ?, ?)',
      )
      .run(categoryName, status, remark, timestamp, timestamp);
    const category = getCraftCategory(database, Number(result.lastInsertRowid));
    if (!category) {
      throw new Error('手工品类创建后读取失败');
    }
    return category;
  } catch (error) {
    if (hasSqliteCode(error, 'SQLITE_CONSTRAINT_UNIQUE')) {
      throw new BusinessError(
        'DUPLICATE_CATEGORY_NAME',
        `品类名已存在：${categoryName}`,
      );
    }
    throw error;
  }
}

export function updateCraftCategory(
  database: BetterSqlite3.Database,
  categoryId: number,
  input: UpdateCraftCategoryInput,
): CraftCategory {
  const current = getCraftCategory(database, categoryId);
  if (!current) {
    throw new BusinessError(
      'CATEGORY_NOT_FOUND',
      `手工品类不存在（ID: ${categoryId}）`,
    );
  }
  const categoryName = normalizeRequiredText(input.categoryName, '品类名', 50);
  const status =
    input.status === undefined
      ? undefined
      : normalizeCraftCategoryStatus(input.status);
  // undefined 表示未提供（保持原值），null 表示清空备注
  const remark =
    input.remark === undefined
      ? current.remark
      : normalizeOptionalText(input.remark, '备注', 500);
  try {
    database
      .prepare(
        `UPDATE craft_category
         SET category_name = ?,
             status = COALESCE(?, status),
             remark = ?,
             update_time = ?
         WHERE category_id = ?`,
      )
      .run(categoryName, status ?? null, remark, getUtcTimestamp(), categoryId);
    const category = getCraftCategory(database, categoryId);
    if (!category) {
      throw new Error('手工品类更新后读取失败');
    }
    return category;
  } catch (error) {
    if (hasSqliteCode(error, 'SQLITE_CONSTRAINT_UNIQUE')) {
      throw new BusinessError(
        'DUPLICATE_CATEGORY_NAME',
        `品类名已存在：${categoryName}`,
      );
    }
    throw error;
  }
}

/** 切换品类状态（上架/下架），并刷新 update_time。 */
export function setCraftCategoryStatus(
  database: BetterSqlite3.Database,
  categoryId: number,
  status: CraftCategoryStatus,
): CraftCategory {
  const normalizedStatus = normalizeCraftCategoryStatus(status);
  const current = getCraftCategory(database, categoryId);
  if (!current) {
    throw new BusinessError(
      'CATEGORY_NOT_FOUND',
      `手工品类不存在（ID: ${categoryId}）`,
    );
  }
  database
    .prepare(
      'UPDATE craft_category SET status = ?, update_time = ? WHERE category_id = ?',
    )
    .run(normalizedStatus, getUtcTimestamp(), categoryId);
  const category = getCraftCategory(database, categoryId);
  if (!category) {
    throw new Error('手工品类状态更新后读取失败');
  }
  return category;
}

export function deleteCraftCategory(
  database: BetterSqlite3.Database,
  categoryId: number,
): void {
  try {
    database
      .transaction(() => {
        if (!getCraftCategory(database, categoryId)) {
          throw new BusinessError(
            'CATEGORY_NOT_FOUND',
            `手工品类不存在（ID: ${categoryId}）`,
          );
        }
        const hasConsumption = database
          .prepare(
            'SELECT 1 FROM consumption_record WHERE category_id = ? LIMIT 1',
          )
          .get(categoryId);
        if (hasConsumption) {
          throw new BusinessError(
            'CATEGORY_HAS_CONSUMPTIONS',
            '手工品类已存在消费记录，不能删除',
          );
        }
        database
          .prepare('DELETE FROM craft_category WHERE category_id = ?')
          .run(categoryId);
      })
      .immediate();
  } catch (error) {
    if (isForeignKeyError(error)) {
      throw new BusinessError(
        'CATEGORY_HAS_CONSUMPTIONS',
        '手工品类已存在消费记录，不能删除',
      );
    }
    throw error;
  }
}
