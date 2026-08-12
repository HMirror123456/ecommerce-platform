import http from 'http';

const BASE = process.env.API_BASE || 'http://localhost:8080/api';
const USER = { phone: '13800138000', password: '123456' };
const MERCHANT_1 = { username: 'merchant1', password: '123456' };
const MERCHANT_2 = { username: 'merchant2', password: '123456' };
const ADDRESS_ID = 1;
const RUN_ID = String(Date.now()).slice(-6);
const PURPOSE_LABELS = {
  'foreign-shipment': '跨商家发货拦截',
  'foreign-owner-order': '归属商家发货',
  'escalated-after-sale': '平台仲裁只读',
  'own-escalated-order': '本店仲裁售后',
  'repeat-after-sale': '重复处理拦截',
  'own-repeat-order': '本店重复处理售后',
};

function request(method, path, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
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

function getPurposeLabel(purpose) {
  return PURPOSE_LABELS[purpose] || purpose;
}

function makeTracking(prefix, suffix = '') {
  return `${prefix}20260811${RUN_ID}${suffix}`;
}

async function loginMerchant(account) {
  const response = await request('POST', '/auth/merchant/login', { body: account });
  assert(response.status === 200 && response.data?.token, `FAIL merchant login ${account.username}: ${JSON.stringify(response)}`);
  return {
    token: response.data.token,
    merchantId: Number(response.data.merchantId),
    username: account.username,
  };
}

async function fetchMerchantProducts(token) {
  const response = await request('GET', '/merchant/products', { token });
  assert(response.status === 200, `FAIL query merchant products: ${JSON.stringify(response)}`);
  return getList(response.data);
}

function findOnShelfSku(products) {
  for (const product of products || []) {
    if (product.status !== 'ON_SHELF') continue;
    for (const sku of product.skus || []) {
      if (sku?.skuId) return { product, sku };
    }
  }
  return null;
}

async function ensureAvailable(token, sku, minAvailable) {
  const available = Number(sku?.stock?.available || 0);
  if (available >= minAvailable) return;
  const response = await request('PATCH', `/merchant/skus/${sku.skuId}/stock`, {
    token,
    body: { available: minAvailable },
  });
  assert(response.status === 200, `FAIL prepare stock ${sku.skuId}: ${JSON.stringify(response)}`);
}

async function createPaidOrder({ userToken, skuId, merchantId, purpose }) {
  const created = await request('POST', '/orders', {
    token: userToken,
    body: {
      addressId: ADDRESS_ID,
      items: [{ skuId, quantity: 1 }],
      remark: `权限验证-${getPurposeLabel(purpose)}-${RUN_ID}`,
    },
  });
  assert(created.status === 201 && created.data?.orderId, `FAIL create ${purpose} order: ${JSON.stringify(created)}`);

  const paid = await request('POST', `/orders/${created.data.orderId}/pay`, { token: userToken });
  assert(
    paid.status === 200 && paid.data?.order?.status === 'PENDING_SHIPMENT',
    `FAIL pay ${purpose} order: ${JSON.stringify(paid)}`,
  );
  const subOrder = (paid.data.order.subOrders || []).find((item) => Number(item.merchantId) === Number(merchantId));
  assert(subOrder?.subOrderId, `FAIL ${purpose} sub-order missing: ${JSON.stringify(paid.data.order)}`);
  return { orderId: created.data.orderId, subOrderId: subOrder.subOrderId };
}

async function shipOrder({ token, subOrderId, purpose }) {
  const response = await request('POST', `/merchant/orders/${subOrderId}/ship`, {
    token,
    body: {
      logisticsCompany: '圆通速递',
      trackingNo: makeTracking('YT', subOrderId),
    },
  });
  assert(response.status === 200 && response.data?.status === 'SHIPPED', `FAIL ship ${purpose}: ${JSON.stringify(response)}`);
}

async function createAfterSale({ userToken, orderId, subOrderId, type, reason }) {
  const response = await request('POST', `/orders/${orderId}/after-sales`, {
    token: userToken,
    body: { subOrderId, type, reason },
  });
  assert(
    response.status === 201 && response.data?.afterSaleId && response.data?.status === 'APPLIED',
    `FAIL create after-sale: ${JSON.stringify(response)}`,
  );
  return response.data;
}

async function main() {
  console.log('VERIFY merchant permission boundaries');

  const userLogin = await request('POST', '/auth/user/login', { body: USER });
  assert(userLogin.status === 200 && userLogin.data?.token, `FAIL user login: ${JSON.stringify(userLogin)}`);
  const userToken = userLogin.data.token;
  console.log('PASS user login');

  const merchant1 = await loginMerchant(MERCHANT_1);
  const merchant2 = await loginMerchant(MERCHANT_2);
  console.log('PASS merchant1 and merchant2 login');

  const merchant1Products = await fetchMerchantProducts(merchant1.token);
  const merchant2Products = await fetchMerchantProducts(merchant2.token);
  const merchant1Target = findOnShelfSku(merchant1Products);
  const merchant2Target = findOnShelfSku(merchant2Products);
  assert(merchant1Target, `FAIL no ON_SHELF SKU for merchant1: ${JSON.stringify(merchant1Products)}`);
  assert(merchant2Target, `FAIL no ON_SHELF SKU for merchant2: ${JSON.stringify(merchant2Products)}`);
  await ensureAvailable(merchant1.token, merchant1Target.sku, 5);
  await ensureAvailable(merchant2.token, merchant2Target.sku, 5);
  console.log('PASS found test SKUs for both merchants');

  const forbiddenStock = await request('PATCH', `/merchant/skus/${merchant2Target.sku.skuId}/stock`, {
    token: merchant1.token,
    body: { available: Number(merchant2Target.sku.stock?.available || 0) + 1 },
  });
  assert(forbiddenStock.status === 403, `FAIL merchant should not update other SKU stock: ${JSON.stringify(forbiddenStock)}`);
  console.log('PASS merchant cannot adjust another merchant SKU stock');

  const otherOrder = await createPaidOrder({
    userToken,
    skuId: merchant2Target.sku.skuId,
    merchantId: merchant2.merchantId,
    purpose: 'foreign-shipment',
  });
  const forbiddenShip = await request('POST', `/merchant/orders/${otherOrder.subOrderId}/ship`, {
    token: merchant1.token,
    body: { logisticsCompany: '中通快递', trackingNo: makeTracking('ZT', otherOrder.subOrderId) },
  });
  assert(forbiddenShip.status === 403, `FAIL merchant should not ship other sub-order: ${JSON.stringify(forbiddenShip)}`);
  console.log('PASS merchant cannot ship another merchant sub-order');

  await shipOrder({
    token: merchant2.token,
    subOrderId: otherOrder.subOrderId,
    purpose: 'foreign-owner-order',
  });
  const foreignAfterSale = await createAfterSale({
    userToken,
    orderId: otherOrder.orderId,
    subOrderId: otherOrder.subOrderId,
    type: 'REFUND_ONLY',
    reason: '收到商品颜色与下单规格不一致',
  });
  const forbiddenAfterSale = await request('POST', `/merchant/after-sales/${foreignAfterSale.afterSaleId}/audit`, {
    token: merchant1.token,
    body: { approved: false, reason: '非本店售后，不能越权处理' },
  });
  assert(
    forbiddenAfterSale.status === 403,
    `FAIL merchant should not process other after-sale: ${JSON.stringify(forbiddenAfterSale)}`,
  );
  console.log('PASS merchant cannot process another merchant after-sale');

  const escalatedOrder = await createPaidOrder({
    userToken,
    skuId: merchant1Target.sku.skuId,
    merchantId: merchant1.merchantId,
    purpose: 'escalated-after-sale',
  });
  await shipOrder({
    token: merchant1.token,
    subOrderId: escalatedOrder.subOrderId,
    purpose: 'own-escalated-order',
  });
  const appliedEscalated = await createAfterSale({
    userToken,
    orderId: escalatedOrder.orderId,
    subOrderId: escalatedOrder.subOrderId,
    type: 'REFUND_ONLY',
    reason: '键盘按键失灵，申请平台介入处理',
  });
  const escalated = await request(
    'POST',
    `/orders/${escalatedOrder.orderId}/after-sales/${appliedEscalated.afterSaleId}/escalate`,
    { token: userToken },
  );
  assert(
    escalated.status === 200 && escalated.data?.afterSale?.status === 'ESCALATED',
    `FAIL escalate after-sale: ${JSON.stringify(escalated)}`,
  );
  const forbiddenEscalated = await request('POST', `/merchant/after-sales/${appliedEscalated.afterSaleId}/audit`, {
    token: merchant1.token,
    body: { approved: true },
  });
  assert(
    forbiddenEscalated.status === 409,
    `FAIL merchant should not process ESCALATED after-sale: ${JSON.stringify(forbiddenEscalated)}`,
  );
  console.log('PASS merchant cannot process ESCALATED after-sale');

  const repeatOrder = await createPaidOrder({
    userToken,
    skuId: merchant1Target.sku.skuId,
    merchantId: merchant1.merchantId,
    purpose: 'repeat-after-sale',
  });
  await shipOrder({
    token: merchant1.token,
    subOrderId: repeatOrder.subOrderId,
    purpose: 'own-repeat-order',
  });
  const repeatCase = await createAfterSale({
    userToken,
    orderId: repeatOrder.orderId,
    subOrderId: repeatOrder.subOrderId,
    type: 'REFUND_ONLY',
    reason: '耳机降噪效果与描述不符，申请仅退款',
  });
  const rejected = await request('POST', `/merchant/after-sales/${repeatCase.afterSaleId}/audit`, {
    token: merchant1.token,
    body: { approved: false, reason: `商家首次拒绝售后-${RUN_ID}` },
  });
  assert(
    rejected.status === 200 && rejected.data?.afterSale?.status === 'REJECTED',
    `FAIL reject APPLIED after-sale before repeat check: ${JSON.stringify(rejected)}`,
  );
  const repeated = await request('POST', `/merchant/after-sales/${repeatCase.afterSaleId}/audit`, {
    token: merchant1.token,
    body: { approved: true },
  });
  assert(
    repeated.status === 409,
    `FAIL merchant should not repeat process non-APPLIED after-sale: ${JSON.stringify(repeated)}`,
  );
  console.log('PASS merchant cannot repeat process non-APPLIED after-sale');

  console.log('\nPASS merchant permission verification');
}

main().catch((err) => {
  console.error('\nFAIL merchant permission verification');
  console.error(err?.stack || err?.message || String(err));
  process.exit(1);
});
