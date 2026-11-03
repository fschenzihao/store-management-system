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
