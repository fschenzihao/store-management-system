import { getStoreSetting } from '~/db/dal/system-setting.ts';
import { getDatabase } from '~/utils/db.ts';
import { defineStoreEventHandler } from '~/utils/store-api.ts';

/** GET /api/settings：读取系统设置，未配置的项返回 null。 */
export default defineStoreEventHandler(() => getStoreSetting(getDatabase()));
