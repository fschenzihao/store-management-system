import { saveStoreSetting } from '~/db/dal/system-setting.ts';
import { getDatabase } from '~/utils/db.ts';
import {
  defineStoreEventHandler,
  optionalNullableNumberField,
  readJsonBody,
} from '~/utils/store-api.ts';

/** PUT /api/settings：保存系统设置；字段省略表示不修改，传 null 表示清空。 */
export default defineStoreEventHandler(async (event) => {
  const body = await readJsonBody(event);
  return saveStoreSetting(getDatabase(), {
    defaultCategoryId: optionalNullableNumberField(body, 'defaultCategoryId'),
    defaultCustomerId: optionalNullableNumberField(body, 'defaultCustomerId'),
  });
});
