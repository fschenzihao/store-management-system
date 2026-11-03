import type BetterSqlite3 from 'better-sqlite3';

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { createDatabase, resolveDatabasePath } from '../utils/db.ts';
import { loadEnvFiles } from '../utils/env.ts';

/**
 * 初始化数据种子命令：pnpm db:seed
 *
 * - 按文件名升序执行 `db/seed` 下的 SQL 文件
 * - 种子 SQL 必须可重复执行（例如 INSERT OR IGNORE），重复运行不会产生重复数据
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
      return;
    }

    for (const seedFile of seedFiles) {
      database.transaction(() => database.exec(seedFile.sql))();
      console.log(`已执行：${seedFile.fileName}`);
    }
    console.log(`种子数据执行完成，共 ${seedFiles.length} 个文件。`);
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
