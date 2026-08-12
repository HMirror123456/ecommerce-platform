-- 订单级联系商家：after_sale_id 可空，增加 merchant_id
-- 已有库执行一次即可（幂等需人工确认列是否已存在）

ALTER TABLE chat_threads
  MODIFY COLUMN after_sale_id INT NULL;

ALTER TABLE chat_threads
  ADD COLUMN merchant_id INT NULL AFTER user_id;

ALTER TABLE chat_threads
  ADD INDEX idx_chat_threads_merchant (merchant_id);

ALTER TABLE chat_threads
  ADD INDEX idx_chat_threads_order_merchant (order_id, merchant_id, type);

-- 回填：售后会话补上 merchant_id
UPDATE chat_threads t
INNER JOIN after_sales a ON a.after_sale_id = t.after_sale_id
SET t.merchant_id = a.merchant_id
WHERE t.merchant_id IS NULL AND t.after_sale_id IS NOT NULL;
