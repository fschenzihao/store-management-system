import { updateCraftCategory } from '~/db/dal/craft-category.ts';
import { getDatabase } from '~/utils/db.ts';
import {
  defineStoreEventHandler,
  getPositiveIntParam,
  readJsonBody,
  requireStringField,
} from '~/utils/store-api.ts';

/** PUT /api/categories/:categoryId：修改手工品类名。 */
export default defineStoreEventHandler(async (event) => {
  const categoryId = getPositiveIntParam(event, 'categoryId');
  const body = await readJsonBody(event);
  return updateCraftCategory(getDatabase(), categoryId, {
    categoryName: requireStringField(body, 'categoryName'),
  });
});
