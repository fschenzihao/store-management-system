-- 初始化手工品类
-- 使用 INSERT OR IGNORE 保证可重复执行，依赖 craft_category 的品类名唯一约束

INSERT OR IGNORE INTO craft_category (category_name) VALUES
  ('拼豆'),
  ('奶油胶'),
  ('马赛克'),
  ('黏土'),
  ('布艺');
