import type { UpdateCustomerInput } from '~/db/dal/customer.ts';

import { updateCustomer } from '~/db/dal/customer.ts';
import { BusinessError } from '~/db/dal/shared.ts';
import { getDatabase } from '~/utils/db.ts';
import {
  defineStoreEventHandler,
  getPositiveIntParam,
  optionalTextField,
  readJsonBody,
  requireStringField,
} from '~/utils/store-api.ts';

const UPDATABLE_FIELDS = [
  'customerName',
  'customerPhone',
  'remark',
  'wechatId',
  'wechatName',
] as const;

/** 字段省略表示保持不变，传 null 或空字符串表示清空可选字段。 */
function parseUpdateCustomerInput(
  body: Record<string, unknown>,
): UpdateCustomerInput {
  const provided = UPDATABLE_FIELDS.filter((field) => field in body);
  if (provided.length === 0) {
    throw new BusinessError('INVALID_INPUT', '修改请求至少包含一个客户字段');
  }
  const input: UpdateCustomerInput = {};
  if ('customerName' in body) {
    input.customerName = requireStringField(body, 'customerName');
  }
  if ('customerPhone' in body) {
    input.customerPhone = requireStringField(body, 'customerPhone');
  }
  if ('remark' in body) {
    input.remark = optionalTextField(body, 'remark');
  }
  if ('wechatId' in body) {
    input.wechatId = optionalTextField(body, 'wechatId');
  }
  if ('wechatName' in body) {
    input.wechatName = optionalTextField(body, 'wechatName');
  }
  return input;
}

/** PUT /api/customers/:customerId：修改客户资料。 */
export default defineStoreEventHandler(async (event) => {
  const customerId = getPositiveIntParam(event, 'customerId');
  const body = await readJsonBody(event);
  return updateCustomer(
    getDatabase(),
    customerId,
    parseUpdateCustomerInput(body),
  );
});
