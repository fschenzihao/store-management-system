import type {
  CreateRechargeParams,
  PageParams,
  PageResult,
  RechargeListParams,
  RechargeRecord,
  RechargeTransactionResult,
} from './types';

import { requestClient } from '#/api/request';

/**
 * 充值记录列表，可按客户、平台、UTC 时间范围过滤
 */
export async function getRechargeListApi(params?: RechargeListParams) {
  return requestClient.get<PageResult<RechargeRecord>>('/recharges', {
    params,
  });
}

/**
 * 客户充值记录列表
 */
export async function getCustomerRechargeListApi(
  customerId: number,
  params?: PageParams,
) {
  return requestClient.get<PageResult<RechargeRecord>>(
    `/customers/${customerId}/recharges`,
    { params },
  );
}

/**
 * 新增充值（事务提交成功后返回新流水与最新余额）
 */
export async function createRechargeApi(data: CreateRechargeParams) {
  return requestClient.post<RechargeTransactionResult>('/recharges', data);
}
