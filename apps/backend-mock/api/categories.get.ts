import { listCraftCategories } from '~/db/dal/craft-category.ts';
import { getDatabase } from '~/utils/db.ts';
import {
  defineStoreEventHandler,
  getQueryText,
  paginate,
  parsePaginationQuery,
} from '~/utils/store-api.ts';

/** GET /api/categories：品类分页列表，可按品类名模糊查询。 */
export default defineStoreEventHandler((event) => {
  const { page, pageSize } = parsePaginationQuery(event);
  const keyword = getQueryText(event, 'categoryName');
  const categories = listCraftCategories(getDatabase());
  const filtered = keyword
    ? categories.filter((category) =>
        category.categoryName.toLowerCase().includes(keyword.toLowerCase()),
      )
    : categories;
  return paginate(filtered, page, pageSize);
});
