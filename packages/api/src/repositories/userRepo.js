import pool, { toIso } from '../db/pool.js';

function mapAddressRow(row) {
  return {
    id: row.id,
    receiverName: row.receiver_name,
    phone: row.phone,
    province: row.province,
    city: row.city,
    district: row.district,
    detail: row.detail,
    isDefault: !!row.is_default,
  };
}

async function loadAddresses(userId) {
  const [rows] = await pool.query(
    'SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id ASC',
    [userId],
  );
  return rows.map(mapAddressRow);
}

function mapUserRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    phone: row.phone,
    password: row.password,
    nickname: row.nickname,
    avatarUrl: row.avatar_url || null,
  };
}

export async function findByPhone(phone, password) {
  const [rows] = await pool.query(
    'SELECT id, phone, password, nickname, avatar_url FROM users WHERE phone = ? AND password = ? LIMIT 1',
    [phone, password],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    ...mapUserRow(row),
    addresses: await loadAddresses(row.id),
  };
}

export async function findByPhoneOnly(phone) {
  const [rows] = await pool.query(
    'SELECT id, phone, password, nickname, avatar_url FROM users WHERE phone = ? LIMIT 1',
    [phone],
  );
  return mapUserRow(rows[0]);
}

export async function createUser({ phone, password, nickname }) {
  const [result] = await pool.query(
    'INSERT INTO users (phone, password, nickname) VALUES (?, ?, ?)',
    [phone, password, nickname || null],
  );
  return findById(result.insertId);
}

export async function findById(id) {
  const [rows] = await pool.query(
    'SELECT id, phone, password, nickname, avatar_url FROM users WHERE id = ? LIMIT 1',
    [id],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    ...mapUserRow(row),
    addresses: await loadAddresses(row.id),
  };
}

export async function updateProfile(userId, { nickname, password, avatarUrl }) {
  const sets = [];
  const params = [];
  if (nickname !== undefined) {
    sets.push('nickname = ?');
    params.push(nickname);
  }
  if (password !== undefined) {
    sets.push('password = ?');
    params.push(password);
  }
  if (avatarUrl !== undefined) {
    sets.push('avatar_url = ?');
    params.push(avatarUrl);
  }
  if (!sets.length) return findById(userId);
  params.push(userId);
  await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params);
  return findById(userId);
}

export async function findAddressById(userId, addressId) {
  const [rows] = await pool.query(
    'SELECT * FROM addresses WHERE user_id = ? AND id = ? LIMIT 1',
    [userId, addressId],
  );
  return rows[0] ? mapAddressRow(rows[0]) : null;
}

export async function listAddresses(userId) {
  return loadAddresses(userId);
}

