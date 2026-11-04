import type { H3Event } from 'h3';

import { listConsumptionRecords } from '~/db/dal/consumption-record.ts';
import { listCraftCategories } from '~/db/dal/craft-category.ts';
import { listCustomers } from '~/db/dal/customer.ts';
import { BusinessError } from '~/db/dal/shared.ts';
import { getDatabase } from '~/utils/db.ts';
import {
  defineStoreEventHandler,
  getQueryText,
  paginate,
  parsePaginationQuery,
} from '~/utils/store-api.ts';

function parsePositiveIntQuery(
  event: H3Event,
  key: string,
): number | undefined {
  const text = getQueryText(event, key);
  if (text === undefined) {
    return undefined;
  }
  if (!/^\d+$/.test(text)) {
    throw new BusinessError('INVALID_INPUT', `${key} 必须为大于 0 的整数`);
  }
  const value = Number(text);
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new BusinessError('INVALID_INPUT', `${key} 必须为大于 0 的整数`);
  }
  return value;
}

/** GET /api/consumptions：全局消费记录分页列表，可按客户、手工品类过滤。 */
export default defineStoreEventHandler((event) => {
  const { page, pageSize } = parsePaginationQuery(event);
  const customerId = parsePositiveIntQuery(event, 'customerId');
  const categoryId = parsePositiveIntQuery(event, 'categoryId');
  const nameKeyword = getQueryText(event, 'customerName');
  const database = getDatabase();

  const customerNames = new Map(
    listCustomers(database).map((customer) => [
      customer.customerId,
      customer.customerName,
    ]),
  );
  const categoryNames = new Map(
    listCraftCategories(database).map((category) => [
      category.categoryId,
      category.categoryName,
    ]),
  );

  let records = listConsumptionRecords(database, {
    categoryId,
    customerId,
  }).map((record) => ({
    ...record,
    categoryName:
      categoryNames.get(record.categoryId) ??
      `未知品类（ID: ${record.categoryId}）`,
    customerName:
      customerNames.get(record.customerId) ??
      `未知客户（ID: ${record.customerId}）`,
  }));
  if (nameKeyword) {
    const keyword = nameKeyword.toLowerCase();
    records = records.filter((record) =>
      record.customerName.toLowerCase().includes(keyword),
    );
  }
  return paginate(records, page, pageSize);
});
