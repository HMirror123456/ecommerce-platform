-- Demo seed (idempotent via DELETE + INSERT for dev reset)

SET FOREIGN_KEY_CHECKS = 0;

DELETE FROM chat_messages;
DELETE FROM chat_threads;
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
ALTER TABLE chat_threads AUTO_INCREMENT = 1;
ALTER TABLE chat_messages AUTO_INCREMENT = 1;
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
    'ON_SHELF', '2026-08-04 10:00:00.000', NULL,
    '2026-08-04 10:00:00.000', '2026-08-04 10:00:00.000'
  ),
  (
    104, 1, '数码旗舰店', 1, 1, '便携充电宝 20000mAh',
    '大容量快充，满足日常出行补电需求',
    'https://picsum.photos/seed/spu104/200/200',
    'PENDING_AUDIT', '2026-08-12 09:00:00.000', NULL,
    '2026-08-12 08:50:00.000', '2026-08-12 09:00:00.000'
  ),
  (
    105, 1, '数码旗舰店', 1, 12, '人体工学无线鼠标',
    '静音按键，贴合手型，适合长时间办公使用',
    'https://picsum.photos/seed/spu105/200/200',
    'PENDING_AUDIT', '2026-08-12 09:10:00.000', NULL,
    '2026-08-12 09:00:00.000', '2026-08-12 09:10:00.000'
  );

INSERT INTO skus (sku_id, spu_id, spec_json, price, created_at, updated_at) VALUES
  (1001, 101, '{"color":"黑色"}', 299.00, '2026-08-04 08:30:00.000', '2026-08-04 08:30:00.000'),
  (1002, 101, '{"color":"白色"}', 299.00, '2026-08-04 08:30:00.000', '2026-08-04 08:30:00.000'),
  (1003, 102, '{"color":"原木色"}', 159.00, '2026-08-04 09:15:00.000', '2026-08-04 09:15:00.000'),
  (1004, 103, '{"switch":"青轴"}', 449.00, '2026-08-04 10:00:00.000', '2026-08-04 10:00:00.000'),
  (1005, 104, '{"capacity":"20000mAh","color":"深空灰"}', 159.00, '2026-08-12 08:50:00.000', '2026-08-12 08:50:00.000'),
  (1006, 105, '{"color":"石墨黑","version":"静音版"}', 129.00, '2026-08-12 09:00:00.000', '2026-08-12 09:00:00.000');

INSERT INTO stocks (sku_id, available, locked, updated_at) VALUES
  (1001, 120, 0, '2026-08-04 08:30:00.000'),
  (1002, 80, 0, '2026-08-04 08:30:00.000'),
  (1003, 50, 0, '2026-08-04 09:15:00.000'),
  (1004, 30, 0, '2026-08-04 10:00:00.000'),
  (1005, 60, 0, '2026-08-12 08:50:00.000'),
  (1006, 75, 0, '2026-08-12 09:00:00.000');

INSERT INTO users (id, phone, password, nickname) VALUES
  (1, '13800138000', '123456', '演示用户');

INSERT INTO addresses (id, user_id, receiver_name, phone, province, city, district, detail, is_default) VALUES
  (1, 1, '张三', '13800138000', '北京市', '北京市', '朝阳区', '建国路 88 号', 1);

-- 最小跨端演示订单：待发货、已发货、售后中、已退款。
INSERT INTO orders (
  order_id, order_no, user_id, status, total_amount, remark, address_id, address_snapshot,
  created_at, payment_deadline, paid_at
) VALUES
  (10001, 'ORD-DEMO-10001', 1, 'PENDING_SHIPMENT', 299.00, '无线蓝牙耳机待发货', 1,
   '{"receiverName":"张三","phone":"13800138000","fullAddress":"北京市北京市朝阳区建国路 88 号"}',
   UTC_TIMESTAMP(3), DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 30 MINUTE), UTC_TIMESTAMP(3)),
  (10002, 'ORD-DEMO-10002', 1, 'SHIPPED', 449.00, '机械键盘已发货', 1,
   '{"receiverName":"张三","phone":"13800138000","fullAddress":"北京市北京市朝阳区建国路 88 号"}',
   DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 5 DAY), DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 5 DAY), DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 5 DAY)),
  (10003, 'ORD-DEMO-10003', 1, 'REFUNDING', 299.00, '耳机售后协商中', 1,
   '{"receiverName":"张三","phone":"13800138000","fullAddress":"北京市北京市朝阳区建国路 88 号"}',
   DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 3 DAY), DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 3 DAY), DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 3 DAY)),
  (10004, 'ORD-DEMO-10004', 1, 'REFUNDING', 449.00, '键盘等待寄回', 1,
   '{"receiverName":"张三","phone":"13800138000","fullAddress":"北京市北京市朝阳区建国路 88 号"}',
   DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 2 DAY), DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 2 DAY), DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 2 DAY)),
  (10005, 'ORD-DEMO-10005', 1, 'REFUNDING', 449.00, '键盘已寄回待验收', 1,
   '{"receiverName":"张三","phone":"13800138000","fullAddress":"北京市北京市朝阳区建国路 88 号"}',
   DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 2 DAY), DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 2 DAY), DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 2 DAY)),
  (10006, 'ORD-DEMO-10006', 1, 'REFUNDED', 299.00, '耳机退款完成', 1,
   '{"receiverName":"张三","phone":"13800138000","fullAddress":"北京市北京市朝阳区建国路 88 号"}',
   DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 7 DAY), DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 7 DAY), DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 7 DAY)),
  (10007, 'ORD-DEMO-10007', 1, 'REFUNDING', 299.00, '耳机平台仲裁中', 1,
   '{"receiverName":"张三","phone":"13800138000","fullAddress":"北京市北京市朝阳区建国路 88 号"}',
   DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 4 DAY), DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 4 DAY), DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 4 DAY));

