import pool, { toIso } from '../db/pool.js';
import * as categoryRepo from './categoryRepo.js';
import * as stockRepo from './stockRepo.js';

function parseJson(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function buildRootNameMap(nodes, rootName = null, map = new Map()) {
  for (const node of nodes) {
    const currentRootName = rootName || node.name;
    map.set(node.id, currentRootName);
    buildRootNameMap(node.children || [], currentRootName, map);
  }
  return map;
}

function mapSkuRow(row, stock) {
  return {
    skuId: row.sku_id,
    specJson: parseJson(row.spec_json),
    price: Number(row.price),
    stock: {
      available: stock?.available ?? 0,
      locked: stock?.locked ?? 0,
    },
  };
}

function mapProductRow(row, skus, categoryNameMap) {
  return {
    spuId: row.spu_id,
    shopId: row.shop_id,
    shopName: row.shop_name,
    merchantId: row.merchant_id,
    categoryId: row.category_id,
    categoryName: categoryNameMap.get(row.category_id) || null,
    title: row.title,
    description: row.description,
    mainImage: row.main_image,
    status: row.status,
    submittedAt: toIso(row.submitted_at),
    rejectReason: row.reject_reason || undefined,
    skus,
  };
}

async function loadProductGraphs(spuIds) {
  if (!spuIds.length) return [];
  const placeholders = spuIds.map(() => '?').join(',');
  const [spuRows] = await pool.query(
    `SELECT *
     FROM spus
     WHERE spu_id IN (${placeholders})
     ORDER BY spu_id ASC`,
    spuIds,
  );
  const [skuRows] = await pool.query(
    `SELECT sku_id, spu_id, spec_json, price
     FROM skus
     WHERE spu_id IN (${placeholders})
     ORDER BY sku_id ASC`,
    spuIds,
  );
  const stockMap = await stockRepo.listBySkuIds(skuRows.map((row) => row.sku_id));
  const categoryNameMap = buildRootNameMap(await categoryRepo.listTree());
  return spuRows.map((row) => {
    const skus = skuRows
      .filter((sku) => sku.spu_id === row.spu_id)
      .map((sku) => mapSkuRow(sku, stockMap.get(sku.sku_id)));
    return mapProductRow(row, skus, categoryNameMap);
  });
}

function serializePublicSummary(product) {
  const prices = product.skus.map((sku) => sku.price);
  return {
    spuId: product.spuId,
    categoryId: product.categoryId,
    categoryName: product.categoryName,
    title: product.title,
    mainImage: product.mainImage,
    minPrice: prices.length ? Math.min(...prices) : 0,
  };
}

function serializePublicDetail(product) {
  return {
    spuId: product.spuId,
    categoryId: product.categoryId,
    categoryName: product.categoryName,
    title: product.title,
    description: product.description,
    mainImage: product.mainImage,
    shopName: product.shopName,
    skus: product.skus.map((sku) => ({
      skuId: sku.skuId,
      specJson: sku.specJson,
      price: sku.price,
      stock: sku.stock.available,
    })),
  };
}

function mapPendingRow(row) {
  return {
    spuId: row.spu_id,
    title: row.title,
    shopName: row.shop_name,
    merchantId: row.merchant_id,
    mainImage: row.main_image,
    submittedAt: toIso(row.submitted_at),
  };
}

export async function listPublicProducts({ page = 1, pageSize = 20, categoryIds } = {}) {
  const where = ['status = ?'];
  const params = ['ON_SHELF'];
  if (Array.isArray(categoryIds) && categoryIds.length) {
    where.push(`category_id IN (${categoryIds.map(() => '?').join(',')})`);
    params.push(...categoryIds);
  }

  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM spus WHERE ${where.join(' AND ')}`,
    params,
  );
  const total = Number(countRows[0]?.cnt) || 0;
  const offset = (page - 1) * pageSize;
  const [idRows] = await pool.query(
    `SELECT spu_id
     FROM spus
     WHERE ${where.join(' AND ')}
     ORDER BY spu_id ASC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );
  const products = await loadProductGraphs(idRows.map((row) => row.spu_id));
  return {
    total,
    list: products.map(serializePublicSummary),
  };
}

