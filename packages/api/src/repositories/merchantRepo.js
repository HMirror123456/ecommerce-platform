import pool, { mapMerchantRow } from '../db/pool.js';

export async function findMerchantByCredentials(username, password) {
  const [rows] = await pool.query(
    'SELECT id, username, password, shop_id, shop_name FROM merchants WHERE username = ? AND password = ? LIMIT 1',
    [username, password],
  );
  return mapMerchantRow(rows[0]);
}

export async function findMerchantById(id) {
  const [rows] = await pool.query(
    'SELECT id, username, password, shop_id, shop_name FROM merchants WHERE id = ? LIMIT 1',
    [id],
  );
  return mapMerchantRow(rows[0]);
}

export async function findMerchantUsernameById(id) {
  const [rows] = await pool.query('SELECT username FROM merchants WHERE id = ? LIMIT 1', [id]);
  return rows[0]?.username;
}

export async function getMaxMerchantId() {
  const [rows] = await pool.query('SELECT COALESCE(MAX(id), 0) AS maxId FROM merchants');
  return Number(rows[0]?.maxId) || 0;
}

export async function insertMerchant({ id, username, password, shopId, shopName }) {
  await pool.query(
    'INSERT INTO merchants (id, username, password, shop_id, shop_name) VALUES (?, ?, ?, ?, ?)',
    [id, username, password, shopId, shopName],
  );
  return findMerchantById(id);
}

export async function getNextMerchantId(conn) {
  const db = conn || pool;
  const [rows] = await db.query('SELECT COALESCE(MAX(id), 0) AS maxId FROM merchants');
  return Number(rows[0]?.maxId) + 1;
}
