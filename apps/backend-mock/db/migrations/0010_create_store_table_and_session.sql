-- 桌位（座位级）与开台会话
-- 全场固定 18 个座位，seat_no 唯一；分区、展示名与坐标属于前端表现层，不落库
-- table_session 记录每次开台的购买时长、计划结束时间与累计金额/时长
-- 同一座位同时只允许一个进行中的会话，由部分唯一索引保证

CREATE TABLE IF NOT EXISTS store_table (
  table_id INTEGER PRIMARY KEY,
  seat_no INTEGER NOT NULL,
  create_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (seat_no),
  CHECK (seat_no BETWEEN 1 AND 18),
  CHECK (create_time GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]'),
  CHECK (update_time GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]')
) STRICT;

-- status: 1=使用中、2=已结束
CREATE TABLE IF NOT EXISTS table_session (
  session_id INTEGER PRIMARY KEY,
  table_id INTEGER NOT NULL,
  customer_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  status INTEGER NOT NULL DEFAULT 1,
  planned_duration_minutes INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  planned_end_time TEXT NOT NULL,
  total_amount_cents INTEGER NOT NULL DEFAULT 0,
  total_duration_minutes INTEGER NOT NULL DEFAULT 0,
  close_time TEXT,
  create_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  update_time TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (table_id) REFERENCES store_table (table_id) ON DELETE RESTRICT,
  FOREIGN KEY (customer_id) REFERENCES customer (customer_id) ON DELETE RESTRICT,
  FOREIGN KEY (category_id) REFERENCES craft_category (category_id) ON DELETE RESTRICT,
  CHECK (status IN (1, 2)),
  CHECK (planned_duration_minutes > 0),
  CHECK (total_duration_minutes >= 0),
  CHECK (total_amount_cents >= 0),
  CHECK (start_time GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]'),
  CHECK (planned_end_time GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]'),
  CHECK (close_time IS NULL OR close_time GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]'),
  CHECK (create_time GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]'),
  CHECK (update_time GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9] [0-9][0-9]:[0-9][0-9]:[0-9][0-9]')
) STRICT;

-- 一个座位同时只允许一个进行中的会话
CREATE UNIQUE INDEX IF NOT EXISTS uk_table_session_active
  ON table_session (table_id) WHERE status = 1;

CREATE INDEX IF NOT EXISTS idx_table_session_customer
  ON table_session (customer_id);

CREATE INDEX IF NOT EXISTS idx_table_session_start
  ON table_session (start_time);

-- 消费流水关联开台会话，历史流水保持 session_id 为空
ALTER TABLE consumption_record
  ADD COLUMN session_id INTEGER REFERENCES table_session (session_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_consumption_session
  ON consumption_record (session_id);
