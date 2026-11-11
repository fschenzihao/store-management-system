import type {
  ExtendTableSessionParams,
  OpenTableSessionParams,
  SettleTableSessionParams,
  TableBoardResult,
  TableSessionResult,
  TableSessionSettlementResult,
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
 * 按座位开台：只写会话并开始计时，不写消费流水、不扣余额
 */
export async function openTableSessionApi(data: OpenTableSessionParams) {
  return requestClient.post<TableSessionResult>('/table-sessions', data);
}

/**
 * 续时：从计划结束时间与当前时间中较晚者继续累加，不扣款
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
 * 结账并关台：按实收金额写消费流水、扣减余额，成功后结束会话并释放座位
 */
export async function settleTableSessionApi(
  sessionId: number,
  data: SettleTableSessionParams,
) {
  return requestClient.post<TableSessionSettlementResult>(
    `/table-sessions/${sessionId}/settle`,
    data,
  );
}

/**
 * 关台（免结账）：直接结束会话并释放座位，不生成流水、不扣款
 */
export async function closeTableSessionApi(sessionId: number) {
  return requestClient.post<{ session: TableSessionView }>(
    `/table-sessions/${sessionId}/close`,
  );
}
