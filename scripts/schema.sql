-- Batch 1: platform admin, merchant onboarding, product audit log
-- Aligns with docs/domain/DOMAIN_MODEL.md section 7

CREATE TABLE IF NOT EXISTS admins (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL UNIQUE,
  password VARCHAR(128) NOT NULL COMMENT 'Demo plaintext; use bcrypt in production',
  role ENUM('SUPER_ADMIN', 'OPERATOR', 'CS_AGENT') NOT NULL,
  status ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS merchants (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL UNIQUE,
  password VARCHAR(128) NOT NULL COMMENT 'Demo plaintext; use bcrypt in production',
  shop_id INT NOT NULL,
  shop_name VARCHAR(128) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS merchant_applications (
  id INT PRIMARY KEY AUTO_INCREMENT,
  shop_name VARCHAR(128) NOT NULL,
  contact_name VARCHAR(64) NOT NULL,
  contact_phone VARCHAR(20) NOT NULL,
  status ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  applied_at DATETIME(3) NOT NULL,
  audited_at DATETIME(3) NULL,
  reject_reason TEXT NULL,
  approved_merchant_id INT NULL,
  admin_id INT NULL,
  INDEX idx_merchant_applications_status (status),
  INDEX idx_merchant_applications_phone (contact_phone),
  CONSTRAINT fk_merchant_applications_merchant
    FOREIGN KEY (approved_merchant_id) REFERENCES merchants(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS product_audits (
  id INT PRIMARY KEY AUTO_INCREMENT,
  spu_id INT NOT NULL,
  admin_id INT NOT NULL,
  approved TINYINT(1) NOT NULL,
  reason TEXT NULL,
  audited_at DATETIME(3) NOT NULL,
  INDEX idx_product_audits_spu (spu_id),
  INDEX idx_product_audits_time (audited_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Batch 2: product base data (categories, SPU, SKU)

CREATE TABLE IF NOT EXISTS categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  parent_id INT NULL,
  name VARCHAR(64) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  INDEX idx_categories_parent (parent_id),
  CONSTRAINT fk_categories_parent
    FOREIGN KEY (parent_id) REFERENCES categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS spus (
  spu_id INT PRIMARY KEY AUTO_INCREMENT,
  shop_id INT NOT NULL,
  shop_name VARCHAR(128) NOT NULL,
  merchant_id INT NOT NULL,
  category_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  main_image VARCHAR(500) NOT NULL,
  status ENUM('DRAFT', 'PENDING_AUDIT', 'ON_SHELF', 'REJECTED', 'OFF_SHELF') NOT NULL DEFAULT 'DRAFT',
  submitted_at DATETIME(3) NULL,
  reject_reason TEXT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  INDEX idx_spus_merchant (merchant_id),
  INDEX idx_spus_category (category_id),
  INDEX idx_spus_status (status),
  CONSTRAINT fk_spus_merchant FOREIGN KEY (merchant_id) REFERENCES merchants(id),
  CONSTRAINT fk_spus_category FOREIGN KEY (category_id) REFERENCES categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS skus (
  sku_id INT PRIMARY KEY AUTO_INCREMENT,
  spu_id INT NOT NULL,
  spec_json JSON NOT NULL,
  price DECIMAL(12, 2) NOT NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  INDEX idx_skus_spu (spu_id),
  CONSTRAINT fk_skus_spu FOREIGN KEY (spu_id) REFERENCES spus(spu_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS stocks (
  sku_id INT PRIMARY KEY,
  available INT NOT NULL DEFAULT 0,
  locked INT NOT NULL DEFAULT 0,
  updated_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_stocks_sku FOREIGN KEY (sku_id) REFERENCES skus(sku_id) ON DELETE CASCADE,
  CONSTRAINT chk_stocks_available_non_negative CHECK (available >= 0),
  CONSTRAINT chk_stocks_locked_non_negative CHECK (locked >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO stocks (sku_id, available, locked, updated_at)
SELECT
  s.sku_id,
  CASE s.sku_id
    WHEN 1001 THEN 120
    WHEN 1002 THEN 80
    WHEN 1003 THEN 50
    WHEN 1004 THEN 30
    ELSE 0
  END AS available,
  0 AS locked,
  NOW(3) AS updated_at
FROM skus s
LEFT JOIN stocks st ON st.sku_id = s.sku_id
WHERE st.sku_id IS NULL;

-- Batch 3: users, addresses, cart, orders, payments, after-sales

CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  phone VARCHAR(20) NOT NULL UNIQUE,
  password VARCHAR(128) NOT NULL COMMENT 'Demo plaintext',
  nickname VARCHAR(64) NULL,
  avatar_url MEDIUMTEXT NULL COMMENT '头像 URL 或演示用 data URL'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS addresses (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  receiver_name VARCHAR(64) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  province VARCHAR(64) NOT NULL,
  city VARCHAR(64) NOT NULL,
  district VARCHAR(64) NOT NULL,
  detail VARCHAR(255) NOT NULL,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  INDEX idx_addresses_user (user_id),
  CONSTRAINT fk_addresses_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS cart_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  sku_id INT NOT NULL,
  quantity INT NOT NULL,
  UNIQUE KEY uk_cart_user_sku (user_id, sku_id),
  CONSTRAINT fk_cart_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS favorites (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  spu_id INT NOT NULL,
  created_at DATETIME(3) NOT NULL,
  UNIQUE KEY uk_favorites_user_spu (user_id, spu_id),
  INDEX idx_favorites_user (user_id),
  CONSTRAINT fk_favorites_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS orders (
  order_id INT PRIMARY KEY AUTO_INCREMENT,
  order_no VARCHAR(64) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  status VARCHAR(32) NOT NULL,
  total_amount DECIMAL(12, 2) NOT NULL,
  remark VARCHAR(255) NULL,
  address_id INT NULL,
  address_snapshot JSON NOT NULL,
  created_at DATETIME(3) NOT NULL,
  payment_deadline DATETIME(3) NOT NULL,
  paid_at DATETIME(3) NULL,
  cancelled_at DATETIME(3) NULL,
  cancel_reason VARCHAR(64) NULL,
  INDEX idx_orders_user (user_id),
  INDEX idx_orders_status (status),
  INDEX idx_orders_created (created_at),
  CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS sub_orders (
  sub_order_id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL,
  merchant_id INT NOT NULL,
  shop_name VARCHAR(128) NOT NULL,
  status VARCHAR(32) NOT NULL,
  shipment JSON NULL,
  INDEX idx_sub_orders_order (order_id),
  INDEX idx_sub_orders_merchant (merchant_id),
  CONSTRAINT fk_sub_orders_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL,
  sub_order_id INT NOT NULL,
  sku_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  price DECIMAL(12, 2) NOT NULL,
  quantity INT NOT NULL,
  merchant_id INT NOT NULL,
  shop_name VARCHAR(128) NOT NULL,
  INDEX idx_order_items_order (order_id),
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_sub FOREIGN KEY (sub_order_id) REFERENCES sub_orders(sub_order_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payments (
  payment_id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL,
  user_id INT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  channel VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL,
  paid_at DATETIME(3) NOT NULL,
  INDEX idx_payments_order (order_id),
  CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES orders(order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS after_sales (
  after_sale_id INT PRIMARY KEY AUTO_INCREMENT,
  order_id INT NOT NULL,
  order_no VARCHAR(64) NOT NULL,
  sub_order_id INT NOT NULL,
  user_id INT NOT NULL,
  merchant_id INT NOT NULL,
  shop_name VARCHAR(128) NOT NULL,
  type VARCHAR(32) NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(32) NOT NULL,
  applied_at DATETIME(3) NOT NULL,
  merchant_deadline DATETIME(3) NULL,
  audit_reason TEXT NULL,
  audited_at DATETIME(3) NULL,
  escalated_at DATETIME(3) NULL,
  return_shipment JSON NULL,
  items JSON NOT NULL,
  INDEX idx_after_sales_status (status),
  INDEX idx_after_sales_merchant (merchant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS chat_threads (
  id INT PRIMARY KEY AUTO_INCREMENT,
  type VARCHAR(32) NOT NULL DEFAULT 'USER_CS',
  after_sale_id INT NULL,
  order_id INT NOT NULL,
  order_no VARCHAR(64) NOT NULL,
  user_id INT NOT NULL,
  merchant_id INT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'OPEN',
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  UNIQUE KEY uk_chat_threads_after_sale_type (after_sale_id, type),
  INDEX idx_chat_threads_user (user_id),
  INDEX idx_chat_threads_status (status),
  INDEX idx_chat_threads_merchant (merchant_id),
  INDEX idx_chat_threads_order_merchant (order_id, merchant_id, type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS chat_messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  thread_id INT NOT NULL,
  sender_type VARCHAR(16) NOT NULL,
  sender_id INT NULL,
  msg_type VARCHAR(16) NOT NULL,
  content TEXT NOT NULL,
  payload_json JSON NULL,
  created_at DATETIME(3) NOT NULL,
  INDEX idx_chat_messages_thread (thread_id, id),
  CONSTRAINT fk_chat_messages_thread FOREIGN KEY (thread_id) REFERENCES chat_threads(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
