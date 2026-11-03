import { createCraftCategory } from '~/db/dal/craft-category.ts';
import { getDatabase } from '~/utils/db.ts';
import {
  defineStoreEventHandler,
  readJsonBody,
  requireStringField,
} from '~/utils/store-api.ts';

/** POST /api/categories：新增手工品类。 */
export default defineStoreEventHandler(async (event) => {
  const body = await readJsonBody(event);
  return createCraftCategory(getDatabase(), {
    categoryName: requireStringField(body, 'categoryName'),
  });
});
