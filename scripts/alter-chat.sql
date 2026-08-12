CREATE TABLE IF NOT EXISTS chat_threads (
  id INT PRIMARY KEY AUTO_INCREMENT,
  type VARCHAR(32) NOT NULL DEFAULT 'USER_CS',
  after_sale_id INT NOT NULL,
  order_id INT NOT NULL,
  order_no VARCHAR(64) NOT NULL,
  user_id INT NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'OPEN',
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  UNIQUE KEY uk_chat_threads_after_sale_type (after_sale_id, type),
  INDEX idx_chat_threads_user (user_id),
  INDEX idx_chat_threads_status (status)
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
