-- 会话未读：各方已读到的最大消息 id
ALTER TABLE chat_threads
  ADD COLUMN user_last_read_msg_id INT NULL AFTER status,
  ADD COLUMN merchant_last_read_msg_id INT NULL AFTER user_last_read_msg_id,
  ADD COLUMN cs_last_read_msg_id INT NULL AFTER merchant_last_read_msg_id;
