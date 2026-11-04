import type BetterSqlite3 from 'better-sqlite3';

export type RechargePlatform = '微信' | '支付宝' | '现金';

export interface RechargeRecord {
  amountCents: number;
  customerId: number;
  platform: RechargePlatform;
  rechargeId: number;
  rechargeTime: string;
}

export interface CreateRechargeInput {
  amountCents: number;
  customerId: number;
  platform: RechargePlatform;
}

interface RechargeRecordRow {
  amount_cents: number;
  customer_id: number;
  platform: RechargePlatform;
  recharge_id: number;
  recharge_time: string;
}

function mapRechargeRecord(row: RechargeRecordRow): RechargeRecord {
  return {
    amountCents: row.amount_cents,
    customerId: row.customer_id,
    platform: row.platform,
    rechargeId: row.recharge_id,
    rechargeTime: row.recharge_time,
  };
}

export function getRechargeRecord(
  database: BetterSqlite3.Database,
  rechargeId: number,
): null | RechargeRecord {
  const row = database
    .prepare('SELECT * FROM recharge_record WHERE recharge_id = ?')
    .get(rechargeId) as RechargeRecordRow | undefined;
  return row ? mapRechargeRecord(row) : null;
}

export function listRechargeRecordsByCustomer(
  database: BetterSqlite3.Database,
  customerId: number,
): RechargeRecord[] {
  const rows = database
    .prepare(
      `SELECT * FROM recharge_record
       WHERE customer_id = ?
       ORDER BY recharge_time DESC, recharge_id DESC`,
    )
    .all(customerId) as RechargeRecordRow[];
  return rows.map((row) => mapRechargeRecord(row));
}

export interface RechargeRecordFilter {
  customerId?: number;
  /** UTC 文本时间（YYYY-MM-DD HH:MM:SS），闭区间上界。 */
  endTime?: string;
  platform?: RechargePlatform;
  /** UTC 文本时间（YYYY-MM-DD HH:MM:SS），闭区间下界。 */
  startTime?: string;
}

export interface RechargeRecordWithCustomer extends RechargeRecord {
  customerName: string;
}

interface RechargeRecordWithCustomerRow extends RechargeRecordRow {
  customer_name: string;
}

/** 全局充值流水列表，可按客户、平台、UTC 时间范围过滤，按时间倒序。 */
export function listRechargeRecords(
  database: BetterSqlite3.Database,
  filter: RechargeRecordFilter = {},
): RechargeRecordWithCustomer[] {
  const conditions: string[] = [];
  const params: (number | string)[] = [];
  if (filter.customerId !== undefined) {
    conditions.push('r.customer_id = ?');
    params.push(filter.customerId);
  }
  if (filter.platform !== undefined) {
    conditions.push('r.platform = ?');
    params.push(filter.platform);
  }
  if (filter.startTime !== undefined) {
    conditions.push('r.recharge_time >= ?');
    params.push(filter.startTime);
  }
  if (filter.endTime !== undefined) {
    conditions.push('r.recharge_time <= ?');
    params.push(filter.endTime);
  }
  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const rows = database
    .prepare(
      `SELECT r.*, c.customer_name
       FROM recharge_record r
       JOIN customer c ON c.customer_id = r.customer_id
       ${where}
       ORDER BY r.recharge_time DESC, r.recharge_id DESC`,
    )
    .all(...params) as RechargeRecordWithCustomerRow[];
  return rows.map((row) => ({
    ...mapRechargeRecord(row),
    customerName: row.customer_name,
  }));
}

/** 仅供充值事务调用，业务入口不得单独写入充值流水。 */
export function insertRechargeRecord(
  database: BetterSqlite3.Database,
  input: CreateRechargeInput & { rechargeTime: string },
): RechargeRecord {
  const result = database
    .prepare(
      `INSERT INTO recharge_record
        (customer_id, amount_cents, platform, recharge_time)
       VALUES (?, ?, ?, ?)`,
    )
    .run(
      input.customerId,
      input.amountCents,
      input.platform,
      input.rechargeTime,
    );
  const record = getRechargeRecord(database, Number(result.lastInsertRowid));
  if (!record) {
    throw new Error('充值记录写入后读取失败');
  }
  return record;
}
