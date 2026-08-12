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

function isDbClient(value) {
  return value && typeof value.query === 'function';
}

function resolveDbAndArgs(args) {
  if (isDbClient(args[0])) {
    return {
      db: args[0],
      skuId: args[1],
      quantity: args[2],
    };
  }
  return {
    db: pool,
    skuId: args[0],
    quantity: args[1],
  };
}

export async function getStock(...args) {
  const { db, skuId } = resolveDbAndArgs(args);
  const [rows] = await db.query(
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

export async function setAvailable(conn, skuId, available) {
  const db = conn || pool;
  const value = Number(available);
  if (!Number.isInteger(value) || value < 0) {
    return { error: 'INVALID_AVAILABLE', message: '可用库存必须是不小于 0 的整数' };
  }
  const stock = await getStock(db, skuId);
  if (!stock) return { error: 'SKU_NOT_FOUND', message: 'SKU 不存在' };
  await db.query(
    `UPDATE stocks
     SET available = ?, updated_at = NOW(3)
     WHERE sku_id = ?`,
    [value, skuId],
  );
  return { ok: true, stock: await getStock(db, skuId) };
}

export async function lockStock(...args) {
  const { db, skuId, quantity } = resolveDbAndArgs(args);
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty <= 0) {
    return { error: 'INVALID_QTY', message: '数量无效' };
  }
  const [result] = await db.query(
    `UPDATE stocks
     SET available = available - ?, locked = locked + ?, updated_at = NOW(3)
     WHERE sku_id = ? AND available >= ?`,
    [qty, qty, skuId, qty],
  );
  if (result.affectedRows === 0) {
    const stock = await getStock(db, skuId);
    if (!stock) return { error: 'SKU_NOT_FOUND', message: 'SKU 不存在' };
    return { error: 'INSUFFICIENT_STOCK', message: '库存不足' };
  }
  return { ok: true, stock: await getStock(db, skuId) };
}

export async function releaseStock(...args) {
  const { db, skuId, quantity } = resolveDbAndArgs(args);
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty <= 0) {
    return { error: 'INVALID_QTY', message: '数量无效' };
  }
  const [result] = await db.query(
    `UPDATE stocks
     SET available = available + ?, locked = locked - ?, updated_at = NOW(3)
     WHERE sku_id = ? AND locked >= ?`,
    [qty, qty, skuId, qty],
  );
  if (result.affectedRows === 0) {
    const stock = await getStock(db, skuId);
    if (!stock) return { error: 'SKU_NOT_FOUND', message: 'SKU 不存在' };
    return { error: 'INSUFFICIENT_LOCKED_STOCK', message: '锁定库存不足' };
  }
  return { ok: true, stock: await getStock(db, skuId) };
}

export async function deductStock(...args) {
  const { db, skuId, quantity } = resolveDbAndArgs(args);
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty <= 0) {
    return { error: 'INVALID_QTY', message: '数量无效' };
  }
  const [result] = await db.query(
    `UPDATE stocks
     SET locked = locked - ?, updated_at = NOW(3)
     WHERE sku_id = ? AND locked >= ?`,
    [qty, skuId, qty],
  );
  if (result.affectedRows === 0) {
    const stock = await getStock(db, skuId);
    if (!stock) return { error: 'SKU_NOT_FOUND', message: 'SKU 不存在' };
    return { error: 'INSUFFICIENT_LOCKED_STOCK', message: '锁定库存不足' };
  }
  return { ok: true, stock: await getStock(db, skuId) };
}

/** 售后退款完成：已售出库存回滚到 available（支付后 locked 已扣减，不能用 releaseStock） */
export async function restoreAvailable(...args) {
  const { db, skuId, quantity } = resolveDbAndArgs(args);
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty <= 0) {
    return { error: 'INVALID_QTY', message: '数量无效' };
  }
  const stock = await getStock(db, skuId);
  if (!stock) return { error: 'SKU_NOT_FOUND', message: 'SKU 不存在' };
  await db.query(
    `UPDATE stocks
     SET available = available + ?, updated_at = NOW(3)
     WHERE sku_id = ?`,
    [qty, skuId],
  );
  return { ok: true, stock: await getStock(db, skuId) };
}
