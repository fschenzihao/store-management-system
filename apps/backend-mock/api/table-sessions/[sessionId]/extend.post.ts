import { extendTableSession } from '~/db/table-session-transactions.ts';
import { getDatabase } from '~/utils/db.ts';
import {
  defineStoreEventHandler,
  getPositiveIntParam,
  readJsonBody,
  requireNumberField,
} from '~/utils/store-api.ts';
import { toTableSessionView } from '~/utils/table-session-view.ts';

/** POST /api/table-sessions/:sessionId/extend：续时累加时长与预估金额，不写流水、不扣款。 */
export default defineStoreEventHandler(async (event) => {
  const sessionId = getPositiveIntParam(event, 'sessionId');
  const body = await readJsonBody(event);
  const database = getDatabase();
  const session = extendTableSession(database, sessionId, {
    durationMinutes: requireNumberField(body, 'durationMinutes'),
    estimatedAmountCents: requireNumberField(body, 'estimatedAmountCents'),
  });
  return { session: toTableSessionView(database, session) };
});
