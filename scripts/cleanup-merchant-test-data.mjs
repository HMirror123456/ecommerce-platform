import pool from '../packages/api/src/db/pool.js';

const dryRun = process.argv.includes('--dry-run');

const productTitlePrefixes = [
  'merchant batch',
  'merchant product flow',
  '演示商品-',
  '批量测试商品-',
  '商品生命周期测试-',
  '演示验证-',
  '批量验证-',
  '生命周期验证-',
  '权限验证-',
  '售后验证-',
  '发货验证-',
];

const productDescriptionPrefixes = [
  '演示验证-',
  '批量验证-',
  '生命周期验证-',
  '权限验证-',
  '售后验证-',
  '发货验证-',
];

const orderRemarkPrefixes = [
  'verify merchant after sale',
  'verify merchant permissions',
  '商家发货验证订单-',
  '商家售后验证订单-',
  '商家权限验证订单-',
  '演示验证-',
  '批量验证-',
  '生命周期验证-',
  '权限验证-',
  '售后验证-',
  '发货验证-',
];

const afterSaleReasonPrefixes = [
  'verify merchant',
  'verify escalated boundary',
  'verify repeated after-sale processing',
];

const auditReasonPrefixes = [
  'verify reject reason',
  'verify first reject',
  '商家首次拒绝售后-',
];

const applicationShopPrefixes = [
  '联调入驻店',
  '驳回验证店',
  '演示入驻店-',
  '演示驳回店-',
  '演示验证-',
];

const applicationContactPrefixes = [
  '测试员',
  '演示验证-',
];

const generatedTrackingPrefixes = [
  'PERM',
  'VFY',
  'SF20260811',
  'ZT20260811',
  'YT20260811',
];

const generatedLogisticsCompanies = [
  'VERIFY物流',
  'VERIFY退货物流',
];

const tableExistsCache = new Map();

function likePatterns(prefixes) {
  return prefixes.map((prefix) => `${prefix}%`);
}

function buildLikeClause(column, prefixes) {
  const patterns = likePatterns(prefixes);
  return {
    sql: patterns.map(() => `${column} LIKE ?`).join(' OR '),
    params: patterns,
  };
}

function uniqueNumbers(values) {
  return [...new Set(values.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0))];
}

function placeholders(values) {
  return values.map(() => '?').join(',');
}

async function tableExists(table) {
  if (tableExistsCache.has(table)) return tableExistsCache.get(table);
  const [rows] = await pool.query('SHOW TABLES LIKE ?', [table]);
  const exists = rows.length > 0;
  tableExistsCache.set(table, exists);
  return exists;
}

async function selectIds(sql, params, column) {
  const [rows] = await pool.query(sql, params);
  return uniqueNumbers(rows.map((row) => row[column]));
}

