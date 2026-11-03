-- 客户表
-- create_time / update_time 使用 UTC 文本时间，格式为 YYYY-MM-DD HH:MM:SS
-- update_time 由业务逻辑或触发器在更新时刷新
-- wechat_id 允许为空，唯一约束允许多个 NULL 值

CREATE TABLE IF NOT EXISTS customer (
  customer_id INTEGER PRIMARY KEY,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  wechat_id TEXT,
  wechat_name TEXT,
  remark TEXT,
  create_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (customer_phone),
  UNIQUE (wechat_id),
  -- 客户名去空格后不能为空，避免只写入空白字符
  CHECK (length(trim(customer_name)) > 0),
  CHECK (length(customer_name) <= 50),
  CHECK (length(trim(customer_phone)) > 0),
  CHECK (length(customer_phone) <= 20),
  -- wechat_id 允许为空，但不允许写入空白值
  CHECK (wechat_id IS NULL OR length(trim(wechat_id)) > 0),
  CHECK (wechat_id IS NULL OR length(wechat_id) <= 64),
  CHECK (wechat_name IS NULL OR length(wechat_name) <= 100),
  CHECK (remark IS NULL OR length(remark) <= 500),
  -- create_time / update_time 必须是 UTC 文本时间，格式为 YYYY-MM-DD HH:MM:SS
  CHECK (create_time GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]'),
  CHECK (update_time GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]')
) STRICT;

CREATE INDEX IF NOT EXISTS idx_customer_name ON customer (customer_name);