export async function createAddress(userId, payload) {
  const { receiverName, phone, province, city, district, detail, isDefault } = payload;
  if (!receiverName?.trim() || !phone?.trim() || !province?.trim() || !city?.trim() || !district?.trim() || !detail?.trim()) {
    return { error: 'INVALID_INPUT', message: '请填写完整地址信息' };
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const makeDefault = !!isDefault;
    const [countRows] = await conn.query('SELECT COUNT(*) AS cnt FROM addresses WHERE user_id = ?', [userId]);
    const isFirst = Number(countRows[0]?.cnt) === 0;
    if (makeDefault || isFirst) {
      await conn.query('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [userId]);
    }
    const [result] = await conn.query(
      `INSERT INTO addresses (user_id, receiver_name, phone, province, city, district, detail, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        receiverName.trim(),
        phone.trim(),
        province.trim(),
        city.trim(),
        district.trim(),
        detail.trim(),
        makeDefault || isFirst ? 1 : 0,
      ],
    );
    await conn.commit();
    return { address: await findAddressById(userId, result.insertId) };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function updateAddress(userId, addressId, payload) {
  const existing = await findAddressById(userId, addressId);
  if (!existing) return { error: 'NOT_FOUND', message: '地址不存在' };
  const receiverName = payload.receiverName?.trim() ?? existing.receiverName;
  const phone = payload.phone?.trim() ?? existing.phone;
  const province = payload.province?.trim() ?? existing.province;
  const city = payload.city?.trim() ?? existing.city;
  const district = payload.district?.trim() ?? existing.district;
  const detail = payload.detail?.trim() ?? existing.detail;
  await pool.query(
    `UPDATE addresses SET receiver_name = ?, phone = ?, province = ?, city = ?, district = ?, detail = ?
     WHERE user_id = ? AND id = ?`,
    [receiverName, phone, province, city, district, detail, userId, addressId],
  );
  return { address: await findAddressById(userId, addressId) };
}

export async function deleteAddress(userId, addressId) {
  const existing = await findAddressById(userId, addressId);
  if (!existing) return { error: 'NOT_FOUND', message: '地址不存在' };
  await pool.query('DELETE FROM addresses WHERE user_id = ? AND id = ?', [userId, addressId]);
  if (existing.isDefault) {
    const [rows] = await pool.query('SELECT id FROM addresses WHERE user_id = ? ORDER BY id ASC LIMIT 1', [userId]);
    if (rows[0]) {
      await pool.query('UPDATE addresses SET is_default = 1 WHERE id = ?', [rows[0].id]);
    }
  }
  return { ok: true };
}

export async function setDefaultAddress(userId, addressId) {
  const existing = await findAddressById(userId, addressId);
  if (!existing) return { error: 'NOT_FOUND', message: '地址不存在' };
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [userId]);
    await conn.query('UPDATE addresses SET is_default = 1 WHERE user_id = ? AND id = ?', [userId, addressId]);
    await conn.commit();
    return { address: await findAddressById(userId, addressId) };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function listCartItems(userId) {
  const [rows] = await pool.query(
    'SELECT id, user_id, sku_id, quantity FROM cart_items WHERE user_id = ? ORDER BY id ASC',
    [userId],
  );
  return rows.map((row) => ({
    itemId: row.id,
    userId: row.user_id,
    skuId: row.sku_id,
    quantity: row.quantity,
  }));
}

export async function findCartItem(userId, itemId) {
  const [rows] = await pool.query(
    'SELECT id, user_id, sku_id, quantity FROM cart_items WHERE user_id = ? AND id = ? LIMIT 1',
    [userId, itemId],
  );
  const row = rows[0];
  if (!row) return null;
  return { itemId: row.id, userId: row.user_id, skuId: row.sku_id, quantity: row.quantity };
}

export async function findCartItemBySku(userId, skuId) {
  const [rows] = await pool.query(
    'SELECT id, user_id, sku_id, quantity FROM cart_items WHERE user_id = ? AND sku_id = ? LIMIT 1',
    [userId, skuId],
  );
  const row = rows[0];
  if (!row) return null;
  return { itemId: row.id, userId: row.user_id, skuId: row.sku_id, quantity: row.quantity };
}

export async function insertCartItem(userId, skuId, quantity) {
  const [result] = await pool.query(
    'INSERT INTO cart_items (user_id, sku_id, quantity) VALUES (?, ?, ?)',
    [userId, skuId, quantity],
  );
  return {
    itemId: result.insertId,
    userId,
    skuId,
    quantity,
  };
}

export async function updateCartItemQuantity(itemId, quantity) {
  await pool.query('UPDATE cart_items SET quantity = ? WHERE id = ?', [quantity, itemId]);
}

export async function deleteCartItem(itemId) {
  await pool.query('DELETE FROM cart_items WHERE id = ?', [itemId]);
}

/** 下单成功后清除购物车中已购买的 SKU */
export async function deleteCartItemsBySkuIds(userId, skuIds) {
  const ids = [...new Set((skuIds || []).map(Number).filter((id) => id > 0))];
  if (!ids.length) return;
  const placeholders = ids.map(() => '?').join(',');
  await pool.query(
    `DELETE FROM cart_items WHERE user_id = ? AND sku_id IN (${placeholders})`,
    [userId, ...ids],
  );
}

export { toIso };
