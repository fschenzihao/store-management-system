-- 开台计时方式：1=按购买时长倒计时、2=实际计时（不设计划结束时间）
-- 实际计时模式下 planned_duration_minutes 与 planned_end_time 仅作表约束占位，
-- 业务层按 timing_mode 忽略这两个字段；结账时以开台至结账的实际用时写入消费流水。

ALTER TABLE table_session
  ADD COLUMN timing_mode INTEGER NOT NULL DEFAULT 1
  CHECK (timing_mode IN (1, 2));
