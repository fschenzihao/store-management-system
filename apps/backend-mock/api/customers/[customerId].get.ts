import { getCustomerAccount } from '~/db/dal/customer-account.ts';
import { BusinessError } from '~/db/dal/shared.ts';
import { getDatabase } from '~/utils/db.ts';
import {
  defineStoreEventHandler,
  getPositiveIntParam,
  requireCustomer,
} from '~/utils/store-api.ts';

/** GET /api/customers/:customerId：客户详情，含账户信息。 */
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
  return {
    account: { ...account, customerName: customer.customerName },
    customer,
  };
});
