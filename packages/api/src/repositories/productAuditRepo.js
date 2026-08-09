import pool, { mapProductAuditRow } from '../db/pool.js';

export async function countAll() {
  const [rows] = await pool.query('SELECT COUNT(*) AS cnt FROM product_audits');
  return Number(rows[0]?.cnt) || 0;
}

export async function insertAudit({ spuId, adminId, approved, reason, auditedAt }) {
  const [result] = await pool.query(
    `INSERT INTO product_audits (spu_id, admin_id, approved, reason, audited_at)
     VALUES (?, ?, ?, ?, ?)`,
    [spuId, adminId, approved ? 1 : 0, reason || null, auditedAt],
  );
  return { id: result.insertId, spuId, adminId, approved, reason, auditedAt };
}

export async function listAudits({ approved, page = 1, pageSize = 20 } = {}) {
  let where = '';
  const params = [];
  if (approved === true) {
    where = 'WHERE approved = 1';
  } else if (approved === false) {
    where = 'WHERE approved = 0';
  }
  const [countRows] = await pool.query(`SELECT COUNT(*) AS cnt FROM product_audits ${where}`, params);
  const total = Number(countRows[0]?.cnt) || 0;
  const offset = (page - 1) * pageSize;
  const [rows] = await pool.query(
    `SELECT id, spu_id, admin_id, approved, reason, audited_at
     FROM product_audits ${where}
     ORDER BY audited_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );
  return { total, list: rows.map(mapProductAuditRow) };
}
