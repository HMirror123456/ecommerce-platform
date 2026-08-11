import http from 'http';

const BASE = 'http://localhost:8080/api';

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
        res.on('data', (c) => (raw += c));
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

const userLogin = await request('POST', '/auth/user/login', {
  body: { phone: '13800138000', password: '123456' },
});
const merchantLogin = await request('POST', '/auth/merchant/login', {
  body: { username: 'merchant1', password: '123456' },
});
if (userLogin.status !== 200 || merchantLogin.status !== 200) {
  throw new Error(`login failed: user=${userLogin.status} merchant=${merchantLogin.status}`);
}
const userToken = userLogin.data.token;
const merchantToken = merchantLogin.data.token;

// seed id=2: RETURN_REFUND + APPROVED, orderId=10002, merchantId=1
const afterSaleId = 2;
const orderId = 10002;

const badState = await request('POST', `/orders/${orderId}/after-sales/${afterSaleId}/return`, {
  token: userToken,
  body: { logisticsCompany: '', trackingNo: '' },
});
if (badState.status !== 400) {
  throw new Error(`empty shipment should 400, got ${badState.status}: ${JSON.stringify(badState.data)}`);
}
console.log('OK empty shipment rejected');

const shipped = await request('POST', `/orders/${orderId}/after-sales/${afterSaleId}/return`, {
  token: userToken,
  body: { logisticsCompany: '顺丰速运', trackingNo: 'SF1234567890' },
});
if (shipped.status !== 200 || shipped.data?.status !== 'RETURNING') {
  throw new Error(`return failed: ${JSON.stringify(shipped)}`);
}
if (!shipped.data.returnShipment?.trackingNo) {
  throw new Error(`returnShipment missing: ${JSON.stringify(shipped.data)}`);
}
console.log('OK APPROVED → RETURNING', shipped.data.afterSaleId);

const again = await request('POST', `/orders/${orderId}/after-sales/${afterSaleId}/return`, {
  token: userToken,
  body: { logisticsCompany: '圆通', trackingNo: 'YT999' },
});
if (again.status !== 409) {
  throw new Error(`duplicate return should 409, got ${again.status}`);
}
console.log('OK duplicate return 409');

const confirmed = await request('POST', `/merchant/after-sales/${afterSaleId}/confirm-return`, {
  token: merchantToken,
});
if (confirmed.status !== 200 || confirmed.data?.afterSale?.status !== 'REFUNDED') {
  throw new Error(`confirm-return failed: ${JSON.stringify(confirmed)}`);
}
console.log('OK RETURNING → REFUNDED', confirmed.data.afterSale.afterSaleId);

const confirmAgain = await request('POST', `/merchant/after-sales/${afterSaleId}/confirm-return`, {
  token: merchantToken,
});
if (confirmAgain.status !== 409) {
  throw new Error(`confirm non-RETURNING should 409, got ${confirmAgain.status}`);
}
console.log('OK confirm non-RETURNING 409');

console.log('\n=== After-sale return verification passed ===');
