-- 消费记录表新增桌号字段
-- table_number 以桌号编号为单位，可空表示未指定桌号

ALTER TABLE consumption_record
  ADD COLUMN table_number INTEGER CHECK (table_number IS NULL OR table_number >= 1);
