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
    afterSaleId: row.after_sale_id == null ? null : row.after_sale_id,
    orderId: row.order_id,
    orderNo: row.order_no,
    userId: row.user_id,
    merchantId: row.merchant_id == null ? null : row.merchant_id,
    status: row.status,
    userLastReadMsgId: row.user_last_read_msg_id == null ? null : Number(row.user_last_read_msg_id),
    merchantLastReadMsgId:
      row.merchant_last_read_msg_id == null ? null : Number(row.merchant_last_read_msg_id),
    csLastReadMsgId: row.cs_last_read_msg_id == null ? null : Number(row.cs_last_read_msg_id),
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

/** 取该售后某类型最近一条会话（含已关闭，用于查看历史） */
export async function findLatestThreadByAfterSale(afterSaleId, type = 'USER_CS') {
  const [rows] = await pool.query(
    `SELECT * FROM chat_threads WHERE after_sale_id = ? AND type = ? ORDER BY updated_at DESC, id DESC LIMIT 1`,
    [afterSaleId, type],
  );
  return mapThread(rows[0]);
}

export async function findOpenThreadByOrderMerchant(orderId, merchantId, type = 'USER_MERCHANT') {
  const [rows] = await pool.query(
    `SELECT * FROM chat_threads
     WHERE order_id = ? AND merchant_id = ? AND type = ? AND after_sale_id IS NULL AND status = 'OPEN'
     LIMIT 1`,
    [orderId, merchantId, type],
  );
  return mapThread(rows[0]);
}

export async function findThreadById(threadId) {
  const [rows] = await pool.query('SELECT * FROM chat_threads WHERE id = ? LIMIT 1', [threadId]);
  return mapThread(rows[0]);
}

export async function createThread({
  afterSaleId = null,
  orderId,
  orderNo,
  userId,
  merchantId = null,
  type = 'USER_CS',
}) {
  const now = toMysqlDateTime(new Date());
  const [result] = await pool.query(
    `INSERT INTO chat_threads (
      type, after_sale_id, order_id, order_no, user_id, merchant_id, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 'OPEN', ?, ?)`,
    [type, afterSaleId, orderId, orderNo, userId, merchantId, now, now],
  );
  return findThreadById(result.insertId);
}

export async function touchThread(threadId) {
  await pool.query('UPDATE chat_threads SET updated_at = ? WHERE id = ?', [
    toMysqlDateTime(new Date()),
    threadId,
  ]);
}

/** 将 OPEN 会话置为 CLOSED；已关闭则原样返回 */
export async function closeThread(threadId) {
  const now = toMysqlDateTime(new Date());
  await pool.query(
    `UPDATE chat_threads SET status = 'CLOSED', updated_at = ? WHERE id = ? AND status = 'OPEN'`,
    [now, threadId],
  );
  return findThreadById(threadId);
}

/** 重新打开已关闭会话（同售后仅一条记录，唯一键约束下不能再建） */
export async function reopenThread(threadId) {
  const now = toMysqlDateTime(new Date());
  await pool.query(
    `UPDATE chat_threads SET status = 'OPEN', updated_at = ? WHERE id = ? AND status = 'CLOSED'`,
    [now, threadId],
  );
  return findThreadById(threadId);
}

/**
 * 标记已读到指定消息 id（只向前推进）
 * reader: 'user' | 'merchant' | 'cs'
 */
export async function markThreadRead(threadId, reader, msgId) {
  if (!msgId || msgId <= 0) return;
  const col =
    reader === 'merchant'
      ? 'merchant_last_read_msg_id'
      : reader === 'cs'
        ? 'cs_last_read_msg_id'
        : 'user_last_read_msg_id';
  await pool.query(
    `UPDATE chat_threads
     SET ${col} = GREATEST(COALESCE(${col}, 0), ?)
     WHERE id = ?`,
    [Number(msgId), threadId],
  );
}

/** 对方未读条数：用户看商家/客服；商家看用户；客服看用户（不含 SYSTEM） */
export async function countUnreadForReader(thread, reader) {
  if (!thread) return 0;
  let afterId = 0;
  let senderFilter = '';
  if (reader === 'user') {
    afterId = thread.userLastReadMsgId || 0;
    senderFilter = `AND sender_type IN ('MERCHANT', 'CS_AGENT')`;
  } else if (reader === 'merchant') {
    afterId = thread.merchantLastReadMsgId || 0;
    senderFilter = `AND sender_type = 'USER'`;
  } else {
    afterId = thread.csLastReadMsgId || 0;
    senderFilter = `AND sender_type = 'USER'`;
  }
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM chat_messages
     WHERE thread_id = ? AND id > ? ${senderFilter}`,
    [thread.id, afterId],
  );
  return Number(rows[0]?.cnt) || 0;
}

export async function sumUnreadForUser(userId) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS cnt
     FROM chat_messages m
     INNER JOIN chat_threads t ON t.id = m.thread_id
     WHERE t.user_id = ?
       AND m.id > COALESCE(t.user_last_read_msg_id, 0)
       AND m.sender_type IN ('MERCHANT', 'CS_AGENT')`,
    [userId],
  );
  return Number(rows[0]?.cnt) || 0;
}

export async function listOpenThreadsByAfterSale(afterSaleId, { types } = {}) {
  const params = [afterSaleId];
  let sql = `SELECT * FROM chat_threads WHERE after_sale_id = ? AND status = 'OPEN'`;
  if (types?.length) {
    sql += ` AND type IN (${types.map(() => '?').join(',')})`;
    params.push(...types);
  }
  sql += ' ORDER BY id ASC';
  const [rows] = await pool.query(sql, params);
  return rows.map(mapThread);
}

/** 售后已 ESCALATED 但仍 OPEN 的商家会话（超时升级收口） */
export async function listOpenMerchantThreadsForEscalatedAfterSales() {
  const [rows] = await pool.query(
    `SELECT t.* FROM chat_threads t
     INNER JOIN after_sales a ON a.after_sale_id = t.after_sale_id
     WHERE t.type = 'USER_MERCHANT' AND t.status = 'OPEN' AND a.status = 'ESCALATED'`,
  );
  return rows.map(mapThread);
}

/** 订单级商家会话（after_sale_id IS NULL） */
export async function listOpenOrderMerchantThreads(orderId, { merchantId } = {}) {
  const params = [orderId];
  let sql = `
    SELECT * FROM chat_threads
    WHERE order_id = ? AND after_sale_id IS NULL AND type = 'USER_MERCHANT' AND status = 'OPEN'
  `;
  if (merchantId != null) {
    sql += ' AND merchant_id = ?';
    params.push(merchantId);
  }
  const [rows] = await pool.query(sql, params);
  return rows.map(mapThread);
}

export async function listThreadsForUser(userId, { status, type } = {}) {
  const params = [userId];
  let sql = 'SELECT * FROM chat_threads WHERE user_id = ?';
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

/** 商家侧：本店售后会话 + 订单级会话 */
export async function listThreadsForMerchant(merchantId, { status } = {}) {
  const params = [merchantId, merchantId];
  let sql = `
    SELECT DISTINCT t.*
    FROM chat_threads t
    LEFT JOIN after_sales a ON a.after_sale_id = t.after_sale_id
    WHERE t.type = 'USER_MERCHANT'
      AND (t.merchant_id = ? OR a.merchant_id = ?)
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
