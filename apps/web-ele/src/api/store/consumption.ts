import type {
  CategoryConsumptionStatistic,
  ConsumptionRecord,
  ConsumptionTransactionResult,
  CreateConsumptionParams,
  PageParams,
  PageResult,
} from './types';

import { requestClient } from '#/api/request';

/**
 * 客户消费记录列表
 */
export async function getCustomerConsumptionListApi(
  customerId: number,
  params?: PageParams,
) {
  return requestClient.get<PageResult<ConsumptionRecord>>(
    `/customers/${customerId}/consumptions`,
    { params },
  );
}

/**
 * 新增消费（事务提交成功后返回新流水与最新余额）
 */
export async function createConsumptionApi(data: CreateConsumptionParams) {
  return requestClient.post<ConsumptionTransactionResult>(
    '/consumptions',
    data,
  );
}

/**
 * 按品类统计消费
 */
export async function getCategoryStatisticsApi() {
  return requestClient.get<CategoryConsumptionStatistic[]>(
    '/consumptions/statistics/by-category',
  );
}
