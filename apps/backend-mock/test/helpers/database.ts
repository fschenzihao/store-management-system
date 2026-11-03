import type BetterSqlite3 from 'better-sqlite3';

import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createDatabase } from '../../utils/db.ts';

const MIGRATIONS_DIRECTORY = fileURLToPath(
  new URL('../../db/migrations/', import.meta.url),
);

export function createTestDatabase(): BetterSqlite3.Database {
  const database = createDatabase(':memory:');
  try {
    const migrationFiles = readdirSync(MIGRATIONS_DIRECTORY)
      .filter((fileName) => fileName.endsWith('.sql'))
      .toSorted();
    for (const fileName of migrationFiles) {
      database.exec(
        readFileSync(path.join(MIGRATIONS_DIRECTORY, fileName), 'utf8'),
      );
    }
    return database;
  } catch (error) {
    database.close();
    throw error;
  }
}
