import { openTableSession } from '~/db/table-session-transactions.ts';
import { getDatabase } from '~/utils/db.ts';
import {
  defineStoreEventHandler,
  optionalNumberField,
  readJsonBody,
  requireNumberField,
} from '~/utils/store-api.ts';
import { toTableSessionView } from '~/utils/table-session-view.ts';

/**
 * POST /api/table-sessions：按座位开台，只写会话并开始计时，不写流水、不扣款。
 *
 * `timingMode` 为 1（默认）时按 `durationMinutes` 倒计时；
 * 为 2 时进入实际计时模式，`durationMinutes` 可省略或传 0，结账按实际用时结算。
 */
export default defineStoreEventHandler(async (event) => {
  const body = await readJsonBody(event);
  const database = getDatabase();
  const session = openTableSession(database, {
    categoryId: requireNumberField(body, 'categoryId'),
    customerId: requireNumberField(body, 'customerId'),
    durationMinutes: optionalNumberField(body, 'durationMinutes'),
    estimatedAmountCents: requireNumberField(body, 'estimatedAmountCents'),
    tableId: requireNumberField(body, 'tableId'),
    timingMode: optionalNumberField(body, 'timingMode'),
  });
  return { session: toTableSessionView(database, session) };
});
