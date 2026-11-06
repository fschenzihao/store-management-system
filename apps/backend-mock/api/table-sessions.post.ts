import { getStoreTable } from '~/db/dal/store-table.ts';
import { openTableSession } from '~/db/table-session-transactions.ts';
import { getDatabase } from '~/utils/db.ts';
import {
  defineStoreEventHandler,
  getCategoryName,
  readJsonBody,
  requireCustomer,
  requireNumberField,
} from '~/utils/store-api.ts';

/** POST /api/table-sessions：按座位开台，事务提交成功后返回会话与最新余额。 */
export default defineStoreEventHandler(async (event) => {
  const body = await readJsonBody(event);
  const database = getDatabase();
  const result = openTableSession(database, {
    categoryId: requireNumberField(body, 'categoryId'),
    consumptionAmountCents: requireNumberField(body, 'consumptionAmountCents'),
    customerId: requireNumberField(body, 'customerId'),
    durationMinutes: requireNumberField(body, 'durationMinutes'),
    tableId: requireNumberField(body, 'tableId'),
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
