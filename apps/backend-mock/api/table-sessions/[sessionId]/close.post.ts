import { getStoreTable } from '~/db/dal/store-table.ts';
import { closeTableSession } from '~/db/table-session-transactions.ts';
import { getDatabase } from '~/utils/db.ts';
import {
  defineStoreEventHandler,
  getCategoryName,
  getPositiveIntParam,
  requireCustomer,
} from '~/utils/store-api.ts';

/** POST /api/table-sessions/:sessionId/close：结束会话并释放座位。 */
export default defineStoreEventHandler((event) => {
  const sessionId = getPositiveIntParam(event, 'sessionId');
  const database = getDatabase();
  const session = closeTableSession(database, sessionId);
  const customerName = requireCustomer(
    database,
    session.customerId,
  ).customerName;
  const categoryName = getCategoryName(database, session.categoryId);
  const table = getStoreTable(database, session.tableId);
  return {
    session: {
      ...session,
      categoryName,
      customerName,
      seatNo: table?.seatNo ?? 0,
    },
  };
});
