import type BetterSqlite3 from 'better-sqlite3';

import {
  BusinessError,
  getUtcTimestamp,
  hasSqliteCode,
  isForeignKeyError,
  normalizeRequiredText,
} from './shared.ts';

export interface CraftCategory {
  categoryId: number;
  categoryName: string;
  createTime: string;
}

export interface CreateCraftCategoryInput {
  categoryName: string;
}

export interface UpdateCraftCategoryInput {
  categoryName: string;
}

interface CraftCategoryRow {
  category_id: number;
  category_name: string;
  create_time: string;
}

function mapCraftCategory(row: CraftCategoryRow): CraftCategory {
  return {
    categoryId: row.category_id,
    categoryName: row.category_name,
    createTime: row.create_time,
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
): CraftCategory[] {
  const rows = database
    .prepare('SELECT * FROM craft_category ORDER BY category_id')
    .all() as CraftCategoryRow[];
  return rows.map((row) => mapCraftCategory(row));
}

export function createCraftCategory(
  database: BetterSqlite3.Database,
  input: CreateCraftCategoryInput,
): CraftCategory {
  const categoryName = normalizeRequiredText(input.categoryName, '品类名', 50);
  try {
    const result = database
      .prepare(
        'INSERT INTO craft_category (category_name, create_time) VALUES (?, ?)',
      )
      .run(categoryName, getUtcTimestamp());
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
  try {
    database
      .prepare(
        'UPDATE craft_category SET category_name = ? WHERE category_id = ?',
      )
      .run(categoryName, categoryId);
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
