import { listCustomers } from '~/db/dal/customer.ts';
import { getDatabase } from '~/utils/db.ts';
import {
  defineStoreEventHandler,
  getQueryText,
  paginate,
  parsePaginationQuery,
} from '~/utils/store-api.ts';

/** GET /api/customers：客户分页列表，可按客户名、手机号分别模糊查询。 */
export default defineStoreEventHandler((event) => {
  const { page, pageSize } = parsePaginationQuery(event);
  const nameKeyword = getQueryText(event, 'customerName');
  const phoneKeyword = getQueryText(event, 'customerPhone');
  let customers = listCustomers(getDatabase());
  if (nameKeyword) {
    customers = customers.filter((customer) =>
      customer.customerName.toLowerCase().includes(nameKeyword.toLowerCase()),
    );
  }
  if (phoneKeyword) {
    customers = customers.filter((customer) =>
      customer.customerPhone.includes(phoneKeyword),
    );
  }
  return paginate(customers, page, pageSize);
});
