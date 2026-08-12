import http from 'http';

const BASE = process.env.API_BASE || 'http://localhost:8080/api';
const ADMIN = { username: 'operator', password: 'operator123' };
const PHONE_SEED = Date.now() % 100000000;

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

function makePhone(offset = 0) {
  const seed = (PHONE_SEED + offset) % 100000000;
  return `139${String(seed).padStart(8, '0')}`;
}

function getList(data) {
  return Array.isArray(data) ? data : Array.isArray(data?.list) ? data.list : [];
}

async function submitApplication({ shopName, contactName, contactPhone }) {
  const response = await request('POST', '/merchant/applications', {
    body: { shopName, contactName, contactPhone },
  });
  assert(
    response.status === 201 && response.data?.application?.merchantId,
    `FAIL submit merchant application: ${JSON.stringify(response)}`,
  );
  return response.data.application;
}

async function queryApplication(contactPhone, expectedStatus) {
  const response = await request(
    'GET',
    `/merchant/applications/status?contactPhone=${encodeURIComponent(contactPhone)}`,
  );
  assert(response.status === 200, `FAIL query application status: ${JSON.stringify(response)}`);
  const list = getList(response.data);
  const item = list.find((application) => application.contactPhone === contactPhone);
  assert(item, `FAIL application missing from status list: ${JSON.stringify(response.data)}`);
  if (expectedStatus) {
    assert(
      item.status === expectedStatus,
      `FAIL application status should be ${expectedStatus}: ${JSON.stringify(item)}`,
    );
  }
  return item;
}

async function main() {
  console.log('VERIFY merchant onboarding flow');

  const approvedPhone = makePhone(0);
  const approvedShopName = `蓝榆数码专营店-${approvedPhone.slice(-4)}`;
  const pendingApplication = await submitApplication({
    shopName: approvedShopName,
    contactName: '演示验证-入驻联系人A',
    contactPhone: approvedPhone,
  });
  const pendingApplicationId = Number(pendingApplication.merchantId);
  console.log(`PASS submit application ${pendingApplicationId}`);

  await queryApplication(approvedPhone, 'PENDING');
  console.log('PASS application status shows PENDING');

  const adminLogin = await request('POST', '/auth/admin/login', { body: ADMIN });
  assert(adminLogin.status === 200 && adminLogin.data?.token, `FAIL admin login: ${JSON.stringify(adminLogin)}`);
  const adminToken = adminLogin.data.token;
  console.log('PASS admin login for script-only audit');

  const pending = await request('GET', '/admin/merchants/pending', { token: adminToken });
  assert(pending.status === 200, `FAIL query pending applications: ${JSON.stringify(pending)}`);
  assert(
    getList(pending.data).some((application) => Number(application.merchantId) === pendingApplicationId),
    `FAIL application not in pending list: ${JSON.stringify(pending.data)}`,
  );
  console.log('PASS pending application visible to admin audit list');

  const approved = await request('POST', `/admin/merchants/${pendingApplicationId}/audit`, {
    token: adminToken,
    body: { approved: true },
  });
  assert(
    approved.status === 200
      && approved.data?.status === 'APPROVED'
      && approved.data?.merchant?.username
      && approved.data?.merchant?.shopName === approvedShopName,
    `FAIL approve application: ${JSON.stringify(approved)}`,
  );
  console.log('PASS script-only admin approval creates merchant account');

  const approvedStatus = await queryApplication(approvedPhone, 'APPROVED');
  assert(
    approvedStatus.merchantUsername === approved.data.merchant.username,
    `FAIL approved status missing merchant username: ${JSON.stringify(approvedStatus)}`,
  );
  console.log('PASS onboarding status shows APPROVED and merchant username');

  const merchantLogin = await request('POST', '/auth/merchant/login', {
    body: {
      username: approved.data.merchant.username,
      password: '123456',
    },
  });
  assert(
    merchantLogin.status === 200
      && merchantLogin.data?.token
      && Number(merchantLogin.data?.merchantId) === Number(approved.data.merchant.merchantId)
      && merchantLogin.data?.shopName === approvedShopName,
    `FAIL merchant login: ${JSON.stringify(merchantLogin)}`,
  );
  console.log('PASS approved merchant can login and receives shop info');

  const dashboard = await request('GET', '/merchant/dashboard/summary', { token: merchantLogin.data.token });
  assert(
    dashboard.status === 200
      && Number(dashboard.data?.merchantId) === Number(approved.data.merchant.merchantId)
      && Number(dashboard.data?.shopId) === Number(approved.data.merchant.shopId)
      && dashboard.data?.shopName === approvedShopName,
    `FAIL dashboard shop info: ${JSON.stringify(dashboard)}`,
  );
  console.log('PASS merchant dashboard returns shop profile information');

  const rejectedPhone = makePhone(1000);
  const rejectedApplication = await submitApplication({
    shopName: `校园数码小铺-${rejectedPhone.slice(-4)}`,
    contactName: '演示验证-入驻联系人B',
    contactPhone: rejectedPhone,
  });
  const rejectedApplicationId = Number(rejectedApplication.merchantId);
  const rejectReason = `资质材料不完整，请补充营业执照-${String(Date.now()).slice(-6)}`;
  const rejected = await request('POST', `/admin/merchants/${rejectedApplicationId}/audit`, {
    token: adminToken,
    body: { approved: false, reason: rejectReason },
  });
  assert(
    rejected.status === 200 && rejected.data?.status === 'REJECTED',
    `FAIL reject application: ${JSON.stringify(rejected)}`,
  );
  const rejectedStatus = await queryApplication(rejectedPhone, 'REJECTED');
  assert(
    rejectedStatus.rejectReason === rejectReason,
    `FAIL rejected status missing reason: ${JSON.stringify(rejectedStatus)}`,
  );
  console.log('PASS onboarding status shows REJECTED and reject reason');

  console.log('\nPASS merchant onboarding verification');
}

main().catch((err) => {
  console.error('\nFAIL merchant onboarding verification');
  console.error(err?.stack || err?.message || String(err));
  process.exit(1);
});