INSERT INTO sub_orders (sub_order_id, order_id, merchant_id, shop_name, status, shipment) VALUES
  (50001, 10001, 1, '数码旗舰店', 'PENDING_SHIPMENT', NULL),
  (50002, 10002, 1, '数码旗舰店', 'SHIPPED', '{"logisticsCompany":"顺丰速运","trackingNo":"SF-DEMO-10002","shippedAt":"2026-08-10T08:00:00.000Z"}'),
  (50003, 10003, 1, '数码旗舰店', 'REFUNDING', '{"logisticsCompany":"中通快递","trackingNo":"ZT-DEMO-10003","shippedAt":"2026-08-11T08:00:00.000Z"}'),
  (50004, 10004, 1, '数码旗舰店', 'REFUNDING', '{"logisticsCompany":"顺丰速运","trackingNo":"SF-DEMO-10004","shippedAt":"2026-08-11T09:00:00.000Z"}'),
  (50005, 10005, 1, '数码旗舰店', 'REFUNDING', '{"logisticsCompany":"圆通速递","trackingNo":"YT-DEMO-10005","shippedAt":"2026-08-11T10:00:00.000Z"}'),
  (50006, 10006, 1, '数码旗舰店', 'REFUNDED', '{"logisticsCompany":"中通快递","trackingNo":"ZT-DEMO-10006","shippedAt":"2026-08-08T08:00:00.000Z"}'),
  (50007, 10007, 1, '数码旗舰店', 'REFUNDING', '{"logisticsCompany":"顺丰速运","trackingNo":"SF-DEMO-10007","shippedAt":"2026-08-09T08:00:00.000Z"}');

INSERT INTO order_items (order_id, sub_order_id, sku_id, title, price, quantity, merchant_id, shop_name) VALUES
  (10001, 50001, 1001, '无线蓝牙耳机 Pro', 299.00, 1, 1, '数码旗舰店'),
  (10002, 50002, 1004, '机械键盘 87 键', 449.00, 1, 1, '数码旗舰店'),
  (10003, 50003, 1001, '无线蓝牙耳机 Pro', 299.00, 1, 1, '数码旗舰店'),
  (10004, 50004, 1004, '机械键盘 87 键', 449.00, 1, 1, '数码旗舰店'),
  (10005, 50005, 1004, '机械键盘 87 键', 449.00, 1, 1, '数码旗舰店'),
  (10006, 50006, 1001, '无线蓝牙耳机 Pro', 299.00, 1, 1, '数码旗舰店'),
  (10007, 50007, 1001, '无线蓝牙耳机 Pro', 299.00, 1, 1, '数码旗舰店');

INSERT INTO payments (order_id, user_id, amount, channel, status, paid_at) VALUES
  (10001, 1, 299.00, 'MOCK', 'PAID', UTC_TIMESTAMP(3)),
  (10002, 1, 449.00, 'MOCK', 'PAID', DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 5 DAY)),
  (10003, 1, 299.00, 'MOCK', 'PAID', DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 3 DAY)),
  (10004, 1, 449.00, 'MOCK', 'PAID', DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 2 DAY)),
  (10005, 1, 449.00, 'MOCK', 'PAID', DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 2 DAY)),
  (10006, 1, 299.00, 'MOCK', 'PAID', DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 7 DAY)),
  (10007, 1, 299.00, 'MOCK', 'PAID', DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 4 DAY));

