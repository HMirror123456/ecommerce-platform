-- One-time migrate existing admins for SUPER_ADMIN + status
-- If status/created_at already exist, skip the ADD lines or re-run db:setup

ALTER TABLE admins
  MODIFY COLUMN role ENUM('SUPER_ADMIN', 'OPERATOR', 'CS_AGENT') NOT NULL;

ALTER TABLE admins
  ADD COLUMN status ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE admins
  ADD COLUMN created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

INSERT INTO admins (username, password, role, status)
SELECT 'superadmin', 'super123', 'SUPER_ADMIN', 'ACTIVE'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM admins WHERE username = 'superadmin');

INSERT INTO admins (username, password, role, status)
SELECT 'operator2', 'operator123', 'OPERATOR', 'ACTIVE'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM admins WHERE username = 'operator2');

INSERT INTO admins (username, password, role, status)
SELECT 'csagent2', 'cs123', 'CS_AGENT', 'ACTIVE'
FROM DUAL
WHERE NOT EXISTS (SELECT 1 FROM admins WHERE username = 'csagent2');
