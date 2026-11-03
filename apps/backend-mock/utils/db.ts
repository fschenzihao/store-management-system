import { mkdirSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import Database from 'better-sqlite3';

/**
 * SQLite 连接配置
 *
 * - 数据库文件默认位于 `apps/backend-mock/data/store.db`，可通过 `DATABASE_PATH` 覆盖
 * - 相对路径按运行目录解析；Nitro 服务（含 vite dev 的 mock 插件）由
 *   `nitro.config.ts` 将 `DATABASE_PATH` 规范化为包根绝对路径，不依赖启动进程 cwd
 * - 每个连接显式启用外键约束，严格表要求 SQLite 3.37+
 */

/** 严格表、检查约束依赖的最低 SQLite 版本 */
export const MIN_SQLITE_VERSION = '3.37.0';

const DEFAULT_DATABASE_PATH = 'data/store.db';

let defaultDatabase: Database.Database | undefined;

/** 解析数据库文件绝对路径 */
export function resolveDatabasePath(): string {
  const configured = process.env.DATABASE_PATH?.trim() || DEFAULT_DATABASE_PATH;
  if (configured === ':memory:') {
    return configured;
  }
  return path.isAbsolute(configured)
    ? configured
    : path.resolve(process.cwd(), configured);
}

/** 比较两个 `x.y.z` 形式的版本号，返回 `a - b` */
function compareVersion(a: string, b: string): number {
  const left = a.split('.').map(Number);
  const right = b.split('.').map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const diff = (left[index] ?? 0) - (right[index] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

/** 打开数据库连接并统一应用连接级配置 */
export function createDatabase(
  databasePath = resolveDatabasePath(),
): Database.Database {
  if (databasePath !== ':memory:') {
    mkdirSync(path.dirname(databasePath), { recursive: true });
  }

  const database = new Database(databasePath);

  const { version } = database
    .prepare('SELECT sqlite_version() AS version')
    .get() as { version: string };
  if (compareVersion(version, MIN_SQLITE_VERSION) < 0) {
    database.close();
    throw new Error(
      `SQLite 版本过低：当前 ${version}，严格表要求 ${MIN_SQLITE_VERSION} 及以上`,
    );
  }

  // 外键默认关闭，必须每个连接显式开启
  database.pragma('foreign_keys = ON');
  database.pragma('busy_timeout = 5000');
  if (databasePath !== ':memory:') {
    database.pragma('journal_mode = WAL');
  }

  return database;
}

/** 获取进程内共享的默认连接 */
export function getDatabase(): Database.Database {
  defaultDatabase ??= createDatabase();
  return defaultDatabase;
}

/** 关闭默认连接 */
export function closeDatabase(): void {
  defaultDatabase?.close();
  defaultDatabase = undefined;
}
