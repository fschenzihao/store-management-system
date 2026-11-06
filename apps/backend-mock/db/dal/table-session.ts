import type BetterSqlite3 from 'better-sqlite3';

/** 会话状态：1=使用中、2=已结束。 */
export const TABLE_SESSION_ACTIVE = 1;
export const TABLE_SESSION_CLOSED = 2;

export type TableSessionStatus =
  | typeof TABLE_SESSION_ACTIVE
  | typeof TABLE_SESSION_CLOSED;

export interface TableSession {
  categoryId: number;
  closeTime: null | string;
  createTime: string;
  customerId: number;
  plannedDurationMinutes: number;
  plannedEndTime: string;
  sessionId: number;
  startTime: string;
  status: TableSessionStatus;
  tableId: number;
  totalAmountCents: number;
  totalDurationMinutes: number;
  updateTime: string;
}

/** 看板上的进行中会话，附带客户名与品类名。 */
export interface TableBoardSession {
  categoryId: number;
  categoryName: string;
  customerId: number;
  customerName: string;
  plannedDurationMinutes: number;
  plannedEndTime: string;
  sessionId: number;
  startTime: string;
  totalAmountCents: number;
  totalDurationMinutes: number;
}

export interface TableBoardItem {
  seatNo: number;
  session: null | TableBoardSession;
  tableId: number;
}

export interface TableBoardSummary {
  activeCount: number;
  todayDurationMinutes: number;
  todaySessionCount: number;
  todayTotalAmountCents: number;
}

interface TableSessionRow {
  category_id: number;
  close_time: null | string;
  create_time: string;
  customer_id: number;
  planned_duration_minutes: number;
  planned_end_time: string;
  session_id: number;
  start_time: string;
  status: TableSessionStatus;
  table_id: number;
  total_amount_cents: number;
  total_duration_minutes: number;
  update_time: string;
}

interface TableBoardRow {
  category_id: null | number;
  category_name: null | string;
  customer_id: null | number;
  customer_name: null | string;
  planned_duration_minutes: null | number;
  planned_end_time: null | string;
  seat_no: number;
  session_id: null | number;
  start_time: null | string;
  table_id: number;
  total_amount_cents: null | number;
  total_duration_minutes: null | number;
}

function mapTableSession(row: TableSessionRow): TableSession {
  return {
    categoryId: row.category_id,
    closeTime: row.close_time,
    createTime: row.create_time,
    customerId: row.customer_id,
    plannedDurationMinutes: row.planned_duration_minutes,
    plannedEndTime: row.planned_end_time,
    sessionId: row.session_id,
    startTime: row.start_time,
    status: row.status,
    tableId: row.table_id,
    totalAmountCents: row.total_amount_cents,
    totalDurationMinutes: row.total_duration_minutes,
    updateTime: row.update_time,
  };
}

export function getTableSession(
  database: BetterSqlite3.Database,
  sessionId: number,
): null | TableSession {
  const row = database
    .prepare('SELECT * FROM table_session WHERE session_id = ?')
    .get(sessionId) as TableSessionRow | undefined;
  return row ? mapTableSession(row) : null;
}

/** 查询某座位当前进行中的会话，不存在返回 null。 */
export function getActiveTableSession(
  database: BetterSqlite3.Database,
  tableId: number,
): null | TableSession {
  const row = database
    .prepare(
      'SELECT * FROM table_session WHERE table_id = ? AND status = ? LIMIT 1',
    )
    .get(tableId, TABLE_SESSION_ACTIVE) as TableSessionRow | undefined;
  return row ? mapTableSession(row) : null;
}

export interface InsertTableSessionInput {
  categoryId: number;
  customerId: number;
  plannedDurationMinutes: number;
  plannedEndTime: string;
  startTime: string;
  tableId: number;
  totalAmountCents: number;
  totalDurationMinutes: number;
}

