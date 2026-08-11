import pool, { toIso, toMysqlDateTime } from '../db/pool.js';

function mapRow(row) {
  return {
    favoriteId: row.id,
    userId: row.user_id,
    spuId: row.spu_id,
    createdAt: toIso(row.created_at),
  };
}

export async function listByUser(userId) {
  const [rows] = await pool.query(
    'SELECT id, user_id, spu_id, created_at FROM favorites WHERE user_id = ? ORDER BY created_at DESC',
    [userId],
  );
  return rows.map(mapRow);
}

export async function findByUserAndSpu(userId, spuId) {
  const [rows] = await pool.query(
    'SELECT id, user_id, spu_id, created_at FROM favorites WHERE user_id = ? AND spu_id = ? LIMIT 1',
    [userId, spuId],
  );
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function create(userId, spuId, createdAt = new Date()) {
  const [result] = await pool.query(
    'INSERT INTO favorites (user_id, spu_id, created_at) VALUES (?, ?, ?)',
    [userId, spuId, toMysqlDateTime(createdAt)],
  );
  return {
    favoriteId: result.insertId,
    userId,
    spuId,
    createdAt: toIso(createdAt),
  };
}

export async function remove(userId, spuId) {
  const [result] = await pool.query('DELETE FROM favorites WHERE user_id = ? AND spu_id = ?', [
    userId,
    spuId,
  ]);
  return result.affectedRows > 0;
}
