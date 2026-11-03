import { getCategoryConsumptionStatistics } from '~/db/dal/consumption-record.ts';
import { listCraftCategories } from '~/db/dal/craft-category.ts';
import { getDatabase } from '~/utils/db.ts';
import { defineStoreEventHandler } from '~/utils/store-api.ts';

/** GET /api/consumptions/statistics/by-category：按品类统计消费，补齐品类名。 */
export default defineStoreEventHandler(() => {
  const database = getDatabase();
  const categoryNames = new Map(
    listCraftCategories(database).map((category) => [
      category.categoryId,
      category.categoryName,
    ]),
  );
  return getCategoryConsumptionStatistics(database).map((statistic) => ({
    ...statistic,
    categoryName:
      categoryNames.get(statistic.categoryId) ??
      `未知品类（ID: ${statistic.categoryId}）`,
  }));
});