async function countByIds(table, column, ids) {
  if (!ids.length || !(await tableExists(table))) return 0;
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS cnt FROM ${table} WHERE ${column} IN (${placeholders(ids)})`,
    ids,
  );
  return Number(rows[0]?.cnt) || 0;
}

async function collectProductIds() {
  const titleClause = buildLikeClause('title', productTitlePrefixes);
  const descriptionClause = buildLikeClause('description', productDescriptionPrefixes);
  return selectIds(
    `SELECT spu_id
     FROM spus
     WHERE ${titleClause.sql} OR ${descriptionClause.sql}`,
    [...titleClause.params, ...descriptionClause.params],
    'spu_id',
  );
}

async function collectApplicationIds() {
  const shopClause = buildLikeClause('shop_name', applicationShopPrefixes);
  const contactClause = buildLikeClause('contact_name', applicationContactPrefixes);
  return selectIds(
    `SELECT id
     FROM merchant_applications
     WHERE ${shopClause.sql} OR ${contactClause.sql}`,
    [...shopClause.params, ...contactClause.params],
    'id',
  );
}

async function collectApprovedMerchantIds(applicationIds) {
  const ids = [];
  if (applicationIds.length) {
    ids.push(...await selectIds(
      `SELECT approved_merchant_id
       FROM merchant_applications
       WHERE id IN (${placeholders(applicationIds)}) AND approved_merchant_id IS NOT NULL`,
      applicationIds,
      'approved_merchant_id',
    ));
  }

  const shopClause = buildLikeClause('shop_name', applicationShopPrefixes);
  ids.push(...await selectIds(
    `SELECT id
     FROM merchants
     WHERE (${shopClause.sql})
       AND id NOT IN (1, 2)
       AND username NOT IN ('merchant1', 'merchant2')`,
    shopClause.params,
    'id',
  ));
  return uniqueNumbers(ids);
}

async function collectOrderIds(productSpuIds) {
  const remarkClause = buildLikeClause('o.remark', orderRemarkPrefixes);
  const productTitleClause = buildLikeClause('oi.title', productTitlePrefixes);
  const trackingClause = buildLikeClause("JSON_UNQUOTE(JSON_EXTRACT(s.shipment, '$.trackingNo'))", generatedTrackingPrefixes);
  const logisticsIn = generatedLogisticsCompanies.map(() => '?').join(',');

  const ids = await selectIds(
    `SELECT DISTINCT o.order_id
     FROM orders o
     WHERE ${remarkClause.sql}`,
    remarkClause.params,
    'order_id',
  );

  ids.push(...await selectIds(
    `SELECT DISTINCT oi.order_id
     FROM order_items oi
     WHERE ${productTitleClause.sql}`,
    productTitleClause.params,
    'order_id',
  ));

  if (productSpuIds.length) {
    ids.push(...await selectIds(
      `SELECT DISTINCT oi.order_id
       FROM order_items oi
       JOIN skus sku ON sku.sku_id = oi.sku_id
       WHERE sku.spu_id IN (${placeholders(productSpuIds)})`,
      productSpuIds,
      'order_id',
    ));
  }

  ids.push(...await selectIds(
    `SELECT DISTINCT o.order_id
     FROM orders o
     JOIN sub_orders s ON s.order_id = o.order_id
     WHERE JSON_UNQUOTE(JSON_EXTRACT(s.shipment, '$.logisticsCompany')) IN (${logisticsIn})
        OR ${trackingClause.sql}`,
    [...generatedLogisticsCompanies, ...trackingClause.params],
    'order_id',
  ));

  return uniqueNumbers(ids);
}

async function collectAfterSaleIds(orderIds) {
  const reasonClause = buildLikeClause('reason', afterSaleReasonPrefixes);
  const auditClause = buildLikeClause('audit_reason', auditReasonPrefixes);
  const returnTrackingClause = buildLikeClause(
    "JSON_UNQUOTE(JSON_EXTRACT(return_shipment, '$.trackingNo'))",
    generatedTrackingPrefixes,
  );
  const returnLogisticsIn = generatedLogisticsCompanies.map(() => '?').join(',');

  const ids = await selectIds(
    `SELECT after_sale_id
     FROM after_sales
     WHERE ${reasonClause.sql}
        OR ${auditClause.sql}
        OR JSON_UNQUOTE(JSON_EXTRACT(return_shipment, '$.logisticsCompany')) IN (${returnLogisticsIn})
        OR ${returnTrackingClause.sql}`,
    [
      ...reasonClause.params,
      ...auditClause.params,
      ...generatedLogisticsCompanies,
      ...returnTrackingClause.params,
    ],
    'after_sale_id',
  );

  if (orderIds.length) {
    ids.push(...await selectIds(
      `SELECT after_sale_id
       FROM after_sales
       WHERE order_id IN (${placeholders(orderIds)})`,
      orderIds,
      'after_sale_id',
    ));
  }

  return uniqueNumbers(ids);
}

async function buildPlan() {
  const productSpuIds = await collectProductIds();
  const applicationIds = await collectApplicationIds();
  const approvedMerchantIds = await collectApprovedMerchantIds(applicationIds);
  const orderIds = await collectOrderIds(productSpuIds);
  const afterSaleIds = await collectAfterSaleIds(orderIds);
  const skuCount = productSpuIds.length ? await countByIds('skus', 'spu_id', productSpuIds) : 0;

  return {
    productSpuIds,
    applicationIds,
    approvedMerchantIds,
    orderIds,
    afterSaleIds,
    counts: {
      afterSales: afterSaleIds.length,
      payments: await countByIds('payments', 'order_id', orderIds),
      orderItems: await countByIds('order_items', 'order_id', orderIds),
      subOrders: await countByIds('sub_orders', 'order_id', orderIds),
      orders: orderIds.length,
      favorites: await countByIds('favorites', 'spu_id', productSpuIds),
      productAudits: await countByIds('product_audits', 'spu_id', productSpuIds),
      skus: skuCount,
      stocks: skuCount,
      products: productSpuIds.length,
      merchantApplications: applicationIds.length,
      generatedMerchants: approvedMerchantIds.length,
    },
  };
}

async function deleteByIds(conn, table, column, ids) {
  if (!ids.length || !(await tableExists(table))) return 0;
  const [result] = await conn.query(
    `DELETE FROM ${table} WHERE ${column} IN (${placeholders(ids)})`,
    ids,
  );
  return Number(result.affectedRows) || 0;
}

async function executeCleanup(plan) {
  const conn = await pool.getConnection();
  const deleted = {};
  try {
    await conn.beginTransaction();
    deleted.afterSales = await deleteByIds(conn, 'after_sales', 'after_sale_id', plan.afterSaleIds);
    deleted.payments = await deleteByIds(conn, 'payments', 'order_id', plan.orderIds);
    deleted.orderItems = await deleteByIds(conn, 'order_items', 'order_id', plan.orderIds);
    deleted.subOrders = await deleteByIds(conn, 'sub_orders', 'order_id', plan.orderIds);
    deleted.orders = await deleteByIds(conn, 'orders', 'order_id', plan.orderIds);
    deleted.favorites = await deleteByIds(conn, 'favorites', 'spu_id', plan.productSpuIds);
    deleted.productAudits = await deleteByIds(conn, 'product_audits', 'spu_id', plan.productSpuIds);
    deleted.products = await deleteByIds(conn, 'spus', 'spu_id', plan.productSpuIds);
    deleted.merchantApplications = await deleteByIds(conn, 'merchant_applications', 'id', plan.applicationIds);

    if (plan.approvedMerchantIds.length) {
      const [result] = await conn.query(
        `DELETE FROM merchants
         WHERE id IN (${placeholders(plan.approvedMerchantIds)})
           AND id NOT IN (1, 2)
           AND username NOT IN ('merchant1', 'merchant2')
           AND NOT EXISTS (SELECT 1 FROM spus WHERE spus.merchant_id = merchants.id)`,
        plan.approvedMerchantIds,
      );
      deleted.generatedMerchants = Number(result.affectedRows) || 0;
    } else {
      deleted.generatedMerchants = 0;
    }

    await conn.commit();
    return deleted;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

function printPlan(plan) {
  console.log('Merchant test data cleanup scope:');
  console.log('- Legacy products:', 'merchant batch, merchant product flow');
  console.log('- New test prefixes:', '演示验证-, 批量验证-, 生命周期验证-, 权限验证-, 售后验证-, 发货验证-');
  console.log('- Legacy logistics:', 'VERIFY物流, PERM*, VFY*');
  console.log('- Onboarding applications created by verification scripts');
  console.log('');
  for (const [name, count] of Object.entries(plan.counts)) {
    console.log(`${name}: ${count}`);
  }
}

async function main() {
  const plan = await buildPlan();
  printPlan(plan);

  if (dryRun) {
    console.log('\nDRY RUN only. No data was deleted.');
    return;
  }

  const deleted = await executeCleanup(plan);
  console.log('\nDeleted rows:');
  for (const [name, count] of Object.entries(deleted)) {
    console.log(`${name}: ${count}`);
  }
  console.log('\nCleanup complete.');
}

main()
  .catch((err) => {
    console.error('\nCleanup failed');
    console.error(err?.stack || err?.message || String(err));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
