-- Demo seed (idempotent via DELETE + INSERT for dev reset)

DELETE FROM after_sales;
DELETE FROM payments;
DELETE FROM order_items;
DELETE FROM sub_orders;
DELETE FROM orders;
DELETE FROM cart_items;
DELETE FROM addresses;
DELETE FROM users;
DELETE FROM product_audits;
DELETE FROM merchant_applications;
DELETE FROM merchants;
DELETE FROM admins;

ALTER TABLE users AUTO_INCREMENT = 1;
ALTER TABLE addresses AUTO_INCREMENT = 1;
ALTER TABLE cart_items AUTO_INCREMENT = 1;
ALTER TABLE orders AUTO_INCREMENT = 1;
ALTER TABLE sub_orders AUTO_INCREMENT = 50001;
ALTER TABLE order_items AUTO_INCREMENT = 1;
ALTER TABLE payments AUTO_INCREMENT = 1;
ALTER TABLE after_sales AUTO_INCREMENT = 1;
ALTER TABLE merchants AUTO_INCREMENT = 1;
ALTER TABLE merchant_applications AUTO_INCREMENT = 101;
ALTER TABLE product_audits AUTO_INCREMENT = 1;
ALTER TABLE admins AUTO_INCREMENT = 1;

INSERT INTO admins (username, password, role) VALUES
  ('operator', 'operator123', 'OPERATOR'),
  ('csagent', 'cs123', 'CS_AGENT');

INSERT INTO merchants (id, username, password, shop_id, shop_name) VALUES
  (1, 'merchant1', '123456', 1, '数码旗舰店'),
  (2, 'merchant2', '123456', 2, '家居生活馆');

INSERT INTO merchant_applications (id, shop_name, contact_name, contact_phone, status, applied_at) VALUES
  (101, '新锐数码店', '李四', '13900139000', 'PENDING', '2026-08-06 06:00:00.000');

INSERT INTO users (id, phone, password, nickname) VALUES
  (1, '13800138000', '123456', '演示用户');

INSERT INTO addresses (id, user_id, receiver_name, phone, province, city, district, detail, is_default) VALUES
  (1, 1, '张三', '13800138000', '北京市', '北京市', '朝阳区', '建国路 88 号', 1);

INSERT INTO after_sales (
  after_sale_id, order_id, order_no, sub_order_id, user_id, merchant_id, shop_name,
  type, reason, status, applied_at, merchant_deadline, audit_reason, audited_at, escalated_at, items
) VALUES
  (
    1, 10001, 'ORD-DEMO-10001', 50001, 1, 1, '数码旗舰店',
    'REFUND_ONLY', '耳机降噪效果与描述不符，申请仅退款', 'APPLIED',
    '2026-08-05 08:00:00.000', '2026-08-07 08:00:00.000', NULL, NULL, NULL,
    '[{"skuId":1001,"title":"无线蓝牙耳机 Pro","price":299,"quantity":1}]'
  ),
  (
    2, 10002, 'ORD-DEMO-10002', 50002, 1, 1, '数码旗舰店',
    'RETURN_REFUND', '商品外包装破损，申请退货退款', 'APPROVED',
    '2026-08-04 09:00:00.000', '2026-08-06 09:00:00.000',
    '同意售后申请，请用户寄回商品', '2026-08-04 10:00:00.000', NULL,
    '[{"skuId":1004,"title":"机械键盘 87 键","price":449,"quantity":1}]'
  ),
  (
    3, 10003, 'ORD-DEMO-10003', 50003, 1, 1, '数码旗舰店',
    'REFUND_ONLY', '商家超时未处理，等待平台介入', 'ESCALATED',
    '2026-08-05 10:00:00.000', '2026-08-07 10:00:00.000', NULL, NULL,
    '2026-08-07 11:00:00.000',
    '[{"skuId":1001,"title":"无线蓝牙耳机 Pro","price":299,"quantity":1}]'
  ),
  (
    4, 10004, 'ORD-DEMO-10004', 50004, 1, 2, '家居生活馆',
    'RETURN_REFUND', '台灯灯罩破损，申请退货退款', 'APPLIED',
    '2026-08-05 11:00:00.000', '2026-08-07 11:00:00.000', NULL, NULL, NULL,
    '[{"skuId":1003,"title":"北欧简约台灯","price":159,"quantity":1}]'
  ),
  (
    5, 10005, 'ORD-DEMO-10005', 50005, 1, 1, '数码旗舰店',
    'RETURN_REFUND', '键盘按键失灵，申请退货退款', 'APPLIED',
    '2026-08-05 09:30:00.000', '2026-08-07 09:30:00.000', NULL, NULL, NULL,
    '[{"skuId":1004,"title":"机械键盘 87 键","price":449,"quantity":1}]'
  );
