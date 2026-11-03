import type BetterSqlite3 from 'better-sqlite3';

export interface CustomerAccount {
  balanceCents: number;
  customerId: number;
}

interface CustomerAccountRow {
  balance_cents: number;
  customer_id: number;
}

function mapCustomerAccount(row: CustomerAccountRow): CustomerAccount {
  return {
    balanceCents: row.balance_cents,
    customerId: row.customer_id,
  };
}

export function getCustomerAccount(
  database: BetterSqlite3.Database,
  customerId: number,
): CustomerAccount | null {
  const row = database
    .prepare('SELECT * FROM customer_account WHERE customer_id = ?')
    .get(customerId) as CustomerAccountRow | undefined;
  return row ? mapCustomerAccount(row) : null;
}

export function listCustomerAccounts(
  database: BetterSqlite3.Database,
): CustomerAccount[] {
  const rows = database
    .prepare('SELECT * FROM customer_account ORDER BY customer_id')
    .all() as CustomerAccountRow[];
  return rows.map((row) => mapCustomerAccount(row));
}
