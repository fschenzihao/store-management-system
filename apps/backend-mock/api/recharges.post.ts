import type { RechargePlatform } from '~/db/dal/recharge-record.ts';

import { createRecharge } from '~/db/transactions.ts';
import { getDatabase } from '~/utils/db.ts';
import {
  defineStoreEventHandler,
  readJsonBody,
  requireCustomer,
  requireNumberField,
  requireStringField,
} from '~/utils/store-api.ts';

/** POST /api/recharges：新增充值，事务提交成功后返回新流水与最新余额。 */
export default defineStoreEventHandler(async (event) => {
  const body = await readJsonBody(event);
  const database = getDatabase();
  const result = createRecharge(database, {
    amountCents: requireNumberField(body, 'amountCents'),
    customerId: requireNumberField(body, 'customerId'),
    // 枚举取值由 createRecharge 的事务校验兜底
    platform: requireStringField(body, 'platform') as RechargePlatform,
  });
  const customerName = requireCustomer(
    database,
    result.rechargeRecord.customerId,
  ).customerName;
  return {
    account: { ...result.account, customerName },
    rechargeRecord: { ...result.rechargeRecord, customerName },
  };
});
