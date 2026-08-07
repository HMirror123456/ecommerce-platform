import pool, { toIso } from '../db/pool.js';

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
  const [countRows] = await pool.query(`SELECT COUNT(*) AS cnt FROM after_sales WHERE status = 'ESCALATED'`);
  const total = Number(countRows[0]?.cnt) || 0;
  const offset = (page - 1) * pageSize;
  const [rows] = await pool.query(
    `SELECT * FROM after_sales WHERE status = 'ESCALATED' ORDER BY applied_at DESC LIMIT ? OFFSET ?`,
    [pageSize, offset],
  );
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
    [status, auditReason, auditedAt, afterSaleId],
  );
  return findById(afterSaleId);
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
    orderNo: item.orderNo,
    shopName: item.shopName,
    items: item.items || [],
  };
}
