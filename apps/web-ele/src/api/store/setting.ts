import type { StoreSetting, UpdateStoreSettingParams } from './types';

import { requestClient } from '#/api/request';

/**
 * 系统设置（默认客户、默认手工品类）
 */
export async function getStoreSettingApi() {
  return requestClient.get<StoreSetting>('/settings');
}

/**
 * 保存系统设置
 */
export async function updateStoreSettingApi(data: UpdateStoreSettingParams) {
  return requestClient.put<StoreSetting>('/settings', data);
}
