import { createCustomer } from '~/db/dal/customer.ts';
import { getDatabase } from '~/utils/db.ts';
import {
  defineStoreEventHandler,
  optionalTextField,
  readJsonBody,
  requireStringField,
} from '~/utils/store-api.ts';

/** POST /api/customers：新增客户，同一事务中创建零余额账户。 */
export default defineStoreEventHandler(async (event) => {
  const body = await readJsonBody(event);
  const result = createCustomer(getDatabase(), {
    customerName: requireStringField(body, 'customerName'),
    customerPhone: requireStringField(body, 'customerPhone'),
    remark: optionalTextField(body, 'remark'),
    wechatId: optionalTextField(body, 'wechatId'),
    wechatName: optionalTextField(body, 'wechatName'),
  });
  return {
    account: { ...result.account, customerName: result.customer.customerName },
    customer: result.customer,
  };
});
