import http from 'http';

const BASE = process.env.API_BASE || 'http://localhost:8080/api';
const USER = { phone: '13800138000', password: '123456' };
const MERCHANT = { username: 'merchant1', password: '123456' };
const TEST_ITEM = { skuId: 1001, quantity: 1 };
const TEST_ADDRESS_ID = 1;
const RUN_ID = String(Date.now()).slice(-6);
const TEST_SHIPMENT = {
  logisticsCompany: '顺丰速运',
  trackingNo: `SF20260811${RUN_ID}`,
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

function findSubOrder(list, orderId, subOrderId) {
  return (list || []).find((item) => (
    Number(item.orderId) === Number(orderId)
    && Number(item.subOrderId) === Number(subOrderId)
  ));
}

async function main() {
  console.log('VERIFY merchant shipping flow');

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
  const merchantId = merchantLogin.data.merchantId;
  console.log('PASS merchant login');

  const created = await request('POST', '/orders', {
    token: userToken,
    body: {
      addressId: TEST_ADDRESS_ID,
      items: [TEST_ITEM],
      remark: `发货验证-待发货订单-${RUN_ID}`,
    },
  });
  assert(created.status === 201 && created.data?.orderId, `FAIL create order: ${JSON.stringify(created)}`);
  const orderId = created.data.orderId;
  console.log(`PASS create order ${orderId}`);

  const paid = await request('POST', `/orders/${orderId}/pay`, { token: userToken });
  assert(
    paid.status === 200 && paid.data?.order?.status === 'PENDING_SHIPMENT',
    `FAIL mock pay: ${JSON.stringify(paid)}`,
  );
  const subOrder = (paid.data.order.subOrders || []).find((item) => Number(item.merchantId) === Number(merchantId));
  assert(subOrder?.subOrderId, `FAIL paid order has no merchant sub-order: ${JSON.stringify(paid.data.order)}`);
  console.log(`PASS mock pay, subOrder ${subOrder.subOrderId} pending shipment`);

  const pendingBefore = await request('GET', '/merchant/orders?status=PENDING_SHIPMENT', { token: merchantToken });
  assert(pendingBefore.status === 200, `FAIL query pending merchant orders: ${JSON.stringify(pendingBefore)}`);
  const pendingSubOrder = findSubOrder(pendingBefore.data?.list, orderId, subOrder.subOrderId);
  assert(
    pendingSubOrder?.status === 'PENDING_SHIPMENT',
    `FAIL pending shipment sub-order missing: ${JSON.stringify(pendingBefore.data)}`,
  );
  console.log('PASS merchant order list shows pending shipment');

  const shipped = await request('POST', `/merchant/orders/${subOrder.subOrderId}/ship`, {
    token: merchantToken,
    body: TEST_SHIPMENT,
  });
  assert(
    shipped.status === 200 && shipped.data?.status === 'SHIPPED',
    `FAIL ship merchant order: ${JSON.stringify(shipped)}`,
  );
  assert(
    shipped.data?.shipment?.trackingNo === TEST_SHIPMENT.trackingNo,
    `FAIL shipment response missing trackingNo: ${JSON.stringify(shipped.data)}`,
  );
  console.log('PASS merchant ship order');

  const shippedAfter = await request('GET', '/merchant/orders?status=SHIPPED', { token: merchantToken });
  assert(shippedAfter.status === 200, `FAIL query shipped merchant orders: ${JSON.stringify(shippedAfter)}`);
  const shippedSubOrder = findSubOrder(shippedAfter.data?.list, orderId, subOrder.subOrderId);
  assert(
    shippedSubOrder?.status === 'SHIPPED',
    `FAIL shipped sub-order missing after ship: ${JSON.stringify(shippedAfter.data)}`,
  );
  assert(
    shippedSubOrder.shipment?.logisticsCompany === TEST_SHIPMENT.logisticsCompany
      && shippedSubOrder.shipment?.trackingNo === TEST_SHIPMENT.trackingNo,
    `FAIL shipment not persisted: ${JSON.stringify(shippedSubOrder)}`,
  );
  console.log('PASS merchant order list shows shipped shipment');

  console.log('\nPASS merchant shipping verification');
}

main().catch((err) => {
  console.error('\nFAIL merchant shipping verification');
  console.error(err?.stack || err?.message || String(err));
  process.exit(1);
});
