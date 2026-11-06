-- 消费记录表新增是否全天字段
-- is_full_day 取值 0/1，可空表示未指定

ALTER TABLE consumption_record
  ADD COLUMN is_full_day INTEGER CHECK (is_full_day IS NULL OR is_full_day IN (0, 1));
