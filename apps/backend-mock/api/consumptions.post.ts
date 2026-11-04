import { createConsumption } from '~/db/transactions.ts';
import { getDatabase } from '~/utils/db.ts';
import {
  defineStoreEventHandler,
  getCategoryName,
  optionalNumberField,
  readJsonBody,
  requireCustomer,
  requireNumberField,
} from '~/utils/store-api.ts';

/** POST /api/consumptions：新增消费，事务提交成功后返回新流水与最新余额。 */
export default defineStoreEventHandler(async (event) => {
  const body = await readJsonBody(event);
  const database = getDatabase();
  const result = createConsumption(database, {
    categoryId: requireNumberField(body, 'categoryId'),
    consumptionAmountCents: requireNumberField(body, 'consumptionAmountCents'),
    customerId: requireNumberField(body, 'customerId'),
    durationMinutes: requireNumberField(body, 'durationMinutes'),
    isFullDay: optionalNumberField(body, 'isFullDay'),
    tableNumber: optionalNumberField(body, 'tableNumber'),
  });
  const customerName = requireCustomer(
    database,
    result.consumptionRecord.customerId,
  ).customerName;
  const categoryName = getCategoryName(
    database,
    result.consumptionRecord.categoryId,
  );
  return {
    account: { ...result.account, customerName },
    consumptionRecord: {
      ...result.consumptionRecord,
      categoryName,
      customerName,
    },
  };
});
