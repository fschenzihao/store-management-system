import type {
  CreateCustomerParams,
  Customer,
  CustomerAccount,
  CustomerDetailResult,
  CustomerListParams,
  PageResult,
  UpdateCustomerParams,
} from './types';

import { requestClient } from '#/api/request';

/**
 * 客户列表
 */
export async function getCustomerListApi(params: CustomerListParams) {
  return requestClient.get<PageResult<Customer>>('/customers', { params });
}

/**
 * 客户详情（含账户）
 */
export async function getCustomerDetailApi(customerId: number) {
  return requestClient.get<CustomerDetailResult>(`/customers/${customerId}`);
}

/**
 * 新增客户（同一事务创建零余额账户）
 */
export async function createCustomerApi(data: CreateCustomerParams) {
  return requestClient.post<CustomerDetailResult>('/customers', data);
}

/**
 * 修改客户
 */
export async function updateCustomerApi(
  customerId: number,
  data: UpdateCustomerParams,
) {
  return requestClient.put<Customer>(`/customers/${customerId}`, data);
}

/**
 * 删除客户
 */
export async function deleteCustomerApi(customerId: number) {
  return requestClient.delete<null>(`/customers/${customerId}`);
}

/**
 * 查询客户账户余额
 */
export async function getCustomerAccountApi(customerId: number) {
  return requestClient.get<CustomerAccount>(`/customers/${customerId}/account`);
}
