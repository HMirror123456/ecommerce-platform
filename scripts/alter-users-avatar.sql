-- 已有库增量：用户头像（对齐 DOMAIN_MODEL User.avatarUrl）
ALTER TABLE users
  ADD COLUMN avatar_url MEDIUMTEXT NULL COMMENT '头像 URL 或演示用 data URL' AFTER nickname;
