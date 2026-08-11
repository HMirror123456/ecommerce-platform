-- Demo seed (idempotent via DELETE + INSERT for dev reset)

SET FOREIGN_KEY_CHECKS = 0;

DELETE FROM after_sales;
DELETE FROM payments;
DELETE FROM order_items;
DELETE FROM sub_orders;
DELETE FROM orders;
DELETE FROM favorites;
DELETE FROM cart_items;
DELETE FROM addresses;
DELETE FROM users;
DELETE FROM product_audits;
DELETE FROM stocks;
DELETE FROM skus;
DELETE FROM spus;
DELETE FROM categories;
DELETE FROM merchant_applications;
DELETE FROM merchants;
DELETE FROM admins;

ALTER TABLE users AUTO_INCREMENT = 1;
ALTER TABLE addresses AUTO_INCREMENT = 1;
ALTER TABLE cart_items AUTO_INCREMENT = 1;
ALTER TABLE favorites AUTO_INCREMENT = 1;
ALTER TABLE orders AUTO_INCREMENT = 1;
ALTER TABLE sub_orders AUTO_INCREMENT = 50001;
ALTER TABLE order_items AUTO_INCREMENT = 1;
ALTER TABLE payments AUTO_INCREMENT = 1;
ALTER TABLE after_sales AUTO_INCREMENT = 1;
ALTER TABLE merchants AUTO_INCREMENT = 1;
ALTER TABLE merchant_applications AUTO_INCREMENT = 101;
ALTER TABLE product_audits AUTO_INCREMENT = 1;
ALTER TABLE categories AUTO_INCREMENT = 1;
ALTER TABLE spus AUTO_INCREMENT = 1;
ALTER TABLE skus AUTO_INCREMENT = 1;
ALTER TABLE admins AUTO_INCREMENT = 1;

SET FOREIGN_KEY_CHECKS = 1;

INSERT INTO admins (username, password, role, status) VALUES
  ('superadmin', 'super123', 'SUPER_ADMIN', 'ACTIVE'),
  ('operator', 'operator123', 'OPERATOR', 'ACTIVE'),
  ('operator2', 'operator123', 'OPERATOR', 'ACTIVE'),
  ('csagent', 'cs123', 'CS_AGENT', 'ACTIVE'),
  ('csagent2', 'cs123', 'CS_AGENT', 'ACTIVE');

INSERT INTO merchants (id, username, password, shop_id, shop_name) VALUES
  (1, 'merchant1', '123456', 1, '数码旗舰店'),
  (2, 'merchant2', '123456', 2, '家居生活馆');

INSERT INTO merchant_applications (id, shop_name, contact_name, contact_phone, status, applied_at) VALUES
  (101, '新锐数码店', '李四', '13900139000', 'PENDING', '2026-08-06 06:00:00.000');

INSERT INTO categories (id, parent_id, name, sort_order, enabled, created_at, updated_at) VALUES
  (1, NULL, '数码', 1, 1, '2026-08-04 00:00:00.000', '2026-08-04 00:00:00.000'),
  (11, 1, '耳机', 1, 1, '2026-08-04 00:00:00.000', '2026-08-04 00:00:00.000'),
  (12, 1, '电脑外设', 2, 1, '2026-08-04 00:00:00.000', '2026-08-04 00:00:00.000'),
  (2, NULL, '家居生活', 2, 1, '2026-08-04 00:00:00.000', '2026-08-04 00:00:00.000'),
  (21, 2, '照明', 1, 1, '2026-08-04 00:00:00.000', '2026-08-04 00:00:00.000');

INSERT INTO spus (
  spu_id, shop_id, shop_name, merchant_id, category_id, title, description, main_image,
  status, submitted_at, reject_reason, created_at, updated_at
) VALUES
  (
    101, 1, '数码旗舰店', 1, 11, '无线蓝牙耳机 Pro',
    '主动降噪，续航 30 小时',
    'https://picsum.photos/seed/spu101/200/200',
    'ON_SHELF', '2026-08-04 08:30:00.000', NULL,
    '2026-08-04 08:30:00.000', '2026-08-04 08:30:00.000'
  ),
  (
    102, 2, '家居生活馆', 2, 21, '北欧简约台灯',
    '三档调光，护眼设计',
    'https://picsum.photos/seed/spu102/200/200',
    'ON_SHELF', '2026-08-04 09:15:00.000', NULL,
    '2026-08-04 09:15:00.000', '2026-08-04 09:15:00.000'
  ),
  (
    103, 1, '数码旗舰店', 1, 12, '机械键盘 87 键',
    '青轴，RGB 背光',
    'https://picsum.photos/seed/spu103/200/200',
    'PENDING_AUDIT', '2026-08-04 10:00:00.000', NULL,
    '2026-08-04 10:00:00.000', '2026-08-04 10:00:00.000'
  );

