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

const pendingBefore = await get('/admin/merchants/pending', token);
if (!Array.isArray(pendingBefore.data) || pendingBefore.data.length < 1) {
  throw new Error('no pending merchants');
}

const appId = pendingBefore.data[0].merchantId;
const approved = await post(`/admin/merchants/${appId}/audit`, { approved: true }, token);
if (approved.status !== 200 || approved.data.status !== 'APPROVED') {
  throw new Error(`approve failed: ${JSON.stringify(approved)}`);
}

const pendingAfter = await get('/admin/merchants/pending', token);
if (pendingAfter.data.some((m) => m.merchantId === appId)) {
  throw new Error('approved application still in pending list');
}

const merchantLogin = await post('/auth/merchant/login', {
  username: approved.data.merchant.username,
  password: '123456',
});
if (merchantLogin.status !== 200) {
  throw new Error(`new merchant login failed: ${JSON.stringify(merchantLogin)}`);
}

console.log('OK: merchant onboarding approve + new merchant login', approved.data.merchant.username);
