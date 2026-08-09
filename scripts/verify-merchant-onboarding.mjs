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

const phone = `139${String(Date.now()).slice(-8)}`;
const submit = await post('/merchant/applications', {
  shopName: '联调测试店',
  contactName: '测试员',
  contactPhone: phone,
});
if (submit.status !== 201) throw new Error(`submit failed: ${JSON.stringify(submit)}`);

const appId = submit.data.application.merchantId;

const status = await get(`/merchant/applications/status?contactPhone=${phone}`);
if (status.status !== 200 || status.data.list[0].status !== 'PENDING') {
  throw new Error(`status failed: ${JSON.stringify(status)}`);
}

const login = await post('/auth/admin/login', { username: 'operator', password: 'operator123' });
const token = login.data.token;

const pending = await get('/admin/merchants/pending', token);
if (!pending.data.some((m) => m.merchantId === appId)) {
  throw new Error('application not in pending list');
}

const approved = await post(`/admin/merchants/${appId}/audit`, { approved: true }, token);
if (approved.status !== 200 || approved.data.status !== 'APPROVED') {
  throw new Error(`approve failed: ${JSON.stringify(approved)}`);
}

const completed = await get('/admin/merchants/applications?status=APPROVED,REJECTED', token);
if (!completed.data.list.some((m) => m.merchantId === appId)) {
  throw new Error('approved application not in completed list');
}

const statusAfter = await get(`/merchant/applications/status?contactPhone=${phone}`);
if (statusAfter.data.list[0].status !== 'APPROVED') {
  throw new Error('merchant status not updated');
}

const merchantLogin = await post('/auth/merchant/login', {
  username: approved.data.merchant.username,
  password: '123456',
});
if (merchantLogin.status !== 200) {
  throw new Error(`merchant login failed: ${JSON.stringify(merchantLogin)}`);
}

console.log('OK: merchant onboarding E2E', phone, approved.data.merchant.username);
