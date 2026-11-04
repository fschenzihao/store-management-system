-- 手工品类表补充：品类状态、备注、修改时间
-- status 为状态数字枚举：1=上架、2=下架，展示文案由前端映射表/i18n 负责
-- update_time 使用 UTC 文本时间，格式为 YYYY-MM-DD HH:MM:SS，由业务逻辑在更新时刷新

-- 品类状态：存量数据由默认值 1（上架）回填
ALTER TABLE craft_category
  ADD COLUMN status INTEGER NOT NULL DEFAULT 1
  CHECK (status IN (1, 2));

-- 备注：允许为空，但不允许超过 500 字符
ALTER TABLE craft_category
  ADD COLUMN remark TEXT
  CHECK (remark IS NULL OR length(remark) <= 500);

-- 修改时间：ALTER ADD COLUMN 不允许非常量默认值，
-- 先以常量占位，再将存量行统一刷为当前 UTC 时间，后续由业务逻辑维护
ALTER TABLE craft_category
  ADD COLUMN update_time TEXT NOT NULL DEFAULT '1970-01-01 00:00:00'
  CHECK (update_time GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]');

UPDATE craft_category
SET update_time = datetime('now');
