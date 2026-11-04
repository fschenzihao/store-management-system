import {
  listCraftCategories,
  normalizeCraftCategoryStatus,
} from '~/db/dal/craft-category.ts';
import { getDatabase } from '~/utils/db.ts';
import {
  defineStoreEventHandler,
  getQueryText,
  paginate,
  parsePaginationQuery,
} from '~/utils/store-api.ts';

/** GET /api/categories：品类分页列表，可按品类名模糊查询、按状态过滤。 */
export default defineStoreEventHandler((event) => {
  const { page, pageSize } = parsePaginationQuery(event);
  const keyword = getQueryText(event, 'categoryName');
  const statusRaw = getQueryText(event, 'status');
  // 传入非法状态值时由 normalize 抛出 INVALID_INPUT
  const status =
    statusRaw === undefined
      ? undefined
      : normalizeCraftCategoryStatus(Number(statusRaw), 'status');
  const categories = listCraftCategories(getDatabase(), { status });
  const filtered = keyword
    ? categories.filter((category) =>
        category.categoryName.toLowerCase().includes(keyword.toLowerCase()),
      )
    : categories;
  return paginate(filtered, page, pageSize);
});
