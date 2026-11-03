-- 充值记录表
-- amount_cents 以人民币分为单位
-- recharge_time 使用 UTC 文本时间，格式为 YYYY-MM-DD HH:MM:SS
-- 已产生业务记录的客户不允许直接删除

CREATE TABLE IF NOT EXISTS recharge_record (
  recharge_id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL,
  platform TEXT NOT NULL,
  recharge_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customer (customer_id) ON DELETE RESTRICT,
  CHECK (amount_cents > 0),
  -- 平台去空格后不能为空，且只能取约定的三种取值
  CHECK (length(trim(platform)) > 0),
  CHECK (length(platform) <= 20),
  CHECK (platform IN ('微信', '支付宝', '现金')),
  -- recharge_time 必须是 UTC 文本时间，格式为 YYYY-MM-DD HH:MM:SS
  CHECK (recharge_time GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]')
) STRICT;

CREATE INDEX IF NOT EXISTS idx_recharge_customer_time ON recharge_record (customer_id, recharge_time);
