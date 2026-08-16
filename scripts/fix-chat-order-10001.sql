-- 修复本地演示：售后会话关联订单 10001 缺失 / 非 REFUNDING 导致无法改状态
INSERT INTO orders (
  order_id, order_no, user_id, status, total_amount, remark, address_id, address_snapshot,
  created_at, payment_deadline, paid_at
) VALUES (
  10001, 'ORD-DEMO-10001', 1, 'REFUNDING', 299.00, '售后演示订单', 1,
  CAST('{"receiverName":"Zhang","phone":"13800138000","fullAddress":"Beijing"}' AS JSON),
  UTC_TIMESTAMP(3), DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 30 MINUTE), UTC_TIMESTAMP(3)
) ON DUPLICATE KEY UPDATE status = 'REFUNDING', order_no = VALUES(order_no);

INSERT INTO sub_orders (sub_order_id, order_id, merchant_id, shop_name, status, shipment) VALUES
  (50001, 10001, 1, 'Digital Shop', 'REFUNDING', NULL)
ON DUPLICATE KEY UPDATE status = 'REFUNDING';

INSERT INTO order_items (order_id, sub_order_id, sku_id, title, price, quantity, merchant_id, shop_name)
SELECT 10001, 50001, 1001, 'Demo SKU', 299.00, 1, 1, 'Digital Shop'
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM order_items WHERE order_id = 10001 AND sub_order_id = 50001
);

UPDATE after_sales
SET status = 'ESCALATED', order_id = 10001, order_no = 'ORD-DEMO-10001'
WHERE after_sale_id = 1;

UPDATE chat_threads
SET order_id = 10001, order_no = 'ORD-DEMO-10001', after_sale_id = 1
WHERE id = 1;
