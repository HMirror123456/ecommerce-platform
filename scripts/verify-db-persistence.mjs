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
  shopName: '持久化测试店',
  contactName: '测试',
  contactPhone: phone,
});
if (submit.status !== 201) throw new Error(`submit failed: ${JSON.stringify(submit)}`);

const login = await post('/auth/admin/login', { username: 'operator', password: 'operator123' });
const token = login.data.token;
const appId = submit.data.application.merchantId;

const approved = await post(`/admin/merchants/${appId}/audit`, { approved: true }, token);
if (approved.status !== 200) throw new Error(`approve failed: ${JSON.stringify(approved)}`);

const username = approved.data.merchant.username;
console.log('Created merchant', username, '- restart API manually and re-run with --verify-only');

if (process.argv.includes('--verify-only')) {
  const usernameArg = process.argv[process.argv.indexOf('--verify-only') + 1];
  const un = usernameArg || username;
  const merchantLogin = await post('/auth/merchant/login', { username: un, password: '123456' });
  if (merchantLogin.status !== 200) {
    throw new Error(`after restart login failed for ${un}: ${JSON.stringify(merchantLogin)}`);
  }
  const status = await get(`/merchant/applications/status?contactPhone=${phone}`);
  if (status.data.list[0]?.status !== 'APPROVED') {
    throw new Error('application not persisted');
  }
  console.log('OK: data survived API restart for', un);
} else {
  console.log('Next: restart API, then run:');
  console.log(`  node scripts/verify-db-persistence.mjs --verify-only ${username}`);
}
