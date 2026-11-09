-- 系统设置（键值对）
-- 当前记录默认客户（default_customer_id）与默认手工品类（default_category_id）
-- setting_value 允许为空，NULL 表示该项未配置；非空时仅允许十进制数字文本
-- 配置键名白名单与取值引用完整性由业务层维护，数据库不建立外键
-- create_time / update_time 使用 UTC 文本时间，格式为 YYYY-MM-DD HH:MM:SS

CREATE TABLE IF NOT EXISTS system_setting (
  setting_key TEXT NOT NULL PRIMARY KEY,
  setting_value TEXT,
  remark TEXT,
  create_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- 配置键去空格后不能为空
  CHECK (length(trim(setting_key)) > 0),
  CHECK (length(setting_key) <= 50),
  -- 配置值允许为空；非空时去空格后不能为空且长度受限
  CHECK (setting_value IS NULL OR (length(trim(setting_value)) > 0 AND length(setting_value) <= 200)),
  -- 配置值非空时必须是十进制数字文本，避免写入无法解析的脏值
  CHECK (setting_value IS NULL OR (setting_value GLOB '[0-9]*' AND setting_value NOT GLOB '*[^0-9]*')),
  CHECK (remark IS NULL OR length(remark) <= 500),
  -- create_time、update_time 必须是 UTC 文本时间，格式为 YYYY-MM-DD HH:MM:SS
  CHECK (create_time GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]'),
  CHECK (update_time GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]')
) STRICT;
