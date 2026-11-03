import type BetterSqlite3 from 'better-sqlite3';

export interface ConsumptionRecord {
  categoryId: number;
  consumptionAmountCents: number;
  consumptionId: number;
  customerId: number;
  durationMinutes: number;
}

export interface CreateConsumptionInput {
  categoryId: number;
  consumptionAmountCents: number;
  customerId: number;
  durationMinutes: number;
}

interface ConsumptionRecordRow {
  category_id: number;
  consumption_amount_cents: number;
  consumption_id: number;
  customer_id: number;
  duration_minutes: number;
}

function mapConsumptionRecord(row: ConsumptionRecordRow): ConsumptionRecord {
  return {
    categoryId: row.category_id,
    consumptionAmountCents: row.consumption_amount_cents,
    consumptionId: row.consumption_id,
    customerId: row.customer_id,
    durationMinutes: row.duration_minutes,
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
        (customer_id, category_id, duration_minutes, consumption_amount_cents)
       VALUES (?, ?, ?, ?)`,
    )
    .run(
      input.customerId,
      input.categoryId,
      input.durationMinutes,
      input.consumptionAmountCents,
    );
  const record = getConsumptionRecord(database, Number(result.lastInsertRowid));
  if (!record) {
    throw new Error('消费记录写入后读取失败');
  }
  return record;
}
