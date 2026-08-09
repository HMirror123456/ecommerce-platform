import pool, { toIso } from '../db/pool.js';

function mapStockRow(row) {
  if (!row) return null;
  return {
    skuId: row.sku_id,
    available: Number(row.available) || 0,
    locked: Number(row.locked) || 0,
    updatedAt: toIso(row.updated_at),
  };
}

export async function getStock(skuId) {
  const [rows] = await pool.query(
    `SELECT sku_id, available, locked, updated_at
     FROM stocks
     WHERE sku_id = ?
     LIMIT 1`,
    [skuId],
  );
  return mapStockRow(rows[0]);
}

export async function listBySkuIds(skuIds) {
  if (!skuIds.length) return new Map();
  const placeholders = skuIds.map(() => '?').join(',');
  const [rows] = await pool.query(
    `SELECT sku_id, available, locked, updated_at
     FROM stocks
     WHERE sku_id IN (${placeholders})`,
    skuIds,
  );
  return new Map(rows.map((row) => [row.sku_id, mapStockRow(row)]));
}

export async function createStock(conn, { skuId, available, locked = 0, updatedAt = new Date() }) {
  const db = conn || pool;
  await db.query(
    `INSERT INTO stocks (sku_id, available, locked, updated_at)
     VALUES (?, ?, ?, ?)`,
    [skuId, available, locked, updatedAt],
  );
}

export async function lockStock(skuId, quantity) {
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty <= 0) {
    return { error: 'INVALID_QTY', message: '数量无效' };
  }
  const [result] = await pool.query(
    `UPDATE stocks
     SET available = available - ?, locked = locked + ?, updated_at = NOW(3)
     WHERE sku_id = ? AND available >= ?`,
    [qty, qty, skuId, qty],
  );
  if (result.affectedRows === 0) {
    const stock = await getStock(skuId);
    if (!stock) return { error: 'SKU_NOT_FOUND', message: 'SKU 不存在' };
    return { error: 'INSUFFICIENT_STOCK', message: '库存不足' };
  }
  return { ok: true, stock: await getStock(skuId) };
}

export async function releaseStock(skuId, quantity) {
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty <= 0) {
    return { error: 'INVALID_QTY', message: '数量无效' };
  }
  const [result] = await pool.query(
    `UPDATE stocks
     SET available = available + ?, locked = locked - ?, updated_at = NOW(3)
     WHERE sku_id = ? AND locked >= ?`,
    [qty, qty, skuId, qty],
  );
  if (result.affectedRows === 0) {
    const stock = await getStock(skuId);
    if (!stock) return { error: 'SKU_NOT_FOUND', message: 'SKU 不存在' };
    return { error: 'INSUFFICIENT_LOCKED_STOCK', message: '锁定库存不足' };
  }
  return { ok: true, stock: await getStock(skuId) };
}

export async function deductStock(skuId, quantity) {
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty <= 0) {
    return { error: 'INVALID_QTY', message: '数量无效' };
  }
  const [result] = await pool.query(
    `UPDATE stocks
     SET locked = locked - ?, updated_at = NOW(3)
     WHERE sku_id = ? AND locked >= ?`,
    [qty, skuId, qty],
  );
  if (result.affectedRows === 0) {
    const stock = await getStock(skuId);
    if (!stock) return { error: 'SKU_NOT_FOUND', message: 'SKU 不存在' };
    return { error: 'INSUFFICIENT_LOCKED_STOCK', message: '锁定库存不足' };
  }
  return { ok: true, stock: await getStock(skuId) };
}
