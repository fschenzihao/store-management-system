-- 客户账户表
-- balance_cents 以人民币分为单位
-- customer_id 同时作为主键和外键，保证客户与账户一对一
-- 外键实际生效需要在数据库连接中启用 PRAGMA foreign_keys = ON

CREATE TABLE IF NOT EXISTS customer_account (
  customer_id INTEGER PRIMARY KEY,
  balance_cents INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (customer_id) REFERENCES customer (customer_id) ON DELETE RESTRICT,
  CHECK (balance_cents >= 0)
) STRICT;