/** 仅供开台事务调用，业务入口不得单独写入会话。 */
export function insertTableSession(
  database: BetterSqlite3.Database,
  input: InsertTableSessionInput,
): TableSession {
  const result = database
    .prepare(
      `INSERT INTO table_session
        (table_id, customer_id, category_id, status, planned_duration_minutes,
         start_time, planned_end_time, total_amount_cents, total_duration_minutes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.tableId,
      input.customerId,
      input.categoryId,
      TABLE_SESSION_ACTIVE,
      input.plannedDurationMinutes,
      input.startTime,
      input.plannedEndTime,
      input.totalAmountCents,
      input.totalDurationMinutes,
    );
  const session = getTableSession(database, Number(result.lastInsertRowid));
  if (!session) {
    throw new Error('开台会话写入后读取失败');
  }
  return session;
}

export interface ExtendTableSessionInput {
  plannedDurationMinutes: number;
  plannedEndTime: string;
  totalAmountCents: number;
  totalDurationMinutes: number;
}

/** 仅供续时事务调用，续时后会话仍保持进行中。 */
export function extendTableSessionRow(
  database: BetterSqlite3.Database,
  sessionId: number,
  input: ExtendTableSessionInput,
  updateTime: string,
): void {
  database
    .prepare(
      `UPDATE table_session
       SET planned_duration_minutes = ?,
           planned_end_time = ?,
           total_amount_cents = ?,
           total_duration_minutes = ?,
           update_time = ?
       WHERE session_id = ? AND status = ?`,
    )
    .run(
      input.plannedDurationMinutes,
      input.plannedEndTime,
      input.totalAmountCents,
      input.totalDurationMinutes,
      updateTime,
      sessionId,
      TABLE_SESSION_ACTIVE,
    );
}

/** 仅供结束事务调用；重复结束由事务层校验。 */
export function closeTableSessionRow(
  database: BetterSqlite3.Database,
  sessionId: number,
  closeTime: string,
): void {
  database
    .prepare(
      `UPDATE table_session
       SET status = ?, close_time = ?, update_time = ?
       WHERE session_id = ? AND status = ?`,
    )
    .run(
      TABLE_SESSION_CLOSED,
      closeTime,
      closeTime,
      sessionId,
      TABLE_SESSION_ACTIVE,
    );
}

/** 看板主体数据：18 个座位 + 各自的进行中会话，单条 JOIN 查询避免 N+1。 */
export function listTableBoard(
  database: BetterSqlite3.Database,
): TableBoardItem[] {
  const rows = database
    .prepare(
      `SELECT t.table_id, t.seat_no,
              s.session_id, s.customer_id, c.customer_name,
              s.category_id, cat.category_name,
              s.planned_duration_minutes, s.start_time, s.planned_end_time,
              s.total_amount_cents, s.total_duration_minutes
       FROM store_table t
       LEFT JOIN table_session s ON s.table_id = t.table_id AND s.status = ?
       LEFT JOIN customer c ON c.customer_id = s.customer_id
       LEFT JOIN craft_category cat ON cat.category_id = s.category_id
       ORDER BY t.seat_no`,
    )
    .all(TABLE_SESSION_ACTIVE) as TableBoardRow[];
  return rows.map((row) => ({
    seatNo: row.seat_no,
    session:
      row.session_id === null
        ? null
        : {
            categoryId: row.category_id ?? 0,
            categoryName: row.category_name ?? '',
            customerId: row.customer_id ?? 0,
            customerName: row.customer_name ?? '',
            plannedDurationMinutes: row.planned_duration_minutes ?? 0,
            plannedEndTime: row.planned_end_time ?? '',
            sessionId: row.session_id,
            startTime: row.start_time ?? '',
            totalAmountCents: row.total_amount_cents ?? 0,
            totalDurationMinutes: row.total_duration_minutes ?? 0,
          },
    tableId: row.table_id,
  }));
}

interface TableBoardSummaryRow {
  session_count: number;
  total_amount_cents: number;
  total_duration_minutes: number;
}

/** 当日营业汇总：以 UTC 日期对齐 start_time 与 SQLite 的 date('now')。 */
export function getTableBoardSummary(
  database: BetterSqlite3.Database,
  activeCount: number,
): TableBoardSummary {
  const row = database
    .prepare(
      `SELECT COUNT(*) AS session_count,
              COALESCE(SUM(total_amount_cents), 0) AS total_amount_cents,
              COALESCE(SUM(total_duration_minutes), 0) AS total_duration_minutes
       FROM table_session
       WHERE date(start_time) = date('now')`,
    )
    .get() as TableBoardSummaryRow;
  return {
    activeCount,
    todayDurationMinutes: row.total_duration_minutes,
    todaySessionCount: row.session_count,
    todayTotalAmountCents: row.total_amount_cents,
  };
}
