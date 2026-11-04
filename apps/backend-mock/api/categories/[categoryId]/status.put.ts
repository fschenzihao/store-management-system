import { setCraftCategoryStatus } from '~/db/dal/craft-category.ts';
import { getDatabase } from '~/utils/db.ts';
import {
  defineStoreEventHandler,
  getPositiveIntParam,
  readJsonBody,
  requireNumberField,
} from '~/utils/store-api.ts';

/** PUT /api/categories/:categoryId/status：切换品类上架/下架状态。 */
export default defineStoreEventHandler(async (event) => {
  const categoryId = getPositiveIntParam(event, 'categoryId');
  const body = await readJsonBody(event);
  return setCraftCategoryStatus(
    getDatabase(),
    categoryId,
    requireNumberField(body, 'status'),
  );
});
