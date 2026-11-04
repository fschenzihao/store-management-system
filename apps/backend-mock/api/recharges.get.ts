import type { RechargePlatform } from '~/db/dal/recharge-record.ts';

import { listRechargeRecords } from '~/db/dal/recharge-record.ts';
import { BusinessError } from '~/db/dal/shared.ts';
import { getDatabase } from '~/utils/db.ts';
import {
  defineStoreEventHandler,
  getQueryText,
  paginate,
  parsePaginationQuery,
} from '~/utils/store-api.ts';

const PLATFORMS: RechargePlatform[] = new Set(['微信', '支付宝', '现金']);
const TIME_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

/** GET /api/recharges：充值流水分页列表，可按客户、平台、UTC 时间范围过滤。 */
export default defineStoreEventHandler((event) => {
  const { page, pageSize } = parsePaginationQuery(event);

  const customerIdText = getQueryText(event, 'customerId');
  let customerId: number | undefined;
  if (customerIdText !== undefined) {
    if (!/^\d+$/.test(customerIdText)) {
      throw new BusinessError(
        'INVALID_INPUT',
        'customerId 必须为大于 0 的整数',
      );
    }
    customerId = Number(customerIdText);
    if (!Number.isSafeInteger(customerId) || customerId < 1) {
      throw new BusinessError(
        'INVALID_INPUT',
        'customerId 必须为大于 0 的整数',
      );
    }
  }

  const platform = getQueryText(event, 'platform');
  if (platform !== undefined && !PLATFORMS.has(platform as RechargePlatform)) {
    throw new BusinessError('INVALID_INPUT', 'platform 取值无效');
  }

  const startTime = getQueryText(event, 'startTime');
  if (startTime !== undefined && !TIME_PATTERN.test(startTime)) {
    throw new BusinessError(
      'INVALID_INPUT',
      'startTime 必须为 YYYY-MM-DD HH:MM:SS 格式的 UTC 文本',
    );
  }

  const endTime = getQueryText(event, 'endTime');
  if (endTime !== undefined && !TIME_PATTERN.test(endTime)) {
    throw new BusinessError(
      'INVALID_INPUT',
      'endTime 必须为 YYYY-MM-DD HH:MM:SS 格式的 UTC 文本',
    );
  }

  const records = listRechargeRecords(getDatabase(), {
    customerId,
    endTime,
    platform: platform as RechargePlatform | undefined,
    startTime,
  });
  return paginate(records, page, pageSize);
});
