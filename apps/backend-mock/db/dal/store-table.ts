import type BetterSqlite3 from 'better-sqlite3';

/**
 * 桌位（座位级）基础数据。
 *
 * 全场固定 18 个座位，仅保存编号；分区、展示名与 3D 坐标由前端按 `seatNo` 推导，
 * 因此调整门店布局不需要修改数据库。
 */
export interface StoreTable {
  createTime: string;
  seatNo: number;
  tableId: number;
  updateTime: string;
}

interface StoreTableRow {
  create_time: string;
  seat_no: number;
  table_id: number;
  update_time: string;
}

function mapStoreTable(row: StoreTableRow): StoreTable {
  return {
    createTime: row.create_time,
    seatNo: row.seat_no,
    tableId: row.table_id,
    updateTime: row.update_time,
  };
}

export function getStoreTable(
  database: BetterSqlite3.Database,
  tableId: number,
): null | StoreTable {
  const row = database
    .prepare('SELECT * FROM store_table WHERE table_id = ?')
    .get(tableId) as StoreTableRow | undefined;
  return row ? mapStoreTable(row) : null;
}

export function getStoreTableBySeatNo(
  database: BetterSqlite3.Database,
  seatNo: number,
): null | StoreTable {
  const row = database
    .prepare('SELECT * FROM store_table WHERE seat_no = ?')
    .get(seatNo) as StoreTableRow | undefined;
  return row ? mapStoreTable(row) : null;
}

/** 按座位号升序返回全部桌位；看板固定 18 行，无分页。 */
export function listStoreTables(
  database: BetterSqlite3.Database,
): StoreTable[] {
  const rows = database
    .prepare('SELECT * FROM store_table ORDER BY seat_no')
    .all() as StoreTableRow[];
  return rows.map((row) => mapStoreTable(row));
}
