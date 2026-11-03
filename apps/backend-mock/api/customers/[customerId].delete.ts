import { deleteCustomer } from '~/db/dal/customer.ts';
import { getDatabase } from '~/utils/db.ts';
import {
  defineStoreEventHandler,
  getPositiveIntParam,
} from '~/utils/store-api.ts';

/** DELETE /api/customers/:customerId：删除客户，存在关联数据时拒绝。 */
export default defineStoreEventHandler((event) => {
  deleteCustomer(getDatabase(), getPositiveIntParam(event, 'customerId'));
  return null;
});
