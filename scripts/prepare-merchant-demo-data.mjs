import { spawnSync } from 'child_process';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const BASE = process.env.API_BASE || 'http://localhost:8080/api';
const USER = { phone: '13800138000', password: '123456' };
const MERCHANT = { username: 'merchant1', password: '123456' };
const ADMIN = { username: 'operator', password: 'operator123' };
const ADDRESS_ID = 1;
const RUN_ID = String(Date.now()).slice(-6);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function request(method, requestPath, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + requestPath);
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          let json = null;
          try {
            json = raw ? JSON.parse(raw) : null;
          } catch {
            json = raw;
          }
          resolve({ status: res.statusCode, data: json });
        });
      },
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function getList(data) {
  return Array.isArray(data) ? data : Array.isArray(data?.list) ? data.list : [];
}

function findFirstCategoryId(nodes) {
  for (const node of nodes || []) {
    if (node?.enabled === false) continue;
    const childId = findFirstCategoryId(node.children || []);
    if (childId) return childId;
    if (Number.isInteger(Number(node?.id))) return Number(node.id);
  }
  return null;
}

function makeTracking(prefix, index) {
  return `${prefix}20260811${String(index).padStart(4, '0')}`;
}

function runCleanupIfRequested() {
  if (!process.argv.includes('--clean')) {
    console.log('TIP: 页面演示前建议先运行 node scripts/cleanup-merchant-test-data.mjs --dry-run');
    console.log('TIP: 需要自动清理并准备演示数据时，运行 node scripts/prepare-merchant-demo-data.mjs --clean');
    return;
  }

  console.log('RUN cleanup-merchant-test-data.mjs before preparing demo data');
  const result = spawnSync(process.execPath, [path.resolve(projectRoot, 'scripts/cleanup-merchant-test-data.mjs')], {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`cleanup-merchant-test-data.mjs failed with exit code ${result.status}`);
  }
}

async function login(pathname, account, label) {
  const response = await request('POST', pathname, { body: account });
  assert(response.status === 200 && response.data?.token, `FAIL ${label} login: ${JSON.stringify(response)}`);
  console.log(`PASS ${label} login`);
  return response.data;
}

async function createProduct(token, categoryId, payload) {
  const response = await request('POST', '/merchant/products', {
    token,
    body: { categoryId, ...payload },
  });
  assert(response.status === 201 && response.data?.spuId, `FAIL create product ${payload.title}: ${JSON.stringify(response)}`);
  return response.data;
}

async function submitProduct(token, spuId) {
  const response = await request('POST', `/merchant/products/${spuId}/submit-audit`, { token });
  assert(response.status === 200 && response.data?.status === 'PENDING_AUDIT', `FAIL submit product ${spuId}: ${JSON.stringify(response)}`);
}

async function approveProduct(token, spuId) {
  const response = await request('POST', `/admin/products/${spuId}/audit`, {
    token,
    body: { approved: true },
  });
  assert(response.status === 200 && response.data?.status === 'ON_SHELF', `FAIL approve product ${spuId}: ${JSON.stringify(response)}`);
}

async function takeOffShelfProduct(token, spuId) {
  const response = await request('POST', `/merchant/products/${spuId}/off-shelf`, { token });
  assert(response.status === 200 && response.data?.status === 'OFF_SHELF', `FAIL off shelf product ${spuId}: ${JSON.stringify(response)}`);
}

async function createPaidOrder({ userToken, skuId, remark }) {
  const created = await request('POST', '/orders', {
    token: userToken,
    body: {
      addressId: ADDRESS_ID,
      items: [{ skuId, quantity: 1 }],
      remark,
    },
  });
  assert(created.status === 201 && created.data?.orderId, `FAIL create order ${remark}: ${JSON.stringify(created)}`);
  const paid = await request('POST', `/orders/${created.data.orderId}/pay`, { token: userToken });
  assert(
    paid.status === 200 && paid.data?.order?.status === 'PENDING_SHIPMENT',
    `FAIL pay order ${remark}: ${JSON.stringify(paid)}`,
  );
  const subOrder = paid.data.order.subOrders?.[0];
  assert(subOrder?.subOrderId, `FAIL order has no sub-order ${remark}: ${JSON.stringify(paid.data.order)}`);
  return { orderId: created.data.orderId, subOrderId: subOrder.subOrderId };
}

