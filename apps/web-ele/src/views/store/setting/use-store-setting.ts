import type { StoreSetting } from '#/api/store';

import { getStoreSettingApi } from '#/api/store';

/** 未配置任何默认值时的空设置。 */
export const EMPTY_STORE_SETTING: StoreSetting = {
  defaultCategoryId: null,
  defaultCategoryName: null,
  defaultCustomerId: null,
  defaultCustomerName: null,
  updateTime: null,
};

/**
 * 系统设置的前端缓存。
 *
 * 设置只在「系统设置」页修改，开台与新增消费弹窗打开时读取即可；
 * 使用模块级 Promise 缓存避免每次打开弹窗重复请求，保存设置后调用
 * clearStoreSettingCache() 使缓存失效。
 */
let settingPromise: null | Promise<StoreSetting> = null;

/** 读取系统设置；读取失败时按未配置处理，且不缓存失败结果以便下次重试。 */
export function loadStoreSetting(): Promise<StoreSetting> {
  settingPromise ??= getStoreSettingApi().catch((error: unknown) => {
    // 默认值读取失败不阻塞开台与消费主流程，回退为未配置
    console.error('[store-setting] 读取系统设置失败：', error);
    settingPromise = null;
    return EMPTY_STORE_SETTING;
  });
  return settingPromise;
}

/** 清空缓存，保存设置后调用。 */
export function clearStoreSettingCache(): void {
  settingPromise = null;
}