export async function findPublicProductDetail(spuId) {
  const [rows] = await pool.query(
    `SELECT spu_id FROM spus WHERE spu_id = ? AND status = 'ON_SHELF' LIMIT 1`,
    [spuId],
  );
  if (!rows[0]) return null;
  const [product] = await loadProductGraphs([rows[0].spu_id]);
  return product ? serializePublicDetail(product) : null;
}

export async function listByMerchant(merchantId) {
  const [rows] = await pool.query(
    `SELECT spu_id
     FROM spus
     WHERE merchant_id = ?
     ORDER BY spu_id ASC`,
    [merchantId],
  );
  const list = await loadProductGraphs(rows.map((row) => row.spu_id));
  return { total: list.length, list };
}

export async function findById(spuId) {
  const [rows] = await pool.query('SELECT spu_id FROM spus WHERE spu_id = ? LIMIT 1', [spuId]);
  if (!rows[0]) return null;
  const [product] = await loadProductGraphs([rows[0].spu_id]);
  return product || null;
}

export async function createMerchantProduct(merchant, payload) {
  const now = new Date();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [spuResult] = await conn.query(
      `INSERT INTO spus (
        shop_id, shop_name, merchant_id, category_id, title, description, main_image,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?, ?)`,
      [
        merchant.shopId,
        merchant.shopName,
        merchant.id,
        Number(payload.categoryId),
        payload.title.trim(),
        payload.description.trim(),
        payload.mainImage.trim(),
        now,
        now,
      ],
    );
    const spuId = spuResult.insertId;
    for (const sku of payload.skus) {
      const [skuResult] = await conn.query(
        `INSERT INTO skus (spu_id, spec_json, price, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [spuId, JSON.stringify(sku.specJson), Number(sku.price), now, now],
      );
      await stockRepo.createStock(conn, {
        skuId: skuResult.insertId,
        available: Number(sku.stock?.available) || 0,
        updatedAt: now,
      });
    }
    await conn.commit();
    const [product] = await loadProductGraphs([spuId]);
    return { product };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function findByMerchant(merchantId, spuId) {
  const product = await findById(spuId);
  if (!product) return { error: 'NOT_FOUND', message: 'Product not found' };
  if (product.merchantId !== merchantId) {
    return { error: 'FORBIDDEN', message: 'No permission to operate this product' };
  }
  return { product };
}

export async function updateMerchantProduct(merchant, spuId, payload) {
  const editableStatuses = ['DRAFT', 'REJECTED', 'OFF_SHELF'];
  const now = new Date();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [spuRows] = await conn.query(
      `SELECT spu_id, merchant_id, status
       FROM spus
       WHERE spu_id = ?
       LIMIT 1
       FOR UPDATE`,
      [spuId],
    );
    const spu = spuRows[0];
    if (!spu) {
      await conn.rollback();
      return { error: 'NOT_FOUND', message: 'Product not found' };
    }
    if (spu.merchant_id !== merchant.id) {
      await conn.rollback();
      return { error: 'FORBIDDEN', message: 'No permission to operate this product' };
    }
    if (!editableStatuses.includes(spu.status)) {
      await conn.rollback();
      return { error: 'INVALID_STATE', message: 'Current product status cannot be edited' };
    }

    const skuIds = payload.skus.map((sku) => Number(sku.skuId));
    const skuPlaceholders = skuIds.map(() => '?').join(',');
    const [skuRows] = await conn.query(
      `SELECT sku_id
       FROM skus
       WHERE spu_id = ? AND sku_id IN (${skuPlaceholders})
       FOR UPDATE`,
      [spuId, ...skuIds],
    );
    const ownedSkuIds = new Set(skuRows.map((row) => Number(row.sku_id)));
    if (ownedSkuIds.size !== skuIds.length || skuIds.some((skuId) => !ownedSkuIds.has(skuId))) {
      await conn.rollback();
      return { error: 'INVALID_INPUT', message: 'SKU does not belong to this product' };
    }

    await conn.query(
      `UPDATE spus
       SET category_id = ?, title = ?, description = ?, main_image = ?, updated_at = ?
       WHERE spu_id = ?`,
      [
        Number(payload.categoryId),
        payload.title.trim(),
        payload.description.trim(),
        payload.mainImage.trim(),
        now,
        spuId,
      ],
    );

    for (const sku of payload.skus) {
      await conn.query(
        `UPDATE skus
         SET spec_json = ?, price = ?, updated_at = ?
         WHERE spu_id = ? AND sku_id = ?`,
        [
          JSON.stringify(sku.specJson),
          Number(sku.price),
          now,
          spuId,
          Number(sku.skuId),
        ],
      );
    }

    await conn.commit();
    return { product: await findById(spuId) };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function offShelfMerchantProduct(merchant, spuId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT spu_id, merchant_id, status
       FROM spus
       WHERE spu_id = ?
       LIMIT 1
       FOR UPDATE`,
      [spuId],
    );
    const spu = rows[0];
    if (!spu) {
      await conn.rollback();
      return { error: 'NOT_FOUND', message: 'Product not found' };
    }
    if (spu.merchant_id !== merchant.id) {
      await conn.rollback();
      return { error: 'FORBIDDEN', message: 'No permission to operate this product' };
    }
    if (spu.status !== 'ON_SHELF') {
      await conn.rollback();
      return { error: 'INVALID_STATE', message: 'Only on-shelf products can be taken off shelf' };
    }

    await conn.query(
      `UPDATE spus
       SET status = 'OFF_SHELF', updated_at = ?
       WHERE spu_id = ?`,
      [new Date(), spuId],
    );
    await conn.commit();
    return {
      spuId,
      status: 'OFF_SHELF',
      message: 'Product taken off shelf',
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function submitMerchantProductAudit(merchant, spuId) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT spu_id, merchant_id, status
       FROM spus
       WHERE spu_id = ?
       LIMIT 1
       FOR UPDATE`,
      [spuId],
    );
    const spu = rows[0];
    if (!spu) {
      await conn.rollback();
      return { error: 'NOT_FOUND', message: 'Product not found' };
    }
    if (spu.merchant_id !== merchant.id) {
      await conn.rollback();
      return { error: 'FORBIDDEN', message: 'No permission to operate this product' };
    }
    if (spu.status !== 'DRAFT' && spu.status !== 'REJECTED') {
      await conn.rollback();
      return { error: 'INVALID_STATE', message: 'Only draft or rejected products can be submitted' };
    }

    const submittedAt = new Date();
    await conn.query(
      `UPDATE spus
       SET status = 'PENDING_AUDIT', submitted_at = ?, reject_reason = NULL, updated_at = ?
       WHERE spu_id = ?`,
      [submittedAt, submittedAt, spuId],
    );
    await conn.commit();
    return {
      spuId,
      status: 'PENDING_AUDIT',
      message: 'Product submitted for audit',
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function auditProduct(spuId, adminId, approved, reason) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT spu_id, status
       FROM spus
       WHERE spu_id = ?
       LIMIT 1
       FOR UPDATE`,
      [spuId],
    );
    const spu = rows[0];
    if (!spu) {
      await conn.rollback();
      return { error: 'NOT_FOUND', message: '商品不存在' };
    }
    if (spu.status !== 'PENDING_AUDIT') {
      await conn.rollback();
      return { error: 'INVALID_STATE', message: '商品不在待审核状态' };
    }
    if (!approved && !reason?.trim()) {
      await conn.rollback();
      return { error: 'REASON_REQUIRED', message: '驳回须填写原因' };
    }

    const auditedAt = new Date();
    await conn.query(
      `UPDATE spus
       SET status = ?, reject_reason = ?, updated_at = ?
       WHERE spu_id = ?`,
      [approved ? 'ON_SHELF' : 'REJECTED', approved ? null : reason.trim(), auditedAt, spuId],
    );
    await conn.query(
      `INSERT INTO product_audits (spu_id, admin_id, approved, reason, audited_at)
       VALUES (?, ?, ?, ?, ?)`,
      [spuId, adminId, approved ? 1 : 0, reason || null, auditedAt],
    );

    await conn.commit();
    return { spu: await findById(spuId) };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

export async function listPendingProducts(page = 1, pageSize = 20) {
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM spus WHERE status = 'PENDING_AUDIT'`,
  );
  const total = Number(countRows[0]?.cnt) || 0;
  const offset = (page - 1) * pageSize;
  const [rows] = await pool.query(
    `SELECT spu_id, title, shop_name, merchant_id, main_image, submitted_at
     FROM spus
     WHERE status = 'PENDING_AUDIT'
     ORDER BY submitted_at DESC, spu_id DESC
     LIMIT ? OFFSET ?`,
    [pageSize, offset],
  );
  return { total, list: rows.map(mapPendingRow) };
}

export async function listAuditHistory({ approved, page = 1, pageSize = 20 } = {}) {
  const where = [];
  const params = [];
  if (approved === true) {
    where.push('a.approved = 1');
  } else if (approved === false) {
    where.push('a.approved = 0');
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM product_audits a ${whereSql}`,
    params,
  );
  const total = Number(countRows[0]?.cnt) || 0;
  const offset = (page - 1) * pageSize;
  const [rows] = await pool.query(
    `SELECT
       a.id, a.spu_id, a.admin_id, a.approved, a.reason, a.audited_at,
       s.title, s.shop_name, s.merchant_id, s.main_image, s.status
     FROM product_audits a
     LEFT JOIN spus s ON s.spu_id = a.spu_id
     ${whereSql}
     ORDER BY a.audited_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );
  return {
    total,
    list: rows.map((row) => ({
      auditId: row.id,
      spuId: row.spu_id,
      approved: !!row.approved,
      reason: row.reason || undefined,
      auditedAt: toIso(row.audited_at),
      adminId: row.admin_id,
      title: row.title || '(商品不存在)',
      shopName: row.shop_name || undefined,
      merchantId: row.merchant_id || undefined,
      mainImage: row.main_image || undefined,
      status: row.status || undefined,
    })),
  };
}

export async function countByMerchantStatus(merchantId) {
  const [rows] = await pool.query(
    `SELECT status, COUNT(*) AS cnt
     FROM spus
     WHERE merchant_id = ?
     GROUP BY status`,
    [merchantId],
  );
  const counts = rows.reduce((map, row) => {
    map[row.status] = Number(row.cnt) || 0;
    return map;
  }, {});
  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
  return { total, counts };
}

export async function getDashboardProductSummary() {
  const [rows] = await pool.query(
    `SELECT status, COUNT(*) AS cnt
     FROM spus
     GROUP BY status`,
  );
  const counts = rows.reduce((map, row) => {
    map[row.status] = Number(row.cnt) || 0;
    return map;
  }, {});
  const [recentRows] = await pool.query(
    `SELECT spu_id, title, shop_name, submitted_at
     FROM spus
     WHERE status = 'PENDING_AUDIT'
     ORDER BY submitted_at DESC, spu_id DESC
     LIMIT 5`,
  );
  return {
    pendingProductCount: counts.PENDING_AUDIT || 0,
    onShelfProductCount: counts.ON_SHELF || 0,
    rejectedProductCount: counts.REJECTED || 0,
    recentPendingProducts: recentRows.map((row) => ({
      spuId: row.spu_id,
      title: row.title,
      shopName: row.shop_name,
      submittedAt: toIso(row.submitted_at),
    })),
  };
}
