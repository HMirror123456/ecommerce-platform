import http from 'http';

const BASE = process.env.API_BASE || 'http://localhost:8080/api';
const MERCHANT = { username: 'merchant1', password: '123456' };
const ADMIN = { username: 'operator', password: 'operator123' };
const RUN_ID = String(Date.now()).slice(-6);

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

function findFirstCategoryId(nodes) {
  for (const node of nodes || []) {
    if (node?.enabled === false) continue;
    const childId = findFirstCategoryId(node.children || []);
    if (childId) return childId;
    if (Number.isInteger(Number(node?.id))) return Number(node.id);
  }
  return null;
}

async function fetchMerchantProduct(token, spuId) {
  const response = await request('GET', `/merchant/products/${spuId}`, { token });
  assert(response.status === 200, `FAIL query merchant product ${spuId}: ${JSON.stringify(response)}`);
  return response.data;
}

async function assertProductStatus(token, spuId, expectedStatus, label) {
  const product = await fetchMerchantProduct(token, spuId);
  assert(
    product?.status === expectedStatus,
    `FAIL ${label} expected ${expectedStatus}: ${JSON.stringify(product)}`,
  );
  return product;
}

async function submitAudit(token, spuId, expectedStatus, label) {
  const response = await request('POST', `/merchant/products/${spuId}/submit-audit`, { token });
  assert(
    response.status === 200 && response.data?.status === expectedStatus,
    `FAIL ${label}: ${JSON.stringify(response)}`,
  );
  console.log(`PASS ${label}`);
  return response.data;
}

async function adminAudit(token, spuId, approved, expectedStatus, label) {
  const response = await request('POST', `/admin/products/${spuId}/audit`, {
    token,
    body: { approved, reason: approved ? undefined : '生命周期验证-主图与商品描述不匹配' },
  });
  assert(
    response.status === 200 && response.data?.status === expectedStatus,
    `FAIL ${label}: ${JSON.stringify(response)}`,
  );
  console.log(`PASS ${label}`);
  return response.data;
}

async function main() {
  console.log('VERIFY merchant product lifecycle flow');

  const merchantLogin = await request('POST', '/auth/merchant/login', { body: MERCHANT });
  assert(
    merchantLogin.status === 200 && merchantLogin.data?.token,
    `FAIL merchant login: ${JSON.stringify(merchantLogin)}`,
  );
  const merchantToken = merchantLogin.data.token;
  console.log('PASS merchant login');

  const adminLogin = await request('POST', '/auth/admin/login', { body: ADMIN });
  assert(adminLogin.status === 200 && adminLogin.data?.token, `FAIL admin login: ${JSON.stringify(adminLogin)}`);
  const adminToken = adminLogin.data.token;
  console.log('PASS admin login for script-only product audit');

  const categories = await request('GET', '/categories');
  assert(categories.status === 200, `FAIL query categories: ${JSON.stringify(categories)}`);
  const categoryId = findFirstCategoryId(getList(categories.data));
  assert(categoryId, `FAIL no available category: ${JSON.stringify(categories.data)}`);
  console.log(`PASS category selected ${categoryId}`);

  const createPayload = {
    categoryId,
    title: `生命周期验证-蓝牙耳机-${RUN_ID}`,
    description: '生命周期验证-用于验证商品从草稿、提交审核、上架、下架到重新提交审核的完整流程。',
    mainImage: `https://picsum.photos/seed/lifecycle-earphone-${RUN_ID}/400/400`,
    skus: [
      {
        specJson: { 颜色: '曜石黑', 版本: '标准版' },
        price: 99.9,
        stock: { available: 7 },
      },
    ],
  };
  const created = await request('POST', '/merchant/products', {
    token: merchantToken,
    body: createPayload,
  });
  assert(
    created.status === 201
      && created.data?.spuId
      && created.data?.status === 'DRAFT'
      && Number(created.data?.skus?.[0]?.stock?.available) === 7,
    `FAIL create merchant product: ${JSON.stringify(created)}`,
  );
  const spuId = created.data.spuId;
  console.log(`PASS create product ${spuId} as DRAFT`);

  await submitAudit(merchantToken, spuId, 'PENDING_AUDIT', 'submit DRAFT product audit');
  await assertProductStatus(merchantToken, spuId, 'PENDING_AUDIT', 'product after first submit');
  console.log('PASS product status is PENDING_AUDIT');

  await adminAudit(adminToken, spuId, true, 'ON_SHELF', 'admin approve product');
  await assertProductStatus(merchantToken, spuId, 'ON_SHELF', 'product after first approve');
  console.log('PASS product status is ON_SHELF');

  const offShelf = await request('POST', `/merchant/products/${spuId}/off-shelf`, { token: merchantToken });
  assert(
    offShelf.status === 200 && offShelf.data?.status === 'OFF_SHELF',
    `FAIL off shelf merchant product: ${JSON.stringify(offShelf)}`,
  );
  await assertProductStatus(merchantToken, spuId, 'OFF_SHELF', 'product after off shelf');
  console.log('PASS merchant off-shelf product');

  await submitAudit(merchantToken, spuId, 'PENDING_AUDIT', 'resubmit OFF_SHELF product audit');
  await assertProductStatus(merchantToken, spuId, 'PENDING_AUDIT', 'product after resubmit');
  console.log('PASS off-shelf product returns to PENDING_AUDIT');

  await adminAudit(adminToken, spuId, true, 'ON_SHELF', 'admin approve resubmitted product');
  await assertProductStatus(merchantToken, spuId, 'ON_SHELF', 'product after second approve');
  console.log('PASS resubmitted product is ON_SHELF');

  console.log('\nPASS merchant product flow verification');
}

main().catch((err) => {
  console.error('\nFAIL merchant product flow verification');
  console.error(err?.stack || err?.message || String(err));
  process.exit(1);
});
