import { getUtcTimestamp } from '~/db/dal/shared.ts';
import {
  getTableBoardSummary,
  listTableBoard,
} from '~/db/dal/table-session.ts';
import { getDatabase } from '~/utils/db.ts';
import { defineStoreEventHandler } from '~/utils/store-api.ts';

/**
 * GET /api/store-tables：桌位看板数据。
 *
 * 固定返回 18 个座位（含进行中会话的客户与品类信息）、当日汇总，
 * 并附带服务端 UTC 时间供前端校准倒计时。
 */
export default defineStoreEventHandler(() => {
  const database = getDatabase();
  const tables = listTableBoard(database);
  const activeCount = tables.filter((item) => item.session !== null).length;
  return {
    serverTime: getUtcTimestamp(),
    summary: getTableBoardSummary(database, activeCount),
    tables,
  };
});
