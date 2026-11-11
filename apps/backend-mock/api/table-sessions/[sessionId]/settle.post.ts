import { settleTableSession } from '~/db/table-session-transactions.ts';
import { getDatabase } from '~/utils/db.ts';
import {
  defineStoreEventHandler,
  getPositiveIntParam,
  readJsonBody,
  requireNumberField,
} from '~/utils/store-api.ts';
import { toTableSessionView } from '~/utils/table-session-view.ts';

/**
 * POST /api/table-sessions/:sessionId/settle：结账并关台。
 *
 * 按实收金额写入一条消费流水、扣减余额，成功后会话结束、座位释放；
 * 余额不足时整体回滚，会话保持使用中。
 */
export default defineStoreEventHandler(async (event) => {
  const sessionId = getPositiveIntParam(event, 'sessionId');
  const body = await readJsonBody(event);
  const database = getDatabase();
  const result = settleTableSession(database, sessionId, {
    amountCents: requireNumberField(body, 'amountCents'),
  });
  const session = toTableSessionView(database, result.session);
  return {
    account: { ...result.account, customerName: session.customerName },
    consumptionRecord: {
      ...result.consumptionRecord,
      categoryName: session.categoryName,
      customerName: session.customerName,
    },
    session,
  };
});
