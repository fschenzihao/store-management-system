import { getStoreTable } from '~/db/dal/store-table.ts';
import { extendTableSession } from '~/db/table-session-transactions.ts';
import { getDatabase } from '~/utils/db.ts';
import {
  defineStoreEventHandler,
  getCategoryName,
  getPositiveIntParam,
  readJsonBody,
  requireCustomer,
  requireNumberField,
} from '~/utils/store-api.ts';

/** POST /api/table-sessions/:sessionId/extend：续时并追加消费流水。 */
export default defineStoreEventHandler(async (event) => {
  const sessionId = getPositiveIntParam(event, 'sessionId');
  const body = await readJsonBody(event);
  const database = getDatabase();
  const result = extendTableSession(database, sessionId, {
    consumptionAmountCents: requireNumberField(body, 'consumptionAmountCents'),
    durationMinutes: requireNumberField(body, 'durationMinutes'),
  });
  const customerName = requireCustomer(
    database,
    result.session.customerId,
  ).customerName;
  const categoryName = getCategoryName(database, result.session.categoryId);
  const table = getStoreTable(database, result.session.tableId);
  return {
    account: { ...result.account, customerName },
    consumptionRecord: {
      ...result.consumptionRecord,
      categoryName,
      customerName,
    },
    session: {
      ...result.session,
      categoryName,
      customerName,
      seatNo: table?.seatNo ?? 0,
    },
  };
});
