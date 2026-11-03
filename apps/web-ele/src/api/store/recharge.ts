import type {
  CreateRechargeParams,
  PageParams,
  PageResult,
  RechargeRecord,
  RechargeTransactionResult,
} from './types';

import { requestClient } from '#/api/request';

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
