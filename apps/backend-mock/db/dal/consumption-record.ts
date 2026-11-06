import type BetterSqlite3 from 'better-sqlite3';

export interface ConsumptionRecord {
  categoryId: number;
  consumptionAmountCents: number;
  consumptionId: number;
  customerId: number;
  durationMinutes: number;
  /** 是否全天：1=全天、0=否，null 表示未指定。 */
  isFullDay: null | number;
  /** 桌号，null 表示未指定。 */
  tableNumber: null | number;
  /** 关联的开台会话；历史手工录入的消费记录为 null。 */
  sessionId: null | number;
}

export interface CreateConsumptionInput {
  categoryId: number;
  consumptionAmountCents: number;
  customerId: number;
  durationMinutes: number;
  /** 可选是否全天标记，缺省或 null 时落库为 NULL。 */
  isFullDay?: null | number;
  /** 可选桌号，缺省或 null 时落库为 NULL。 */
  tableNumber?: null | number;
  sessionId?: null | number;
}

interface ConsumptionRecordRow {
  category_id: number;
  consumption_amount_cents: number;
  consumption_id: number;
  customer_id: number;
  duration_minutes: number;
  is_full_day: null | number;
  table_number: null | number;
  session_id: null | number;
}

function mapConsumptionRecord(row: ConsumptionRecordRow): ConsumptionRecord {
  return {
    categoryId: row.category_id,
    consumptionAmountCents: row.consumption_amount_cents,
    consumptionId: row.consumption_id,
    customerId: row.customer_id,
    durationMinutes: row.duration_minutes,
    isFullDay: row.is_full_day,
    tableNumber: row.table_number,
    sessionId: row.session_id,
  };
}

export function getConsumptionRecord(
  database: BetterSqlite3.Database,
  consumptionId: number,
): ConsumptionRecord | null {
  const row = database
    .prepare('SELECT * FROM consumption_record WHERE consumption_id = ?')
    .get(consumptionId) as ConsumptionRecordRow | undefined;
  return row ? mapConsumptionRecord(row) : null;
}

export function listConsumptionRecordsByCustomer(
  database: BetterSqlite3.Database,
  customerId: number,
): ConsumptionRecord[] {
  const rows = database
    .prepare(
      `SELECT * FROM consumption_record
       WHERE customer_id = ?
       ORDER BY consumption_id DESC`,
    )
    .all(customerId) as ConsumptionRecordRow[];
  return rows.map((row) => mapConsumptionRecord(row));
}

export interface ListConsumptionRecordsFilters {
  categoryId?: number;
  customerId?: number;
}

/** 全局消费记录列表：按可选 customerId / categoryId 过滤，新流水在前。 */
export function listConsumptionRecords(
  database: BetterSqlite3.Database,
  filters: ListConsumptionRecordsFilters = {},
): ConsumptionRecord[] {
  const conditions: string[] = [];
  const params: number[] = [];
  if (filters.customerId !== undefined) {
    conditions.push('customer_id = ?');
    params.push(filters.customerId);
  }
  if (filters.categoryId !== undefined) {
    conditions.push('category_id = ?');
    params.push(filters.categoryId);
  }
  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = database
    .prepare(
      `SELECT * FROM consumption_record
       ${where}
       ORDER BY consumption_id DESC`,
    )
    .all(...params) as ConsumptionRecordRow[];
  return rows.map((row) => mapConsumptionRecord(row));
}

export function listConsumptionRecordsByCategory(
  database: BetterSqlite3.Database,
  categoryId: number,
): ConsumptionRecord[] {
  const rows = database
    .prepare(
      `SELECT * FROM consumption_record
       WHERE category_id = ?
       ORDER BY consumption_id DESC`,
    )
    .all(categoryId) as ConsumptionRecordRow[];
  return rows.map((row) => mapConsumptionRecord(row));
}

/** 仅供消费事务调用，业务入口不得单独写入消费流水。 */
export function insertConsumptionRecord(
  database: BetterSqlite3.Database,
  input: CreateConsumptionInput,
): ConsumptionRecord {
  const result = database
    .prepare(
      `INSERT INTO consumption_record
        (customer_id, category_id, duration_minutes, consumption_amount_cents, table_number, is_full_day, session_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.customerId,
      input.categoryId,
      input.durationMinutes,
      input.consumptionAmountCents,
      input.tableNumber ?? null,
      input.isFullDay ?? null,
      input.sessionId ?? null,
    );
  const record = getConsumptionRecord(database, Number(result.lastInsertRowid));
  if (!record) {
    throw new Error('消费记录写入后读取失败');
  }
  return record;
}

/** 按品类统计消费：包含所有品类，无消费记录的品类统计值为 0。 */
export interface CategoryConsumptionStatistic {
  categoryId: number;
  consumptionCount: number;
  totalConsumptionAmountCents: number;
  totalDurationMinutes: number;
}

interface CategoryConsumptionStatisticRow {
  category_id: number;
  consumption_count: number;
  total_consumption_amount_cents: number;
  total_duration_minutes: number;
}

/** 品类名由接口层按 `categoryId` 关联补齐，存储层类型不包含品类名。 */
export function getCategoryConsumptionStatistics(
  database: BetterSqlite3.Database,
): CategoryConsumptionStatistic[] {
  const rows = database
    .prepare(
      `SELECT c.category_id AS category_id,
              COUNT(r.consumption_id) AS consumption_count,
              COALESCE(SUM(r.consumption_amount_cents), 0) AS total_consumption_amount_cents,
              COALESCE(SUM(r.duration_minutes), 0) AS total_duration_minutes
       FROM craft_category c
       LEFT JOIN consumption_record r ON r.category_id = c.category_id
       GROUP BY c.category_id
       ORDER BY total_consumption_amount_cents DESC, c.category_id ASC`,
    )
    .all() as CategoryConsumptionStatisticRow[];
  return rows.map((row) => ({
    categoryId: row.category_id,
    consumptionCount: row.consumption_count,
    totalConsumptionAmountCents: row.total_consumption_amount_cents,
    totalDurationMinutes: row.total_duration_minutes,
  }));
}
