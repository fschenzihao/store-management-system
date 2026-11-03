import { getCustomerAccount } from '~/db/dal/customer-account.ts';
import { listRechargeRecordsByCustomer } from '~/db/dal/recharge-record.ts';
import { BusinessError } from '~/db/dal/shared.ts';
import { getDatabase } from '~/utils/db.ts';
import {
  defineStoreEventHandler,
  getPositiveIntParam,
  paginate,
  parsePaginationQuery,
  requireCustomer,
} from '~/utils/store-api.ts';

/** GET /api/customers/:customerId/recharges：客户充值记录分页列表。 */
export default defineStoreEventHandler((event) => {
  const customerId = getPositiveIntParam(event, 'customerId');
  const database = getDatabase();
  const customer = requireCustomer(database, customerId);
  const account = getCustomerAccount(database, customerId);
  if (!account) {
    throw new BusinessError(
      'CUSTOMER_ACCOUNT_NOT_FOUND',
      `客户账户不存在（客户 ID: ${customerId}）`,
    );
  }
  const { page, pageSize } = parsePaginationQuery(event);
  const records = listRechargeRecordsByCustomer(database, customerId).map(
    (record) => ({ ...record, customerName: customer.customerName }),
  );
  return paginate(records, page, pageSize);
});
