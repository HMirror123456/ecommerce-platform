import http from 'http';

function post(path, body, token) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      {
        hostname: 'localhost',
        port: 8080,
        path: '/api' + path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => resolve({ status: res.statusCode, data: raw ? JSON.parse(raw) : null }));
      },
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path, token) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost',
        port: 8080,
        path: '/api' + path,
        method: 'GET',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => resolve({ status: res.statusCode, data: raw ? JSON.parse(raw) : null }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

const login = await post('/auth/admin/login', { username: 'operator', password: 'operator123' });
const token = login.data.token;

const pending = await get('/admin/products/pending?page=1&pageSize=10', token);
if (pending.status !== 200 || pending.data.total < 1) {
  throw new Error(`no pending products: ${JSON.stringify(pending)}`);
}

const spuId = pending.data.list[0].spuId;
const rejected = await post(`/admin/products/${spuId}/audit`, { approved: false, reason: '联调测试驳回' }, token);
if (rejected.status !== 200) throw new Error(`audit failed: ${JSON.stringify(rejected)}`);

const audits = await get('/admin/products/audits?page=1&pageSize=10', token);
if (audits.status !== 200 || !audits.data.list.some((a) => a.spuId === spuId && a.approved === false)) {
  throw new Error(`audit history missing: ${JSON.stringify(audits)}`);
}

const summary = await get('/admin/dashboard/summary', token);
if (summary.status !== 200) throw new Error(`summary failed: ${JSON.stringify(summary)}`);
if (typeof summary.data.auditedProductCount !== 'number') throw new Error('missing auditedProductCount');
if (!Array.isArray(summary.data.recentPendingProducts)) throw new Error('missing recentPendingProducts');

console.log('OK: product audit history + extended dashboard summary');
