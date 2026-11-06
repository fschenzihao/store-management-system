import type BetterSqlite3 from 'better-sqlite3';

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { createDatabase, resolveDatabasePath } from '../utils/db.ts';
import { loadEnvFiles } from '../utils/env.ts';

/**
 * 数据库迁移执行命令：pnpm db:migrate
 *
 * - 按文件名升序执行 `db/migrations` 下尚未记录的 SQL 文件
 * - 每个迁移文件与其版本记录在同一事务中提交，任一语句失败整体回滚
 * - 已记录版本不会重复执行，重复运行命令是安全的
 */

const MIGRATIONS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'migrations',
);

const MIGRATION_FILE_PATTERN = /^(?<version>\d+)_(?<name>[\w-]+)\.sql$/;

interface MigrationFile {
  fileName: string;
  name: string;
  sql: string;
  version: string;
}

function readMigrationFiles(): MigrationFile[] {
  const migrations = readdirSync(MIGRATIONS_DIR)
    .filter((fileName) => fileName.endsWith('.sql'))
    .toSorted((a, b) => a.localeCompare(b))
    .map((fileName) => {
      const groups = MIGRATION_FILE_PATTERN.exec(fileName)?.groups;
      if (!groups?.name || !groups.version) {
        throw new Error(
          `迁移文件名不合规：${fileName}，应命名为 <版本号>_<名称>.sql，例如 0001_create_schema_migrations.sql`,
        );
      }
      return {
        fileName,
        name: groups.name,
        sql: readFileSync(path.join(MIGRATIONS_DIR, fileName), 'utf8'),
        version: groups.version,
      };
    });

  // 版本号必须唯一：重复版本会导致同名版本中仅第一个文件被执行，其余被静默跳过
  const duplicateVersions = migrations
    .map((migration) => migration.version)
    .filter((version, index, versions) => versions.indexOf(version) !== index);
  if (duplicateVersions.length > 0) {
    throw new Error(
      `迁移版本号重复：${[...new Set(duplicateVersions)].join(', ')}，请修正迁移文件名的版本号后再执行`,
    );
  }

  return migrations;
}

function tableExists(
  database: BetterSqlite3.Database,
  tableName: string,
): boolean {
  const row = database
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(tableName);
  return Boolean(row);
}

/** 读取已记录的迁移版本；首次运行时版本表尚不存在，视为空集合 */
function readAppliedVersions(database: BetterSqlite3.Database): Set<string> {
  if (!tableExists(database, 'schema_migrations')) {
    return new Set();
  }
  const rows = database
    .prepare('SELECT version FROM schema_migrations ORDER BY version')
    .all() as { version: string }[];
  return new Set(rows.map((row) => row.version));
}

function runMigrations(database: BetterSqlite3.Database): number {
  const appliedVersions = readAppliedVersions(database);
  const migrations = readMigrationFiles();

  console.log(`已记录迁移：${appliedVersions.size} 个`);

  const missingFiles = [...appliedVersions].filter(
    (version) => !migrations.some((migration) => migration.version === version),
  );
  if (missingFiles.length > 0) {
    console.warn(
      `警告：以下版本已记录但缺少对应迁移文件：${missingFiles.join(', ')}。迁移文件只允许新增，请勿删除已合并的迁移文件。`,
    );
  }

  let appliedCount = 0;
  for (const migration of migrations) {
    if (appliedVersions.has(migration.version)) {
      continue;
    }
    database.transaction(() => {
      database.exec(migration.sql);
      database
        .prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)')
        .run(migration.version, migration.name);
    })();
    appliedCount += 1;
    console.log(`已应用：${migration.fileName}`);
  }

  return appliedCount;
}

function main(): void {
  loadEnvFiles();

  const databasePath = resolveDatabasePath();
  console.log(`数据库文件：${databasePath}`);

  const database = createDatabase(databasePath);
  try {
    const appliedCount = runMigrations(database);
    console.log(
      appliedCount === 0
        ? '没有待执行的迁移，数据库结构已是最新。'
        : `迁移完成，共应用 ${appliedCount} 个迁移文件。`,
    );
  } finally {
    database.close();
  }
}

try {
  main();
} catch (error) {
  console.error('迁移失败：', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
