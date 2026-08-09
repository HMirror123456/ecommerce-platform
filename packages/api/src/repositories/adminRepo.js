import pool, { mapAdminRow } from '../db/pool.js';

export async function findAdminByCredentials(username, password) {
  const [rows] = await pool.query(
    'SELECT id, username, password, role FROM admins WHERE username = ? AND password = ? LIMIT 1',
    [username, password],
  );
  return mapAdminRow(rows[0]);
}

export async function findAdminById(id) {
  const [rows] = await pool.query(
    'SELECT id, username, password, role FROM admins WHERE id = ? LIMIT 1',
    [id],
  );
  return mapAdminRow(rows[0]);
}