INSERT INTO after_sales (
  after_sale_id, order_id, order_no, sub_order_id, user_id, merchant_id, shop_name,
  type, reason, status, applied_at, merchant_deadline, audit_reason, audited_at, escalated_at, return_shipment, items
) VALUES
  (1, 10003, 'ORD-DEMO-10003', 50003, 1, 1, '数码旗舰店', 'REFUND_ONLY', '耳机降噪效果与描述不符，申请仅退款', 'APPLIED',
   UTC_TIMESTAMP(3), DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 48 HOUR), NULL, NULL, NULL, NULL,
   '[{"skuId":1001,"title":"无线蓝牙耳机 Pro","price":299,"quantity":1}]'),
  (2, 10004, 'ORD-DEMO-10004', 50004, 1, 1, '数码旗舰店', 'RETURN_REFUND', '商品尺寸不合适，申请退货退款', 'APPROVED',
   DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 DAY), DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 24 HOUR), '已同意退货退款，请用户寄回商品', DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 23 HOUR), NULL, NULL,
   '[{"skuId":1004,"title":"机械键盘 87 键","price":449,"quantity":1}]'),
  (3, 10005, 'ORD-DEMO-10005', 50005, 1, 1, '数码旗舰店', 'RETURN_REFUND', '商品外包装破损，申请退货退款', 'RETURNING',
   DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 2 DAY), DATE_ADD(UTC_TIMESTAMP(3), INTERVAL 24 HOUR), '已同意退货退款，请用户寄回商品', DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 46 HOUR), NULL,
   '{"logisticsCompany":"中通快递","trackingNo":"ZT-RETURN-10005","shippedAt":"2026-08-11T10:30:00.000Z"}',
   '[{"skuId":1004,"title":"机械键盘 87 键","price":449,"quantity":1}]'),
  (4, 10006, 'ORD-DEMO-10006', 50006, 1, 1, '数码旗舰店', 'RETURN_REFUND', '耳机佩戴不舒适，申请退货退款', 'REFUNDED',
   DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 7 DAY), DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 5 DAY), '退货验收通过，退款已完成', DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 5 DAY), NULL,
   '{"logisticsCompany":"中通快递","trackingNo":"ZT-RETURN-10006","shippedAt":"2026-08-08T09:30:00.000Z"}',
   '[{"skuId":1001,"title":"无线蓝牙耳机 Pro","price":299,"quantity":1}]'),
  (5, 10007, 'ORD-DEMO-10007', 50007, 1, 1, '数码旗舰店', 'REFUND_ONLY', '售后处理结果存在分歧，申请平台介入', 'ESCALATED',
   DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 4 DAY), DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 2 DAY), NULL, NULL, DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 2 DAY), NULL,
   '[{"skuId":1001,"title":"无线蓝牙耳机 Pro","price":299,"quantity":1}]');

INSERT INTO chat_threads (id, type, after_sale_id, order_id, order_no, user_id, status, created_at, updated_at) VALUES
  (1, 'USER_CS', 5, 10007, 'ORD-DEMO-10007', 1, 'OPEN', DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 DAY), UTC_TIMESTAMP(3)),
  (2, 'USER_MERCHANT', 1, 10003, 'ORD-DEMO-10003', 1, 'OPEN', DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 DAY), UTC_TIMESTAMP(3));

INSERT INTO chat_messages (thread_id, sender_type, sender_id, msg_type, content, payload_json, created_at) VALUES
  (1, 'SYSTEM', NULL, 'TEXT', '已接入平台客服会话，请描述您的问题。', NULL, DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 DAY)),
  (1, 'SYSTEM', NULL, 'CARD', '售后订单卡片', '{"afterSaleId":5,"orderId":10007,"orderNo":"ORD-DEMO-10007","shopName":"数码旗舰店","type":"REFUND_ONLY","status":"ESCALATED","reason":"售后处理结果存在分歧，申请平台介入","amount":299}', DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 DAY)),
  (1, 'USER', 1, 'TEXT', '我希望平台协助核实本次售后处理。', NULL, DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 23 HOUR)),
  (1, 'CS_AGENT', 4, 'TEXT', '您好，平台客服已收到，将尽快核实订单和售后记录。', NULL, DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 22 HOUR)),
  (2, 'SYSTEM', NULL, 'TEXT', '已建立用户与商家的售后沟通会话，请围绕该售后订单协商处理。', NULL, DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 DAY)),
  (2, 'SYSTEM', NULL, 'CARD', '售后订单卡片', '{"afterSaleId":1,"orderId":10003,"orderNo":"ORD-DEMO-10003","shopName":"数码旗舰店","type":"REFUND_ONLY","status":"APPLIED","reason":"耳机降噪效果与描述不符，申请仅退款","amount":299}', DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 DAY)),
  (2, 'USER', 1, 'TEXT', '耳机在嘈杂环境下的降噪效果没有达到预期。', NULL, DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 23 HOUR)),
  (2, 'MERCHANT', 1, 'TEXT', '您好，我们已收到反馈，正在核实商品与订单情况。', NULL, DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 22 HOUR));
