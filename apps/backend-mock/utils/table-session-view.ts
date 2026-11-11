import type BetterSqlite3 from 'better-sqlite3';
import type { TableSession } from '~/db/dal/table-session.ts';

import { getStoreTable } from '~/db/dal/store-table.ts';
import { getCategoryName, requireCustomer } from '~/utils/store-api.ts';

/** 接口层返回的会话视图：在会话字段基础上补齐客户名、品类名与座位号。 */
export interface TableSessionView extends TableSession {
  categoryName: string;
  customerName: string;
  seatNo: number;
}

/** 开台、续时、结账、关台四个端点共用的会话视图组装。 */
export function toTableSessionView(
  database: BetterSqlite3.Database,
  session: TableSession,
): TableSessionView {
  const customerName = requireCustomer(
    database,
    session.customerId,
  ).customerName;
  const categoryName = getCategoryName(database, session.categoryId);
  const table = getStoreTable(database, session.tableId);
  return {
    ...session,
    categoryName,
    customerName,
    seatNo: table?.seatNo ?? 0,
  };
}