async function shipOrder({ merchantToken, subOrderId, logisticsCompany, trackingNo }) {
  const response = await request('POST', `/merchant/orders/${subOrderId}/ship`, {
    token: merchantToken,
    body: { logisticsCompany, trackingNo },
  });
  assert(response.status === 200 && response.data?.status === 'SHIPPED', `FAIL ship order ${subOrderId}: ${JSON.stringify(response)}`);
}

async function createAfterSale({ userToken, orderId, subOrderId, type, reason }) {
  const response = await request('POST', `/orders/${orderId}/after-sales`, {
    token: userToken,
    body: { subOrderId, type, reason },
  });
  assert(response.status === 201 && response.data?.afterSaleId, `FAIL create after-sale: ${JSON.stringify(response)}`);
  return response.data;
}

async function auditAfterSale({ merchantToken, afterSaleId, approved, reason }) {
  const response = await request('POST', `/merchant/after-sales/${afterSaleId}/audit`, {
    token: merchantToken,
    body: { approved, reason },
  });
  assert(response.status === 200, `FAIL audit after-sale ${afterSaleId}: ${JSON.stringify(response)}`);
  return response.data.afterSale;
}

async function submitReturn({ userToken, orderId, afterSaleId, logisticsCompany, trackingNo }) {
  const response = await request('POST', `/orders/${orderId}/after-sales/${afterSaleId}/return`, {
    token: userToken,
    body: { logisticsCompany, trackingNo },
  });
  assert(response.status === 200 && response.data?.status === 'RETURNING', `FAIL submit return: ${JSON.stringify(response)}`);
  return response.data;
}

async function escalateAfterSale({ userToken, orderId, afterSaleId }) {
  const response = await request('POST', `/orders/${orderId}/after-sales/${afterSaleId}/escalate`, {
    token: userToken,
  });
  assert(response.status === 200 && response.data?.afterSale?.status === 'ESCALATED', `FAIL escalate after-sale: ${JSON.stringify(response)}`);
}

