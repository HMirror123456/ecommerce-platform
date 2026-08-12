import http from 'http';

const BASE = process.env.API_BASE || 'http://localhost:8080/api';
const USER = { phone: '13800138000', password: '123456' };
const MERCHANT = { username: 'merchant1', password: '123456' };
const ADDRESS_ID = 1;
const RUN_ID = String(Date.now()).slice(-6);
const PURPOSE_LABELS = {
  reject: '拒绝仅退款',
  'return-refund': '退货退款',
  escalate: '平台仲裁边界',
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

function findSku(products, skuId) {
  for (const product of products || []) {
    const sku = (product.skus || []).find((item) => Number(item.skuId) === Number(skuId));
    if (sku) return sku;
  }
  return null;
}

function findTestSku(products) {
  for (const product of products || []) {
    if (product.status !== 'ON_SHELF') continue;
    for (const sku of product.skus || []) {
      if (Number(sku.stock?.available || 0) >= 3) {
        return { product, sku };
      }
    }
  }
  return null;
}

function getPurposeLabel(purpose) {
  return PURPOSE_LABELS[purpose] || purpose;
}

function makeTracking(prefix, suffix = '') {
  return `${prefix}20260811${RUN_ID}${suffix}`;
}

async function fetchMerchantProducts(token) {
  const products = await request('GET', '/merchant/products', { token });
  assert(products.status === 200, `FAIL query merchant products: ${JSON.stringify(products)}`);
  return getList(products.data);
}

async function getSkuAvailable(token, skuId) {
  const products = await fetchMerchantProducts(token);
  const sku = findSku(products, skuId);
  assert(sku, `FAIL SKU ${skuId} missing from merchant product list`);
  const available = Number(sku.stock?.available);
  assert(Number.isInteger(available), `FAIL SKU ${skuId} available is invalid: ${JSON.stringify(sku)}`);
  return available;
}

async function fetchMerchantAfterSales(token, status) {
  const path = status ? `/merchant/after-sales?status=${encodeURIComponent(status)}` : '/merchant/after-sales';
  const response = await request('GET', path, { token });
  assert(response.status === 200, `FAIL query merchant after-sales: ${JSON.stringify(response)}`);
  return getList(response.data);
}

async function createPaidShippedOrder({ userToken, merchantToken, merchantId, skuId, purpose }) {
  const created = await request('POST', '/orders', {
    token: userToken,
    body: {
      addressId: ADDRESS_ID,
      items: [{ skuId, quantity: 1 }],
      remark: `售后验证-${getPurposeLabel(purpose)}-${RUN_ID}`,
    },
  });
  assert(created.status === 201 && created.data?.orderId, `FAIL create ${purpose} order: ${JSON.stringify(created)}`);
  const orderId = created.data.orderId;

  const paid = await request('POST', `/orders/${orderId}/pay`, { token: userToken });
  assert(
    paid.status === 200 && paid.data?.order?.status === 'PENDING_SHIPMENT',
    `FAIL pay ${purpose} order: ${JSON.stringify(paid)}`,
  );

  const subOrder = (paid.data.order.subOrders || []).find((item) => Number(item.merchantId) === Number(merchantId));
  assert(subOrder?.subOrderId, `FAIL ${purpose} order has no merchant sub-order: ${JSON.stringify(paid.data.order)}`);

  const shipped = await request('POST', `/merchant/orders/${subOrder.subOrderId}/ship`, {
    token: merchantToken,
    body: {
      logisticsCompany: '中通快递',
      trackingNo: makeTracking('ZT', subOrder.subOrderId),
    },
  });
  assert(shipped.status === 200 && shipped.data?.status === 'SHIPPED', `FAIL ship ${purpose}: ${JSON.stringify(shipped)}`);

  return { orderId, subOrderId: subOrder.subOrderId };
}

async function createAfterSale({ userToken, orderId, subOrderId, type, reason }) {
  const created = await request('POST', `/orders/${orderId}/after-sales`, {
    token: userToken,
    body: { type, reason, subOrderId },
  });
  assert(
    created.status === 201 && created.data?.status === 'APPLIED',
    `FAIL create after-sale ${type}: ${JSON.stringify(created)}`,
  );
  return created.data;
}

async function main() {
  console.log('VERIFY merchant after-sale flow');

  const userLogin = await request('POST', '/auth/user/login', { body: USER });
  assert(userLogin.status === 200 && userLogin.data?.token, `FAIL user login: ${JSON.stringify(userLogin)}`);
  const userToken = userLogin.data.token;
  console.log('PASS user login');

  const merchantLogin = await request('POST', '/auth/merchant/login', { body: MERCHANT });
  assert(
    merchantLogin.status === 200 && merchantLogin.data?.token,
    `FAIL merchant login: ${JSON.stringify(merchantLogin)}`,
  );
  const merchantToken = merchantLogin.data.token;
  const merchantId = Number(merchantLogin.data.merchantId);
  console.log('PASS merchant login');

  const initialAfterSales = await fetchMerchantAfterSales(merchantToken);
  assert(
    initialAfterSales.every((item) => Number(item.merchantId) === merchantId),
    `FAIL merchant list leaked other merchant after-sales: ${JSON.stringify(initialAfterSales)}`,
  );
  console.log('PASS merchant after-sale list is scoped to current merchant');

  const products = await fetchMerchantProducts(merchantToken);
  const target = findTestSku(products);
  assert(target, 'FAIL no ON_SHELF merchant SKU with available >= 3');
  const skuId = target.sku.skuId;
  console.log(`PASS found test SKU ${skuId}`);

  const rejectOrder = await createPaidShippedOrder({
    userToken,
    merchantToken,
    merchantId,
    skuId,
    purpose: 'reject',
  });
  const rejectCase = await createAfterSale({
    userToken,
    orderId: rejectOrder.orderId,
    subOrderId: rejectOrder.subOrderId,
    type: 'REFUND_ONLY',
    reason: '耳机降噪效果与描述不符，申请仅退款',
  });
  const rejectReason = `商家核实商品已签收且描述一致，拒绝仅退款-${RUN_ID}`;
  const rejected = await request('POST', `/merchant/after-sales/${rejectCase.afterSaleId}/audit`, {
    token: merchantToken,
    body: { approved: false, reason: rejectReason },
  });
  assert(
    rejected.status === 200
      && rejected.data?.afterSale?.status === 'REJECTED'
      && rejected.data?.afterSale?.auditReason === rejectReason,
    `FAIL reject APPLIED after-sale: ${JSON.stringify(rejected)}`,
  );
  const rejectedList = await fetchMerchantAfterSales(merchantToken, 'REJECTED');
  assert(
    rejectedList.some((item) => Number(item.afterSaleId) === Number(rejectCase.afterSaleId) && item.auditReason === rejectReason),
    `FAIL rejected after-sale reason not persisted in list: ${JSON.stringify(rejectedList)}`,
  );
  console.log('PASS APPLIED after-sale can be rejected with reason');

  const availableBeforeReturn = await getSkuAvailable(merchantToken, skuId);
  const returnOrder = await createPaidShippedOrder({
    userToken,
    merchantToken,
    merchantId,
    skuId,
    purpose: 'return-refund',
  });
  const availableAfterPay = await getSkuAvailable(merchantToken, skuId);
  assert(
    availableAfterPay === availableBeforeReturn - 1,
    `FAIL stock was not deducted before return: before=${availableBeforeReturn} afterPay=${availableAfterPay}`,
  );
  const returnCase = await createAfterSale({
    userToken,
    orderId: returnOrder.orderId,
    subOrderId: returnOrder.subOrderId,
    type: 'RETURN_REFUND',
    reason: '商品外包装破损，申请退货退款',
  });
  const approved = await request('POST', `/merchant/after-sales/${returnCase.afterSaleId}/audit`, {
    token: merchantToken,
    body: { approved: true },
  });
  assert(
    approved.status === 200 && approved.data?.afterSale?.status === 'APPROVED',
    `FAIL approve RETURN_REFUND after-sale: ${JSON.stringify(approved)}`,
  );
  console.log('PASS APPLIED RETURN_REFUND can be approved');

  const returning = await request('POST', `/orders/${returnOrder.orderId}/after-sales/${returnCase.afterSaleId}/return`, {
    token: userToken,
    body: {
      logisticsCompany: '圆通速递',
      trackingNo: makeTracking('YT', returnCase.afterSaleId),
    },
  });
  assert(
    returning.status === 200
      && returning.data?.status === 'RETURNING'
      && returning.data?.returnShipment?.trackingNo,
    `FAIL submit return shipment: ${JSON.stringify(returning)}`,
  );

  const confirmed = await request('POST', `/merchant/after-sales/${returnCase.afterSaleId}/confirm-return`, {
    token: merchantToken,
  });
  assert(
    confirmed.status === 200 && confirmed.data?.afterSale?.status === 'REFUNDED',
    `FAIL confirm RETURNING after-sale: ${JSON.stringify(confirmed)}`,
  );
  const availableAfterRefund = await getSkuAvailable(merchantToken, skuId);
  assert(
    availableAfterRefund === availableBeforeReturn,
    `FAIL stock not restored after refund: before=${availableBeforeReturn} afterRefund=${availableAfterRefund}`,
  );
  const refundedOrder = await request('GET', `/orders/${returnOrder.orderId}`, { token: userToken });
  const refundedSubOrder = (refundedOrder.data?.subOrders || []).find(
    (item) => Number(item.subOrderId) === Number(returnOrder.subOrderId),
  );
  assert(
    refundedOrder.status === 200
      && refundedOrder.data?.status === 'REFUNDED'
      && refundedSubOrder?.status === 'REFUNDED',
    `FAIL order/sub-order not refunded: ${JSON.stringify(refundedOrder)}`,
  );
  console.log('PASS RETURNING can be confirmed, refunded, and stock is restored');

  const escalatedList = await fetchMerchantAfterSales(merchantToken, 'ESCALATED');
  let escalatedCase = escalatedList[0];
  if (!escalatedCase) {
    const escalatedOrder = await createPaidShippedOrder({
      userToken,
      merchantToken,
      merchantId,
      skuId,
      purpose: 'escalate',
    });
    const appliedEscalation = await createAfterSale({
      userToken,
      orderId: escalatedOrder.orderId,
      subOrderId: escalatedOrder.subOrderId,
      type: 'REFUND_ONLY',
      reason: '键盘按键失灵，申请退货退款',
    });
    const escalated = await request(
      'POST',
      `/orders/${escalatedOrder.orderId}/after-sales/${appliedEscalation.afterSaleId}/escalate`,
      { token: userToken },
    );
    assert(
      escalated.status === 200 && escalated.data?.afterSale?.status === 'ESCALATED',
      `FAIL escalate after-sale: ${JSON.stringify(escalated)}`,
    );
    escalatedCase = escalated.data.afterSale;
  }

  const auditEscalated = await request('POST', `/merchant/after-sales/${escalatedCase.afterSaleId}/audit`, {
    token: merchantToken,
    body: { approved: true },
  });
  assert(
    auditEscalated.status === 409,
    `FAIL ESCALATED after-sale should reject merchant audit: ${JSON.stringify(auditEscalated)}`,
  );
  console.log('PASS ESCALATED after-sale is read-only for merchant');

  console.log('\nPASS merchant after-sale verification');
}

main().catch((err) => {
  console.error('\nFAIL merchant after-sale verification');
  console.error(err?.stack || err?.message || String(err));
  process.exit(1);
});
