import { deleteCraftCategory } from '~/db/dal/craft-category.ts';
import { getDatabase } from '~/utils/db.ts';
import {
  defineStoreEventHandler,
  getPositiveIntParam,
} from '~/utils/store-api.ts';

/** DELETE /api/categories/:categoryId：删除手工品类，已有消费记录时拒绝。 */
export default defineStoreEventHandler((event) => {
  deleteCraftCategory(getDatabase(), getPositiveIntParam(event, 'categoryId'));
  return null;
});
