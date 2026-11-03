-- 手工品类表
-- create_time 使用 UTC 文本时间，格式为 YYYY-MM-DD HH:MM:SS

CREATE TABLE IF NOT EXISTS craft_category (
  category_id INTEGER PRIMARY KEY,
  category_name TEXT NOT NULL,
  create_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (category_name),
  -- 品类名去空格后不能为空，避免只写入空白字符
  CHECK (length(trim(category_name)) > 0),
  CHECK (length(category_name) <= 50),
  -- create_time 必须是 UTC 文本时间，格式为 YYYY-MM-DD HH:MM:SS
  CHECK (create_time GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]')
) STRICT;
