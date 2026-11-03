import type { CategoryListParams, CraftCategory, PageResult } from './types';

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
export async function createCategoryApi(data: { categoryName: string }) {
  return requestClient.post<CraftCategory>('/categories', data);
}

/**
 * 修改手工品类
 */
export async function updateCategoryApi(
  categoryId: number,
  data: { categoryName: string },
) {
  return requestClient.put<CraftCategory>(`/categories/${categoryId}`, data);
}

/**
 * 删除手工品类
 */
export async function deleteCategoryApi(categoryId: number) {
  return requestClient.delete<null>(`/categories/${categoryId}`);
}
