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

const opLogin = await request('POST', '/auth/admin/login', {
  body: { username: 'operator', password: 'operator123' },
});
const csLogin = await request('POST', '/auth/admin/login', {
  body: { username: 'csagent', password: 'cs123' },
});
const opToken = opLogin.data.token;
const csToken = csLogin.data.token;

const summaryOp = await request('GET', '/admin/dashboard/summary', { token: opToken });
if (summaryOp.status !== 200) throw new Error(`operator summary failed: ${JSON.stringify(summaryOp)}`);
if (summaryOp.data.pendingProductCount < 1) throw new Error('pendingProductCount should be >= 1');
if (summaryOp.data.pendingMerchantCount < 1) throw new Error('pendingMerchantCount should be >= 1');
console.log('OK operator summary', summaryOp.data);

const summaryCs = await request('GET', '/admin/dashboard/summary', { token: csToken });
if (summaryCs.data.escalatedAfterSaleCount < 1) throw new Error('escalatedAfterSaleCount should be >= 1');
console.log('OK csagent summary', summaryCs.data);

const afterSales = await request('GET', '/admin/after-sales?page=1&pageSize=10', { token: csToken });
if (afterSales.status !== 200 || afterSales.data.total < 1) {
  throw new Error(`after-sales list failed: ${JSON.stringify(afterSales)}`);
}
console.log('OK after-sales list total', afterSales.data.total);

const merchants = await request('GET', '/admin/merchants/pending', { token: opToken });
if (!Array.isArray(merchants.data) || merchants.data.length < 1) {
  throw new Error(`merchants pending failed: ${JSON.stringify(merchants)}`);
}
console.log('OK merchants pending count', merchants.data.length);

console.log('\n=== Dashboard verification passed ===');