INSERT INTO skus (sku_id, spu_id, spec_json, price, created_at, updated_at) VALUES
  (1001, 101, '{"color":"黑色"}', 299.00, '2026-08-04 08:30:00.000', '2026-08-04 08:30:00.000'),
  (1002, 101, '{"color":"白色"}', 299.00, '2026-08-04 08:30:00.000', '2026-08-04 08:30:00.000'),
  (1003, 102, '{"color":"原木色"}', 159.00, '2026-08-04 09:15:00.000', '2026-08-04 09:15:00.000'),
  (1004, 103, '{"switch":"青轴"}', 449.00, '2026-08-04 10:00:00.000', '2026-08-04 10:00:00.000');

INSERT INTO stocks (sku_id, available, locked, updated_at) VALUES
  (1001, 120, 0, '2026-08-04 08:30:00.000'),
  (1002, 80, 0, '2026-08-04 08:30:00.000'),
  (1003, 50, 0, '2026-08-04 09:15:00.000'),
  (1004, 30, 0, '2026-08-04 10:00:00.000');

INSERT INTO users (id, phone, password, nickname) VALUES
  (1, '13800138000', '123456', '演示用户');

INSERT INTO addresses (id, user_id, receiver_name, phone, province, city, district, detail, is_default) VALUES
  (1, 1, '张三', '13800138000', '北京市', '北京市', '朝阳区', '建国路 88 号', 1);

INSERT INTO after_sales (
  after_sale_id, order_id, order_no, sub_order_id, user_id, merchant_id, shop_name,
  type, reason, status, applied_at, merchant_deadline, audit_reason, audited_at, escalated_at, return_shipment, items
) VALUES
  (
    1, 10001, 'ORD-DEMO-10001', 50001, 1, 1, '数码旗舰店',
    'REFUND_ONLY', '耳机降噪效果与描述不符，申请仅退款', 'APPLIED',
    '2026-08-05 08:00:00.000', '2026-08-07 08:00:00.000', NULL, NULL, NULL, NULL,
    '[{"skuId":1001,"title":"无线蓝牙耳机 Pro","price":299,"quantity":1}]'
  ),
  (
    2, 10002, 'ORD-DEMO-10002', 50002, 1, 1, '数码旗舰店',
    'RETURN_REFUND', '商品外包装破损，申请退货退款', 'APPROVED',
    '2026-08-04 09:00:00.000', '2026-08-06 09:00:00.000',
    '同意售后申请，请用户寄回商品', '2026-08-04 10:00:00.000', NULL, NULL,
    '[{"skuId":1004,"title":"机械键盘 87 键","price":449,"quantity":1}]'
  ),
  (
    3, 10003, 'ORD-DEMO-10003', 50003, 1, 1, '数码旗舰店',
    'REFUND_ONLY', '商家超时未处理，等待平台介入', 'ESCALATED',
    '2026-08-05 10:00:00.000', '2026-08-07 10:00:00.000', NULL, NULL,
    '2026-08-07 11:00:00.000', NULL,
    '[{"skuId":1001,"title":"无线蓝牙耳机 Pro","price":299,"quantity":1}]'
  ),
  (
    4, 10004, 'ORD-DEMO-10004', 50004, 1, 2, '家居生活馆',
    'RETURN_REFUND', '台灯灯罩破损，申请退货退款', 'APPLIED',
    '2026-08-05 11:00:00.000', '2026-08-07 11:00:00.000', NULL, NULL, NULL, NULL,
    '[{"skuId":1003,"title":"北欧简约台灯","price":159,"quantity":1}]'
  ),
  (
    5, 10005, 'ORD-DEMO-10005', 50005, 1, 1, '数码旗舰店',
    'RETURN_REFUND', '键盘按键失灵，申请退货退款', 'APPLIED',
    '2026-08-05 09:30:00.000', '2026-08-07 09:30:00.000', NULL, NULL, NULL, NULL,
    '[{"skuId":1004,"title":"机械键盘 87 键","price":449,"quantity":1}]'
  );
