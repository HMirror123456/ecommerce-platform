import pool, { mapApplicationRow, toMysqlDateTime } from '../db/pool.js';
import * as merchantRepo from './merchantRepo.js';

const APPLICATION_SELECT = `
  SELECT a.id, a.shop_name, a.contact_name, a.contact_phone, a.status,
         a.applied_at, a.audited_at, a.reject_reason, a.approved_merchant_id, a.admin_id,
         m.username AS merchant_username
  FROM merchant_applications a
  LEFT JOIN merchants m ON m.id = a.approved_merchant_id
`;

export async function countByStatus(status) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS cnt FROM merchant_applications WHERE status = ?',
    [status],
  );
  return Number(rows[0]?.cnt) || 0;
}

export async function findPending() {
  const [rows] = await pool.query(
    `${APPLICATION_SELECT} WHERE a.status = 'PENDING' ORDER BY a.applied_at ASC`,
  );
  return rows.map(mapApplicationRow);
}

export async function findRecentPending(limit = 5) {
  const [rows] = await pool.query(
    `${APPLICATION_SELECT} WHERE a.status = 'PENDING' ORDER BY a.applied_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map(mapApplicationRow);
}

export async function findById(id) {
  const [rows] = await pool.query(`${APPLICATION_SELECT} WHERE a.id = ? LIMIT 1`, [id]);
  return mapApplicationRow(rows[0]);
}

export async function findByPhone(contactPhone) {
  const [rows] = await pool.query(
    `${APPLICATION_SELECT} WHERE a.contact_phone = ? ORDER BY a.applied_at DESC`,
    [contactPhone],
  );
  return rows.map(mapApplicationRow);
}

export async function findPendingByPhone(contactPhone) {
  const [rows] = await pool.query(
    `${APPLICATION_SELECT} WHERE a.contact_phone = ? AND a.status = 'PENDING' LIMIT 1`,
    [contactPhone],
  );
  return mapApplicationRow(rows[0]);
}

export async function findApprovedByPhone(contactPhone) {
  const [rows] = await pool.query(
    `${APPLICATION_SELECT} WHERE a.contact_phone = ? AND a.status = 'APPROVED' LIMIT 1`,
    [contactPhone],
  );
  return mapApplicationRow(rows[0]);
}

export async function listApplications({ status, page = 1, pageSize = 20 } = {}) {
  let where = '';
  const params = [];
  if (status && status !== 'ALL') {
    const statuses = String(status).split(',').map((s) => s.trim());
    where = `WHERE a.status IN (${statuses.map(() => '?').join(',')})`;
    params.push(...statuses);
  }
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM merchant_applications a ${where}`,
    params,
  );
  const total = Number(countRows[0]?.cnt) || 0;
  const offset = (page - 1) * pageSize;
  const [rows] = await pool.query(
    `${APPLICATION_SELECT} ${where} ORDER BY a.applied_at DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );
  return { total, list: rows.map(mapApplicationRow) };
}

export async function insertApplication({ shopName, contactName, contactPhone, appliedAt }) {
  const [result] = await pool.query(
    `INSERT INTO merchant_applications (shop_name, contact_name, contact_phone, status, applied_at)
     VALUES (?, ?, ?, 'PENDING', ?)`,
    [shopName, contactName, contactPhone, toMysqlDateTime(appliedAt)],
  );
  return findById(result.insertId);
}

export async function getMaxApplicationId() {
  const [rows] = await pool.query('SELECT COALESCE(MAX(id), 0) AS maxId FROM merchant_applications');
  return Number(rows[0]?.maxId) || 0;
}

export async function auditApplication(applicationId, adminId, approved, reason) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT id, shop_name, contact_name, contact_phone, status
       FROM merchant_applications WHERE id = ? AND status = 'PENDING' FOR UPDATE`,
      [applicationId],
    );
    const row = rows[0];
    if (!row) {
      await conn.rollback();
      return { error: 'NOT_FOUND', message: '入驻申请不存在或已处理' };
    }

    const auditedAt = toMysqlDateTime(new Date());
    const shopName = row.shop_name;
    if (approved) {
      const merchantId = await merchantRepo.getNextMerchantId(conn);
      const username = `merchant${merchantId}`;
      await conn.query(
        'INSERT INTO merchants (id, username, password, shop_id, shop_name) VALUES (?, ?, ?, ?, ?)',
        [merchantId, username, '123456', merchantId, shopName],
      );
      await conn.query(
        `UPDATE merchant_applications
         SET status = 'APPROVED', audited_at = ?, admin_id = ?, approved_merchant_id = ?, reject_reason = NULL
         WHERE id = ?`,
        [auditedAt, adminId, merchantId, applicationId],
      );
      await conn.commit();
      return {
        applicationId,
        status: 'APPROVED',
        merchant: {
          merchantId,
          username,
          shopId: merchantId,
          shopName,
        },
        message: `审核通过，商家账号 ${username} / 123456`,
      };
    }

    await conn.query(
      `UPDATE merchant_applications
       SET status = 'REJECTED', audited_at = ?, admin_id = ?, reject_reason = ?
       WHERE id = ?`,
      [auditedAt, adminId, reason.trim(), applicationId],
    );
    await conn.commit();
    return {
      applicationId,
      status: 'REJECTED',
      message: '已驳回',
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
