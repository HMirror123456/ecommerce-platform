import pool, { mapAdminRow } from '../db/pool.js';

const ADMIN_COLUMNS = 'id, username, password, role, status, created_at';

export async function findAdminByCredentials(username, password) {
  const [rows] = await pool.query(
    `SELECT ${ADMIN_COLUMNS} FROM admins WHERE username = ? AND password = ? LIMIT 1`,
    [username, password],
  );
  return mapAdminRow(rows[0]);
}

export async function findAdminById(id) {
  const [rows] = await pool.query(
    `SELECT ${ADMIN_COLUMNS} FROM admins WHERE id = ? LIMIT 1`,
    [id],
  );
  return mapAdminRow(rows[0]);
}

export async function listAdmins({ role, status, keyword } = {}) {
  const where = [];
  const params = [];
  if (role) {
    where.push('role = ?');
    params.push(role);
  }
  if (status) {
    where.push('status = ?');
    params.push(status);
  }
  if (keyword?.trim()) {
    where.push('username LIKE ?');
    params.push(`%${keyword.trim()}%`);
  }
  const sql = `SELECT ${ADMIN_COLUMNS} FROM admins${where.length ? ` WHERE ${where.join(' AND ')}` : ''} ORDER BY id ASC`;
  const [rows] = await pool.query(sql, params);
  return rows.map((row) => toAdminAccount(mapAdminRow(row)));
}

export async function createAdmin({ username, password, role }) {
  if (!username || !password || !role) {
    return { error: 'INVALID', message: 'username、password、role 必填' };
  }
  if (role !== 'OPERATOR' && role !== 'CS_AGENT') {
    return { error: 'INVALID_ROLE', message: '仅允许创建 OPERATOR 或 CS_AGENT' };
  }
  const [existing] = await pool.query('SELECT id FROM admins WHERE username = ? LIMIT 1', [username]);
  if (existing.length) return { error: 'USERNAME_EXISTS', message: '用户名已存在' };

  const [result] = await pool.query(
    'INSERT INTO admins (username, password, role, status) VALUES (?, ?, ?, ?)',
    [username, password, role, 'ACTIVE'],
  );
  const admin = await findAdminById(result.insertId);
  return { admin: toAdminAccount(admin) };
}

export async function updateAdmin(adminId, { role, status, password }, actorId) {
  const target = await findAdminById(adminId);
  if (!target) return { error: 'NOT_FOUND', message: '管理员不存在' };

  if (role === undefined && status === undefined && password === undefined) {
    return { error: 'INVALID', message: '请提供 role、status 或 password' };
  }

  if (role !== undefined) {
    if (role !== 'OPERATOR' && role !== 'CS_AGENT') {
      return { error: 'INVALID_ROLE', message: '角色仅允许改为 OPERATOR 或 CS_AGENT' };
    }
    if (target.role === 'SUPER_ADMIN') {
      return { error: 'INVALID', message: '不可修改超级管理员角色' };
    }
  }

  if (status !== undefined) {
    if (status !== 'ACTIVE' && status !== 'DISABLED') {
      return { error: 'INVALID', message: 'status 仅支持 ACTIVE / DISABLED' };
    }
    if (status === 'DISABLED' && target.id === actorId) {
      return { error: 'INVALID', message: '不可禁用自己' };
    }
    if (status === 'DISABLED' && target.role === 'SUPER_ADMIN' && target.status === 'ACTIVE') {
      const [rows] = await pool.query(
        "SELECT COUNT(*) AS cnt FROM admins WHERE role = 'SUPER_ADMIN' AND status = 'ACTIVE'",
      );
      if (Number(rows[0].cnt) <= 1) {
        return { error: 'INVALID', message: '不可禁用最后一个超级管理员' };
      }
    }
  }

  if (password !== undefined && !password) {
    return { error: 'INVALID', message: '密码不能为空' };
  }

  const sets = [];
  const params = [];
  if (role !== undefined) {
    sets.push('role = ?');
    params.push(role);
  }
  if (status !== undefined) {
    sets.push('status = ?');
    params.push(status);
  }
  if (password !== undefined) {
    sets.push('password = ?');
    params.push(password);
  }
  params.push(adminId);
  await pool.query(`UPDATE admins SET ${sets.join(', ')} WHERE id = ?`, params);
  const admin = await findAdminById(adminId);
  return { admin: toAdminAccount(admin) };
}

export async function deleteAdmin(adminId, actorId) {
  const target = await findAdminById(adminId);
  if (!target) return { error: 'NOT_FOUND', message: '管理员不存在' };
  if (target.id === actorId) {
    return { error: 'INVALID', message: '不可删除自己' };
  }
  if (target.role === 'SUPER_ADMIN') {
    return { error: 'INVALID', message: '不可删除超级管理员' };
  }
  if (target.role !== 'OPERATOR' && target.role !== 'CS_AGENT') {
    return { error: 'INVALID', message: '仅可删除运营或客服账号' };
  }
  await pool.query('DELETE FROM admins WHERE id = ?', [adminId]);
  return { ok: true };
}

function toAdminAccount(admin) {
  if (!admin) return null;
  return {
    id: admin.id,
    username: admin.username,
    role: admin.role,
    status: admin.status || 'ACTIVE',
    createdAt: admin.createdAt,
  };
}
