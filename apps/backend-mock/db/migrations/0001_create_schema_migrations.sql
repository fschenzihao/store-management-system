-- 迁移版本记录表
-- 用于记录已经执行过的 SQL 迁移文件，避免重复执行
-- executed_at 使用 UTC 文本时间，格式为 YYYY-MM-DD HH:MM:SS

CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  executed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (length(trim(version)) > 0),
  CHECK (length(trim(name)) > 0),
  -- executed_at 必须是 UTC 文本时间，格式为 YYYY-MM-DD HH:MM:SS
  CHECK (executed_at GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]')
) STRICT;
