import type {
  CategoryListParams,
  CraftCategory,
  CraftCategoryStatus,
  CreateCategoryParams,
  PageResult,
  UpdateCategoryParams,
} from './types';

import { requestClient } from '#/api/request';

/**
 * 手工品类列表
 */
export async function getCategoryListApi(params: CategoryListParams) {
  return requestClient.get<PageResult<CraftCategory>>('/categories', {
    params,
  });
}

/**
 * 新增手工品类
 */
export async function createCategoryApi(data: CreateCategoryParams) {
  return requestClient.post<CraftCategory>('/categories', data);
}

/**
 * 修改手工品类
 */
export async function updateCategoryApi(
  categoryId: number,
  data: UpdateCategoryParams,
) {
  return requestClient.put<CraftCategory>(`/categories/${categoryId}`, data);
}

/**
 * 切换手工品类上架/下架状态
 */
export async function updateCategoryStatusApi(
  categoryId: number,
  status: CraftCategoryStatus,
) {
  return requestClient.put<CraftCategory>(`/categories/${categoryId}/status`, {
    status,
  });
}

/**
 * 删除手工品类
 */
export async function deleteCategoryApi(categoryId: number) {
  return requestClient.delete<null>(`/categories/${categoryId}`);
}