async function main() {
  console.log('PREPARE merchant demo data');
  runCleanupIfRequested();

  const userLogin = await login('/auth/user/login', USER, 'user');
  const merchantLogin = await login('/auth/merchant/login', MERCHANT, 'merchant');
  const adminLogin = await login('/auth/admin/login', ADMIN, 'admin');
  const userToken = userLogin.token;
  const merchantToken = merchantLogin.token;
  const adminToken = adminLogin.token;

  const categories = await request('GET', '/categories');
  assert(categories.status === 200, `FAIL query categories: ${JSON.stringify(categories)}`);
  const categoryId = findFirstCategoryId(getList(categories.data));
  assert(categoryId, `FAIL no available category: ${JSON.stringify(categories.data)}`);

  const pendingProduct = await createProduct(merchantToken, categoryId, {
    title: '蓝牙耳机-演示01',
    description: '演示验证-待审核商品，用于展示提交审核后的 PENDING_AUDIT 状态。',
    mainImage: `https://picsum.photos/seed/demo-earphone-${RUN_ID}/400/400`,
    skus: [
      { specJson: { 颜色: '曜石黑', 版本: '标准版' }, price: 299, stock: { available: 30 } },
    ],
  });
  await submitProduct(merchantToken, pendingProduct.spuId);

  const onShelfProduct = await createProduct(merchantToken, categoryId, {
    title: '机械键盘-演示02',
    description: '演示验证-已上架商品，用于展示正常销售、下单和售后链路。',
    mainImage: `https://picsum.photos/seed/demo-keyboard-${RUN_ID}/400/400`,
    skus: [
      { specJson: { 颜色: '云雾白', 版本: 'Pro版' }, price: 449, stock: { available: 80 } },
    ],
  });
  await submitProduct(merchantToken, onShelfProduct.spuId);
  await approveProduct(adminToken, onShelfProduct.spuId);

  const offShelfDemoProduct = await createProduct(merchantToken, categoryId, {
    title: '便携充电宝-演示03',
    description: '演示验证-已下架商品，用于展示 OFF_SHELF 重新提交审核入口。',
    mainImage: `https://picsum.photos/seed/demo-powerbank-${RUN_ID}/400/400`,
    skus: [
      { specJson: { 颜色: '天空蓝', 容量: '256GB' }, price: 129, stock: { available: 40 } },
    ],
  });
  await submitProduct(merchantToken, offShelfDemoProduct.spuId);
  await approveProduct(adminToken, offShelfDemoProduct.spuId);
  await takeOffShelfProduct(merchantToken, offShelfDemoProduct.spuId);

  const skuId = onShelfProduct.skus[0].skuId;
  const pendingOrder = await createPaidOrder({
    userToken,
    skuId,
    remark: `演示验证-待发货订单-${RUN_ID}`,
  });

  const shippedOrder = await createPaidOrder({
    userToken,
    skuId,
    remark: `演示验证-已发货订单-${RUN_ID}`,
  });
  await shipOrder({
    merchantToken,
    subOrderId: shippedOrder.subOrderId,
    logisticsCompany: '顺丰速运',
    trackingNo: makeTracking('SF', 1),
  });

  const appliedOrder = await createPaidOrder({
    userToken,
    skuId,
    remark: `演示验证-待处理售后-${RUN_ID}`,
  });
  await shipOrder({
    merchantToken,
    subOrderId: appliedOrder.subOrderId,
    logisticsCompany: '中通快递',
    trackingNo: makeTracking('ZT', 2),
  });
  await createAfterSale({
    userToken,
    orderId: appliedOrder.orderId,
    subOrderId: appliedOrder.subOrderId,
    type: 'REFUND_ONLY',
    reason: '耳机降噪效果与描述不符，申请仅退款',
  });

  const returningOrder = await createPaidOrder({
    userToken,
    skuId,
    remark: `演示验证-退货中售后-${RUN_ID}`,
  });
  await shipOrder({
    merchantToken,
    subOrderId: returningOrder.subOrderId,
    logisticsCompany: '圆通速递',
    trackingNo: makeTracking('YT', 3),
  });
  const returningCase = await createAfterSale({
    userToken,
    orderId: returningOrder.orderId,
    subOrderId: returningOrder.subOrderId,
    type: 'RETURN_REFUND',
    reason: '商品外包装破损，申请退货退款',
  });
  await auditAfterSale({ merchantToken, afterSaleId: returningCase.afterSaleId, approved: true });
  await submitReturn({
    userToken,
    orderId: returningOrder.orderId,
    afterSaleId: returningCase.afterSaleId,
    logisticsCompany: '中通快递',
    trackingNo: makeTracking('ZT', 4),
  });

  const escalatedOrder = await createPaidOrder({
    userToken,
    skuId,
    remark: `演示验证-平台仲裁售后-${RUN_ID}`,
  });
  await shipOrder({
    merchantToken,
    subOrderId: escalatedOrder.subOrderId,
    logisticsCompany: '顺丰速运',
    trackingNo: makeTracking('SF', 5),
  });
  const escalatedCase = await createAfterSale({
    userToken,
    orderId: escalatedOrder.orderId,
    subOrderId: escalatedOrder.subOrderId,
    type: 'REFUND_ONLY',
    reason: '键盘按键失灵，申请退货退款',
  });
  await escalateAfterSale({
    userToken,
    orderId: escalatedOrder.orderId,
    afterSaleId: escalatedCase.afterSaleId,
  });

  const refundedOrder = await createPaidOrder({
    userToken,
    skuId,
    remark: `演示验证-已退款售后-${RUN_ID}`,
  });
  await shipOrder({
    merchantToken,
    subOrderId: refundedOrder.subOrderId,
    logisticsCompany: '圆通速递',
    trackingNo: makeTracking('YT', 6),
  });
  const refundedCase = await createAfterSale({
    userToken,
    orderId: refundedOrder.orderId,
    subOrderId: refundedOrder.subOrderId,
    type: 'REFUND_ONLY',
    reason: '收到商品颜色与下单规格不一致',
  });
  await auditAfterSale({
    merchantToken,
    afterSaleId: refundedCase.afterSaleId,
    approved: true,
    reason: '商家同意仅退款',
  });

  console.log('\nPASS prepared merchant demo data');
  console.log(`Products: ${pendingProduct.title}, ${onShelfProduct.title}, ${offShelfDemoProduct.title}`);
  console.log(`Pending shipment subOrder: ${pendingOrder.subOrderId}`);
  console.log(`Shipped subOrder: ${shippedOrder.subOrderId}`);
  console.log('After-sales: APPLIED, RETURNING, ESCALATED, REFUNDED');
}

main().catch((err) => {
  console.error('\nFAIL prepare merchant demo data');
  console.error(err?.stack || err?.message || String(err));
  process.exit(1);
});
