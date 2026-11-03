import { listConsumptionRecordsByCustomer } from '~/db/dal/consumption-record.ts';
import { listCraftCategories } from '~/db/dal/craft-category.ts';
import { getDatabase } from '~/utils/db.ts';
import {
  defineStoreEventHandler,
  getPositiveIntParam,
  paginate,
  parsePaginationQuery,
  requireCustomer,
} from '~/utils/store-api.ts';

/** GET /api/customers/:customerId/consumptions：客户消费记录分页列表，逐条补齐名称。 */
export default defineStoreEventHandler((event) => {
  const customerId = getPositiveIntParam(event, 'customerId');
  const database = getDatabase();
  const customer = requireCustomer(database, customerId);
  const categoryNames = new Map(
    listCraftCategories(database).map((category) => [
      category.categoryId,
      category.categoryName,
    ]),
  );
  const { page, pageSize } = parsePaginationQuery(event);
  const records = listConsumptionRecordsByCustomer(database, customerId).map(
    (record) => ({
      ...record,
      categoryName:
        categoryNames.get(record.categoryId) ??
        `未知品类（ID: ${record.categoryId}）`,
      customerName: customer.customerName,
    }),
  );
  return paginate(records, page, pageSize);
});
