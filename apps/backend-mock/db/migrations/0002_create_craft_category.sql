-- 手工品类表
-- create_time 使用 UTC 文本时间，格式为 YYYY-MM-DD HH:MM:SS

CREATE TABLE IF NOT EXISTS craft_category (
  category_id INTEGER PRIMARY KEY,
  category_name TEXT NOT NULL,
  create_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (category_name),
  CHECK (length(category_name) > 0),
  CHECK (length(category_name) <= 50)
) STRICT;
