import pool, { toIso, toMysqlDateTime } from '../db/pool.js';

function parseJson(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function mapOrderRow(row, subOrders, allItems) {
  const items = allItems.map((i) => ({
    skuId: i.sku_id,
    title: i.title,
    price: Number(i.price),
    quantity: i.quantity,
  }));
  return {
    orderId: row.order_id,
    orderNo: row.order_no,
    userId: row.user_id,
    status: row.status,
    totalAmount: Number(row.total_amount),
    remark: row.remark,
    addressId: row.address_id,
    addressSnapshot: parseJson(row.address_snapshot),
    items,
    subOrders: subOrders.map((sub) => ({
      subOrderId: sub.sub_order_id,
      merchantId: sub.merchant_id,
      shopName: sub.shop_name,
      status: sub.status,
      items: allItems
        .filter((i) => i.sub_order_id === sub.sub_order_id)
        .map((i) => ({
          skuId: i.sku_id,
          title: i.title,
          price: Number(i.price),
          quantity: i.quantity,
        })),
      shipment: parseJson(sub.shipment),
    })),
    createdAt: toIso(row.created_at),
    paymentDeadline: toIso(row.payment_deadline),
    paidAt: toIso(row.paid_at),
    cancelledAt: toIso(row.cancelled_at),
    cancelReason: row.cancel_reason,
  };
}

async function loadOrderGraph(orderId) {
  const [orderRows] = await pool.query('SELECT * FROM orders WHERE order_id = ? LIMIT 1', [orderId]);
  if (!orderRows[0]) return null;
  const [subRows] = await pool.query('SELECT * FROM sub_orders WHERE order_id = ? ORDER BY sub_order_id ASC', [orderId]);
  const [itemRows] = await pool.query('SELECT * FROM order_items WHERE order_id = ? ORDER BY id ASC', [orderId]);
  return mapOrderRow(orderRows[0], subRows, itemRows);
}

async function loadOrdersGraph(orderIds) {
  if (!orderIds.length) return [];
  const placeholders = orderIds.map(() => '?').join(',');
  const [orderRows] = await pool.query(
    `SELECT * FROM orders WHERE order_id IN (${placeholders}) ORDER BY created_at DESC`,
    orderIds,
  );
  const [subRows] = await pool.query(
    `SELECT * FROM sub_orders WHERE order_id IN (${placeholders}) ORDER BY sub_order_id ASC`,
    orderIds,
  );
  const [itemRows] = await pool.query(
    `SELECT * FROM order_items WHERE order_id IN (${placeholders}) ORDER BY id ASC`,
    orderIds,
  );
  return orderRows.map((row) => {
    const subs = subRows.filter((s) => s.order_id === row.order_id);
    const items = itemRows.filter((i) => i.order_id === row.order_id);
    return mapOrderRow(row, subs, items);
  });
}

function buildOrderNo(orderId) {
  return `ORD${Date.now()}${String(orderId).padStart(4, '0')}`;
}

export async function createOrderRecord({
  userId,
  status,
  totalAmount,
  remark,
  addressId,
  addressSnapshot,
  createdAt,
  paymentDeadline,
  lineItems,
  subOrderGroups,
}) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [orderResult] = await conn.query(
      `INSERT INTO orders (order_no, user_id, status, total_amount, remark, address_id, address_snapshot,
        created_at, payment_deadline)
       VALUES ('PENDING', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        status,
        totalAmount,
        remark,
        addressId,
        JSON.stringify(addressSnapshot),
        toMysqlDateTime(createdAt),
        toMysqlDateTime(paymentDeadline),
      ],
    );
    const orderId = orderResult.insertId;
    const orderNo = buildOrderNo(orderId);
    await conn.query('UPDATE orders SET order_no = ? WHERE order_id = ?', [orderNo, orderId]);

    const subIdMap = new Map();
    for (const group of subOrderGroups) {
      const [subResult] = await conn.query(
        `INSERT INTO sub_orders (order_id, merchant_id, shop_name, status) VALUES (?, ?, ?, ?)`,
        [orderId, group.merchantId, group.shopName, group.status],
      );
      subIdMap.set(group.merchantId, subResult.insertId);
    }

    for (const item of lineItems) {
      const subOrderId = subIdMap.get(item.merchantId);
      await conn.query(
        `INSERT INTO order_items (order_id, sub_order_id, sku_id, title, price, quantity, merchant_id, shop_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderId,
          subOrderId,
          item.skuId,
          item.title,
          item.price,
          item.quantity,
          item.merchantId,
          item.shopName,
        ],
      );
    }

    await conn.commit();
    return loadOrderGraph(orderId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function findByIdAndUser(orderId, userId) {
  const order = await loadOrderGraph(orderId);
  if (!order || order.userId !== userId) return null;
  return order;
}

export async function findById(orderId) {
  return loadOrderGraph(orderId);
}

export async function listByUser(userId, status) {
  let sql = 'SELECT order_id FROM orders WHERE user_id = ?';
  const params = [userId];
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  sql += ' ORDER BY created_at DESC';
  const [rows] = await pool.query(sql, params);
  return loadOrdersGraph(rows.map((r) => r.order_id));
}

export async function listAdmin({ orderNo, userId, merchantId, status, page = 1, pageSize = 20 } = {}) {
  let sql = 'SELECT DISTINCT o.order_id FROM orders o';
  const params = [];
  const where = [];
  if (merchantId != null && merchantId !== '') {
    sql += ' JOIN sub_orders s ON s.order_id = o.order_id';
    where.push('s.merchant_id = ?');
    params.push(Number(merchantId));
  }
  if (orderNo?.trim()) {
    where.push('o.order_no LIKE ?');
    params.push(`%${orderNo.trim()}%`);
  }
  if (userId != null && userId !== '') {
    where.push('o.user_id = ?');
    params.push(Number(userId));
  }
  if (status) {
    where.push('o.status = ?');
    params.push(status);
  }
  if (where.length) sql += ` WHERE ${where.join(' AND ')}`;

  const [countRows] = await pool.query(
    sql.replace('SELECT DISTINCT o.order_id', 'SELECT COUNT(DISTINCT o.order_id) AS cnt'),
    params,
  );
  const total = Number(countRows[0]?.cnt) || 0;
  const offset = (page - 1) * pageSize;
  const [idRows] = await pool.query(`${sql} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`, [
    ...params,
    pageSize,
    offset,
  ]);
  const list = await loadOrdersGraph(idRows.map((r) => r.order_id));
  return { total, list };
}

export async function updateOrder(orderId, fields) {
  const sets = [];
  const params = [];
  const map = {
    status: 'status',
    paidAt: 'paid_at',
    cancelledAt: 'cancelled_at',
    cancelReason: 'cancel_reason',
  };
  const dateFields = new Set(['paidAt', 'cancelledAt']);
  for (const [key, col] of Object.entries(map)) {
    if (fields[key] !== undefined) {
      sets.push(`${col} = ?`);
      params.push(dateFields.has(key) ? toMysqlDateTime(fields[key]) : fields[key]);
    }
  }
  if (!sets.length) return;
  params.push(orderId);
  await pool.query(`UPDATE orders SET ${sets.join(', ')} WHERE order_id = ?`, params);
}

export async function updateSubOrderStatus(subOrderId, status) {
  await pool.query('UPDATE sub_orders SET status = ? WHERE sub_order_id = ?', [status, subOrderId]);
}

export async function updateSubOrdersByOrder(orderId, fromStatus, toStatus) {
  await pool.query('UPDATE sub_orders SET status = ? WHERE order_id = ? AND status = ?', [
    toStatus,
    orderId,
    fromStatus,
  ]);
}

export async function shipSubOrder(subOrderId, shipment) {
  await pool.query('UPDATE sub_orders SET status = ?, shipment = ? WHERE sub_order_id = ?', [
    'SHIPPED',
    JSON.stringify(shipment),
    subOrderId,
  ]);
}

export async function findSubOrderContext(subOrderId) {
  const [subRows] = await pool.query('SELECT * FROM sub_orders WHERE sub_order_id = ? LIMIT 1', [subOrderId]);
  const sub = subRows[0];
  if (!sub) return null;
  const order = await loadOrderGraph(sub.order_id);
  if (!order) return null;
  const subOrder = order.subOrders.find((s) => s.subOrderId === subOrderId);
  return { order, subOrder };
}

export async function listSubOrdersByMerchant(merchantId, status) {
  let sql = `
    SELECT s.sub_order_id, o.order_id, o.order_no, o.created_at, o.address_snapshot
    FROM sub_orders s
    JOIN orders o ON o.order_id = s.order_id
    WHERE s.merchant_id = ?`;
  const params = [merchantId];
  if (status) {
    sql += ' AND s.status = ?';
    params.push(status);
  }
  sql += ' ORDER BY o.created_at DESC';
  const [rows] = await pool.query(sql, params);
  const list = [];
  for (const row of rows) {
    const order = await loadOrderGraph(row.order_id);
    const sub = order.subOrders.find((s) => s.subOrderId === row.sub_order_id);
    if (!sub) continue;
    list.push({
      subOrderId: sub.subOrderId,
      orderId: order.orderId,
      orderNo: order.orderNo,
      merchantId: sub.merchantId,
      shopName: sub.shopName,
      status: sub.status,
      items: sub.items,
      addressSnapshot: order.addressSnapshot,
      createdAt: order.createdAt,
      shipment: sub.shipment,
    });
  }
  return list;
}

export async function insertPayment({ orderId, userId, amount, channel, status, paidAt }) {
  const [result] = await pool.query(
    `INSERT INTO payments (order_id, user_id, amount, channel, status, paid_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [orderId, userId, amount, channel, status, toMysqlDateTime(paidAt)],
  );
  return {
    paymentId: result.insertId,
    orderId,
    userId,
    amount,
    channel,
    status,
    paidAt: toIso(paidAt),
  };
}

export async function listExpiredPendingOrders() {
  // payment_deadline 按 UTC 写入（toMysqlDateTime），须与 UTC_TIMESTAMP 比较，
  // 避免本机时区（如东八区）下用 NOW() 把刚下的单立刻判为超时取消
  const [rows] = await pool.query(
    `SELECT order_id FROM orders WHERE status = 'PENDING_PAYMENT' AND payment_deadline < UTC_TIMESTAMP(3)`,
  );
  const orders = [];
  for (const row of rows) {
    const order = await loadOrderGraph(row.order_id);
    if (order) orders.push(order);
  }
  return orders;
}

export async function countOrders(status) {
  if (status) {
    const [rows] = await pool.query('SELECT COUNT(*) AS cnt FROM orders WHERE status = ?', [status]);
    return Number(rows[0]?.cnt) || 0;
  }
  const [rows] = await pool.query('SELECT COUNT(*) AS cnt FROM orders');
  return Number(rows[0]?.cnt) || 0;
}

export async function countSubOrdersByMerchant(merchantId, status) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS cnt FROM sub_orders WHERE merchant_id = ? AND status = ?',
    [merchantId, status],
  );
  return Number(rows[0]?.cnt) || 0;
}

export { loadOrderGraph };
