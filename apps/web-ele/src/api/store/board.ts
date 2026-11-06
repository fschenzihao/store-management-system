import type {
  ExtendTableSessionParams,
  OpenTableSessionParams,
  TableBoardResult,
  TableSessionResult,
  TableSessionView,
} from './types';

import { requestClient } from '#/api/request';

/**
 * 桌位看板数据（18 个座位 + 当日汇总 + 服务端时间）
 */
export async function getTableBoardApi() {
  return requestClient.get<TableBoardResult>('/store-tables');
}

/**
 * 按座位开台，事务内写入会话、消费流水并扣减余额
 */
export async function openTableSessionApi(data: OpenTableSessionParams) {
  return requestClient.post<TableSessionResult>('/table-sessions', data);
}

/**
 * 续时：从计划结束时间与当前时间中较晚者继续累加
 */
export async function extendTableSessionApi(
  sessionId: number,
  data: ExtendTableSessionParams,
) {
  return requestClient.post<TableSessionResult>(
    `/table-sessions/${sessionId}/extend`,
    data,
  );
}

/**
 * 结束会话并释放座位
 */
export async function closeTableSessionApi(sessionId: number) {
  return requestClient.post<{ session: TableSessionView }>(
    `/table-sessions/${sessionId}/close`,
  );
}
