import { closeTableSession } from '~/db/table-session-transactions.ts';
import { getDatabase } from '~/utils/db.ts';
import {
  defineStoreEventHandler,
  getPositiveIntParam,
} from '~/utils/store-api.ts';
import { toTableSessionView } from '~/utils/table-session-view.ts';

/**
 * POST /api/table-sessions/:sessionId/close：关台（免结账）。
 *
 * 直接结束会话并释放座位，不生成消费流水、不扣减余额；
 * 需要收款时改用 `POST /api/table-sessions/:sessionId/settle`。
 */
export default defineStoreEventHandler((event) => {
  const sessionId = getPositiveIntParam(event, 'sessionId');
  const database = getDatabase();
  const session = closeTableSession(database, sessionId);
  return { session: toTableSessionView(database, session) };
});
