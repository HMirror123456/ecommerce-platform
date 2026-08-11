import pool, { toIso, toMysqlDateTime } from '../db/pool.js';

function mapRow(row) {
  let items = row.items;
  if (typeof items === 'string') {
    try {
      items = JSON.parse(items);
    } catch {
      items = [];
    }
  }
  return {
    afterSaleId: row.after_sale_id,
    orderId: row.order_id,
    orderNo: row.order_no,
    subOrderId: row.sub_order_id,
    userId: row.user_id,
    merchantId: row.merchant_id,
    shopName: row.shop_name,
    type: row.type,
    reason: row.reason,
    status: row.status,
    appliedAt: toIso(row.applied_at),
    merchantDeadline: toIso(row.merchant_deadline),
    auditReason: row.audit_reason || null,
    auditedAt: toIso(row.audited_at),
    escalatedAt: toIso(row.escalated_at),
    items: Array.isArray(items) ? items : [],
  };
}

export async function findById(afterSaleId) {
  const [rows] = await pool.query('SELECT * FROM after_sales WHERE after_sale_id = ? LIMIT 1', [afterSaleId]);
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function listByOrderId(orderId) {
  const [rows] = await pool.query(
    'SELECT * FROM after_sales WHERE order_id = ? ORDER BY applied_at DESC',
    [orderId],
  );
  return rows.map(mapRow);
}

export async function create({
  orderId,
  orderNo,
  subOrderId,
  userId,
  merchantId,
  shopName,
  type,
  reason,
  status,
  appliedAt,
  merchantDeadline,
  items,
}) {
  const [result] = await pool.query(
    `INSERT INTO after_sales (
      order_id, order_no, sub_order_id, user_id, merchant_id, shop_name,
      type, reason, status, applied_at, merchant_deadline, items
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      orderId,
      orderNo,
      subOrderId,
      userId,
      merchantId,
      shopName,
      type,
      reason,
      status,
      toMysqlDateTime(appliedAt),
      toMysqlDateTime(merchantDeadline),
      JSON.stringify(items || []),
    ],
  );
  return findById(result.insertId);
}

export async function escalate(afterSaleId, escalatedAt) {
  await pool.query(
    `UPDATE after_sales SET status = 'ESCALATED', escalated_at = ? WHERE after_sale_id = ?`,
    [toMysqlDateTime(escalatedAt), afterSaleId],
  );
  return findById(afterSaleId);
}

export async function listByMerchant(merchantId, status) {
  let sql = 'SELECT * FROM after_sales WHERE merchant_id = ?';
  const params = [merchantId];
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  sql += ' ORDER BY applied_at DESC';
  const [rows] = await pool.query(sql, params);
  return rows.map(mapRow);
}

export async function listEscalated(page = 1, pageSize = 20) {
  return listAdmin({ status: 'ESCALATED', page, pageSize });
}

/**
 * @param {{ status?: string|string[], page?: number, pageSize?: number }} opts
 * status: ESCALATED | REFUNDED | REJECTED | COMPLETED(REFUNDED+REJECTED) | ALL
 */
export async function listAdmin({ status = 'ESCALATED', page = 1, pageSize = 20 } = {}) {
  let statuses;
  if (status === 'COMPLETED') {
    statuses = ['REFUNDED', 'REJECTED'];
  } else if (status === 'ALL' || status == null || status === '') {
    statuses = null;
  } else if (Array.isArray(status)) {
    statuses = status;
  } else {
    statuses = [status];
  }

  let countSql = 'SELECT COUNT(*) AS cnt FROM after_sales';
  let listSql = 'SELECT * FROM after_sales';
  const params = [];
  if (statuses?.length) {
    const placeholders = statuses.map(() => '?').join(',');
    const where = ` WHERE status IN (${placeholders})`;
    countSql += where;
    listSql += where;
    params.push(...statuses);
  }
  listSql += ' ORDER BY COALESCE(audited_at, escalated_at, applied_at) DESC LIMIT ? OFFSET ?';

  const [countRows] = await pool.query(countSql, params);
  const total = Number(countRows[0]?.cnt) || 0;
  const offset = (page - 1) * pageSize;
  const [rows] = await pool.query(listSql, [...params, pageSize, offset]);
  return { total, list: rows.map(mapRow) };
}

export async function listRecentEscalated(limit = 5) {
  const [rows] = await pool.query(
    `SELECT * FROM after_sales WHERE status = 'ESCALATED' ORDER BY applied_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map(mapRow);
}

export async function countByStatus(status) {
  const [rows] = await pool.query('SELECT COUNT(*) AS cnt FROM after_sales WHERE status = ?', [status]);
  return Number(rows[0]?.cnt) || 0;
}

export async function updateAudit(afterSaleId, { status, auditReason, auditedAt }) {
  await pool.query(
    'UPDATE after_sales SET status = ?, audit_reason = ?, audited_at = ? WHERE after_sale_id = ?',
    [status, auditReason, toMysqlDateTime(auditedAt), afterSaleId],
  );
  return findById(afterSaleId);
}

/** 领域规则：商家 48h 未处理 APPLIED → ESCALATED */
export async function escalateOverdue(now = new Date()) {
  const [result] = await pool.query(
    `UPDATE after_sales
     SET status = 'ESCALATED', escalated_at = ?
     WHERE status = 'APPLIED' AND merchant_deadline < ?`,
    [toMysqlDateTime(now), toMysqlDateTime(now)],
  );
  return Number(result.affectedRows) || 0;
}

export function serialize(item) {
  return {
    afterSaleId: item.afterSaleId,
    orderId: item.orderId,
    subOrderId: item.subOrderId,
    merchantId: item.merchantId,
    userId: item.userId,
    type: item.type,
    reason: item.reason,
    status: item.status,
    appliedAt: item.appliedAt,
    merchantDeadline: item.merchantDeadline,
    auditReason: item.auditReason || null,
    auditedAt: item.auditedAt || null,
    escalatedAt: item.escalatedAt || null,
    orderNo: item.orderNo,
    shopName: item.shopName,
    items: item.items || [],
  };
}
