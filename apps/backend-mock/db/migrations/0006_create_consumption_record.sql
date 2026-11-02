-- 消费记录表
-- duration_minutes 以分钟为单位
-- consumption_amount_cents 以人民币分为单位
-- 已产生业务记录的客户和手工品类不允许直接删除

CREATE TABLE IF NOT EXISTS consumption_record (
  consumption_id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  duration_minutes INTEGER NOT NULL,
  consumption_amount_cents INTEGER NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customer (customer_id) ON DELETE RESTRICT,
  FOREIGN KEY (category_id) REFERENCES craft_category (category_id) ON DELETE RESTRICT,
  CHECK (duration_minutes >= 0),
  CHECK (consumption_amount_cents >= 0)
) STRICT;

CREATE INDEX IF NOT EXISTS idx_consumption_customer ON consumption_record (customer_id);

CREATE INDEX IF NOT EXISTS idx_consumption_category ON consumption_record (category_id);
