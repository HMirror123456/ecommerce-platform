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

const mLogin = await request('POST', '/auth/merchant/login', {
  body: { username: 'merchant1', password: '123456' },
});
const aLogin = await request('POST', '/auth/admin/login', {
  body: { username: 'operator', password: 'operator123' },
});
const mt = mLogin.data.token;
const at = aLogin.data.token;

const create = await request('POST', '/merchant/products', {
  token: mt,
  body: {
    categoryId: 1,
    title: '驳回原因测试',
    description: 'test',
    mainImage: 'https://picsum.photos/seed/reject/200/200',
    skus: [{ specJson: { size: 'L' }, price: 88, stock: { available: 5 } }],
  },
});
const spuId = create.data.spuId;
await request('POST', `/merchant/products/${spuId}/submit-audit`, { token: mt });
await request('POST', `/admin/products/${spuId}/audit`, {
  token: at,
  body: { approved: false, reason: '主图不符合规范' },
});

const list = await request('GET', '/merchant/products', { token: mt });
const item = list.data.list.find((p) => p.spuId === spuId);
if (!item || item.status !== 'REJECTED' || item.rejectReason !== '主图不符合规范') {
  throw new Error(`rejectReason missing: ${JSON.stringify(item)}`);
}

const resubmit = await request('POST', `/merchant/products/${spuId}/submit-audit`, { token: mt });
if (resubmit.data.status !== 'PENDING_AUDIT') throw new Error('resubmit failed');

const list2 = await request('GET', '/merchant/products', { token: mt });
const item2 = list2.data.list.find((p) => p.spuId === spuId);
if (item2.rejectReason) throw new Error('rejectReason should be cleared after resubmit');

console.log('OK: rejectReason visible on REJECTED, resubmit works, reason cleared');
