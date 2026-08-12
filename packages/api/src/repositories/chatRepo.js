import pool, { toIso, toMysqlDateTime } from '../db/pool.js';

function parsePayload(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function mapThread(row) {
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    afterSaleId: row.after_sale_id,
    orderId: row.order_id,
    orderNo: row.order_no,
    userId: row.user_id,
    status: row.status,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

function mapMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    threadId: row.thread_id,
    senderType: row.sender_type,
    senderId: row.sender_id == null ? null : row.sender_id,
    msgType: row.msg_type,
    content: row.content,
    payload: parsePayload(row.payload_json),
    createdAt: toIso(row.created_at),
  };
}

export async function findOpenThreadByAfterSale(afterSaleId, type = 'USER_CS') {
  const [rows] = await pool.query(
    `SELECT * FROM chat_threads WHERE after_sale_id = ? AND type = ? AND status = 'OPEN' LIMIT 1`,
    [afterSaleId, type],
  );
  return mapThread(rows[0]);
}

export async function findThreadById(threadId) {
  const [rows] = await pool.query('SELECT * FROM chat_threads WHERE id = ? LIMIT 1', [threadId]);
  return mapThread(rows[0]);
}

export async function createThread({ afterSaleId, orderId, orderNo, userId, type = 'USER_CS' }) {
  const now = toMysqlDateTime(new Date());
  const [result] = await pool.query(
    `INSERT INTO chat_threads (type, after_sale_id, order_id, order_no, user_id, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 'OPEN', ?, ?)`,
    [type, afterSaleId, orderId, orderNo, userId, now, now],
  );
  return findThreadById(result.insertId);
}

export async function touchThread(threadId) {
  await pool.query('UPDATE chat_threads SET updated_at = ? WHERE id = ?', [
    toMysqlDateTime(new Date()),
    threadId,
  ]);
}

export async function listThreadsForUser(userId, { status, type } = {}) {
  const params = [userId];
  let sql = `SELECT * FROM chat_threads WHERE user_id = ?`;
  if (type) {
    sql += ' AND type = ?';
    params.push(type);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  sql += ' ORDER BY updated_at DESC';
  const [rows] = await pool.query(sql, params);
  return rows.map(mapThread);
}

export async function listThreadsForCs({ status } = {}) {
  const params = [];
  let sql = `SELECT * FROM chat_threads WHERE type = 'USER_CS'`;
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  sql += ' ORDER BY updated_at DESC';
  const [rows] = await pool.query(sql, params);
  return rows.map(mapThread);
}

/** 商家侧：本店售后关联的 USER_MERCHANT 会话 */
export async function listThreadsForMerchant(merchantId, { status } = {}) {
  const params = [merchantId];
  let sql = `
    SELECT t.*
    FROM chat_threads t
    INNER JOIN after_sales a ON a.after_sale_id = t.after_sale_id
    WHERE t.type = 'USER_MERCHANT' AND a.merchant_id = ?
  `;
  if (status) {
    sql += ' AND t.status = ?';
    params.push(status);
  }
  sql += ' ORDER BY t.updated_at DESC';
  const [rows] = await pool.query(sql, params);
  return rows.map(mapThread);
}

export async function listMessages(threadId, { afterId } = {}) {
  const params = [threadId];
  let sql = 'SELECT * FROM chat_messages WHERE thread_id = ?';
  if (afterId) {
    sql += ' AND id > ?';
    params.push(Number(afterId));
  }
  sql += ' ORDER BY id ASC';
  const [rows] = await pool.query(sql, params);
  return rows.map(mapMessage);
}

export async function createMessage({ threadId, senderType, senderId, msgType, content, payload }) {
  const now = toMysqlDateTime(new Date());
  const payloadJson = payload == null ? null : JSON.stringify(payload);
  const [result] = await pool.query(
    `INSERT INTO chat_messages (thread_id, sender_type, sender_id, msg_type, content, payload_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [threadId, senderType, senderId ?? null, msgType, content, payloadJson, now],
  );
  await touchThread(threadId);
  const [rows] = await pool.query('SELECT * FROM chat_messages WHERE id = ? LIMIT 1', [result.insertId]);
  return mapMessage(rows[0]);
}
