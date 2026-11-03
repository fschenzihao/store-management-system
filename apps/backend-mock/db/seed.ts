 
import type BetterSqlite3 from 'better-sqlite3';

import type { RechargePlatform } from './dal/recharge-record.ts';

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { createDatabase, resolveDatabasePath } from '../utils/db.ts';
import { loadEnvFiles } from '../utils/env.ts';
import { listCraftCategories } from './dal/craft-category.ts';
import { createCustomer } from './dal/customer.ts';
import { createConsumption, createRecharge } from './transactions.ts';

/**
 * 初始化数据种子命令：pnpm db:seed
 *
 * - 按文件名升序执行 `db/seed` 下的 SQL 文件
 * - 种子 SQL 必须可重复执行（例如 INSERT OR IGNORE），重复运行不会产生重复数据
 * - 客户、充值、消费示例数据复用 `createCustomer`、`createRecharge`、`createConsumption`，
 *   余额与流水的一致性由事务保证；以手机号判断幂等，已存在的客户整体跳过
 * - 执行前需先完成迁移：pnpm db:migrate
 */

const SEED_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'seed',
);

function readSeedFiles(): { fileName: string; sql: string }[] {
  return readdirSync(SEED_DIR)
    .filter((fileName) => fileName.endsWith('.sql'))
    .toSorted((a, b) => a.localeCompare(b))
    .map((fileName) => ({
      fileName,
      sql: readFileSync(path.join(SEED_DIR, fileName), 'utf8'),
    }));
}

interface MockRecharge {
  amountCents: number;
  platform: RechargePlatform;
}

interface MockConsumption {
  categoryName: string;
  consumptionAmountCents: number;
  durationMinutes: number;
}

interface MockCustomer {
  consumptions: MockConsumption[];
  customerName: string;
  customerPhone: string;
  recharges: MockRecharge[];
  remark: null | string;
  wechatId: null | string;
  wechatName: null | string;
}

/** 客户、充值、消费示例数据，金额单位为分，按手机号幂等。 */
const MOCK_CUSTOMERS: MockCustomer[] = [
  {
    consumptions: [
      {
        categoryName: '拼豆',
        consumptionAmountCents: 5800,
        durationMinutes: 90,
      },
    ],
    customerName: '王小雅',
    customerPhone: '13800000001',
    recharges: [
      { amountCents: 20_000, platform: '微信' },
      { amountCents: 10_000, platform: '支付宝' },
    ],
    remark: '喜欢拼豆挂件，常周末到店',
    wechatId: 'wx_wangxiaoya',
    wechatName: '小雅手工',
  },
  {
    consumptions: [
      {
        categoryName: '奶油胶',
        consumptionAmountCents: 12_000,
        durationMinutes: 75,
      },
      {
        categoryName: '拼豆',
        consumptionAmountCents: 3000,
        durationMinutes: 45,
      },
    ],
    customerName: '李甜甜',
    customerPhone: '13800000002',
    recharges: [{ amountCents: 50_000, platform: '支付宝' }],
    remark: null,
    wechatId: 'wx_litiantian',
    wechatName: '甜甜圈',
  },
  {
    consumptions: [],
    customerName: '张萌萌',
    customerPhone: '13800000003',
    recharges: [{ amountCents: 10_000, platform: '现金' }],
    remark: '仅充值未消费',
    wechatId: null,
    wechatName: null,
  },
  {
    consumptions: [
      {
        categoryName: '马赛克',
        consumptionAmountCents: 8800,
        durationMinutes: 120,
      },
    ],
    customerName: '陈静怡',
    customerPhone: '13800000004',
    recharges: [
      { amountCents: 30_000, platform: '微信' },
      { amountCents: 20_000, platform: '支付宝' },
    ],
    remark: null,
    wechatId: 'wx_chenjingyi',
    wechatName: '静静',
  },
  {
    consumptions: [],
    customerName: '刘小慧',
    customerPhone: '13800000005',
    recharges: [],
    remark: '新客户，尚未充值',
    wechatId: null,
    wechatName: null,
  },
  {
    consumptions: [
      {
        categoryName: '黏土',
        consumptionAmountCents: 20_000,
        durationMinutes: 100,
      },
      {
        categoryName: '布艺',
        consumptionAmountCents: 15_600,
        durationMinutes: 80,
      },
      {
        categoryName: '拼豆',
        consumptionAmountCents: 9900,
        durationMinutes: 60,
      },
    ],
    customerName: '赵一诺',
    customerPhone: '13800000006',
    recharges: [{ amountCents: 100_000, platform: '微信' }],
    remark: '老客户，消费频率高',
    wechatId: 'wx_zhaoyinuo',
    wechatName: '一诺千金',
  },
];

function customerExistsByPhone(
  database: BetterSqlite3.Database,
  customerPhone: string,
): boolean {
  return Boolean(
    database
      .prepare('SELECT 1 FROM customer WHERE customer_phone = ? LIMIT 1')
      .get(customerPhone),
  );
}

/** 写入客户、充值、消费示例数据；单个客户建档与其全部流水在同一事务中完成。 */
function seedBusinessMockData(database: BetterSqlite3.Database): void {
  const categories = new Map(
    listCraftCategories(database).map((category) => [
      category.categoryName,
      category.categoryId,
    ]),
  );
  let created = 0;
  for (const mock of MOCK_CUSTOMERS) {
    database.transaction(() => {
      if (customerExistsByPhone(database, mock.customerPhone)) {
        return;
      }
      const { customer } = createCustomer(database, {
        customerName: mock.customerName,
        customerPhone: mock.customerPhone,
        remark: mock.remark,
        wechatId: mock.wechatId,
        wechatName: mock.wechatName,
      });
      for (const recharge of mock.recharges) {
        createRecharge(database, {
          amountCents: recharge.amountCents,
          customerId: customer.customerId,
          platform: recharge.platform,
        });
      }
      for (const consumption of mock.consumptions) {
        const categoryId = categories.get(consumption.categoryName);
        if (categoryId === undefined) {
          console.warn(
            `种子品类缺失，跳过消费示例：${consumption.categoryName}`,
          );
          return;
        }
        createConsumption(database, {
          categoryId,
          consumptionAmountCents: consumption.consumptionAmountCents,
          customerId: customer.customerId,
          durationMinutes: consumption.durationMinutes,
        });
      }
      created += 1;
    })();
  }
  console.log(`业务 mock 数据处理完成，本次新增客户 ${created} 位。`);
}

function main(): void {
  loadEnvFiles();

  const databasePath = resolveDatabasePath();
  console.log(`数据库文件：${databasePath}`);

  const database: BetterSqlite3.Database = createDatabase(databasePath);
  try {
    const migrated = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'craft_category'",
      )
      .get();
    if (!migrated) {
      throw new Error('数据库尚未初始化，请先执行 pnpm db:migrate');
    }

    const seedFiles = readSeedFiles();
    if (seedFiles.length === 0) {
      console.log('没有可执行的种子文件。');
    } else {
      for (const seedFile of seedFiles) {
        database.transaction(() => database.exec(seedFile.sql))();
        console.log(`已执行：${seedFile.fileName}`);
      }
      console.log(`种子数据执行完成，共 ${seedFiles.length} 个文件。`);
    }

    seedBusinessMockData(database);
  } finally {
    database.close();
  }
}

try {
  main();
} catch (error) {
  console.error(
    '种子数据执行失败：',
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
}
