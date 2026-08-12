import http from 'http';

const BASE = process.env.API_BASE || 'http://localhost:8080/api';
const MERCHANT_1 = { username: 'merchant1', password: '123456' };
const MERCHANT_2 = { username: 'merchant2', password: '123456' };
const ADMIN = { username: 'operator', password: 'operator123' };
const RUN_ID = String(Date.now()).slice(-6);
const BATCH_KEYWORD = `批量验证-机械键盘-${RUN_ID}`;
const SKU_SPECS = [
  { 颜色: '曜石黑', 版本: '标准版' },
  { 颜色: '云雾白', 版本: 'Pro版' },
  { 颜色: '天空蓝', 容量: '256GB' },
];

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
  return Array.isArray(data?.items) ? data.items : Array.isArray(data?.list) ? data.list : [];
}

function findFirstCategoryId(nodes) {
  for (const node of nodes || []) {
    const childId = findFirstCategoryId(node.children || []);
    if (childId) return childId;
    if (Number.isInteger(Number(node?.id))) return Number(node.id);
  }
  return null;
}

async function loginMerchant(account) {
  const response = await request('POST', '/auth/merchant/login', { body: account });
  assert(response.status === 200 && response.data?.token, `FAIL merchant login ${account.username}: ${JSON.stringify(response)}`);
  return {
    token: response.data.token,
    merchantId: Number(response.data.merchantId),
    username: account.username,
  };
}

async function createProduct(token, categoryId, index) {
  const response = await request('POST', '/merchant/products', {
    token,
    body: {
      categoryId,
      title: `${BATCH_KEYWORD}-${String(index).padStart(2, '0')}`,
      description: '批量验证-用于验证商家商品批量提交审核、批量下架和服务端筛选分页。',
      mainImage: `https://picsum.photos/seed/batch-keyboard-${RUN_ID}-${index}/400/400`,
      skus: [
        {
          specJson: SKU_SPECS[index - 1] || { 版本: `演示版${index}` },
          price: 88 + index,
          stock: { available: 5 },
        },
      ],
    },
  });
  assert(response.status === 201 && response.data?.spuId, `FAIL create product ${index}: ${JSON.stringify(response)}`);
  assert(response.data.status === 'DRAFT', `FAIL created product should be DRAFT: ${JSON.stringify(response.data)}`);
  return response.data;
}

async function fetchProduct(token, spuId) {
  const response = await request('GET', `/merchant/products/${spuId}`, { token });
  assert(response.status === 200, `FAIL fetch product ${spuId}: ${JSON.stringify(response)}`);
  return response.data;
}

async function assertStatus(token, spuId, expectedStatus, label) {
  const product = await fetchProduct(token, spuId);
  assert(product.status === expectedStatus, `FAIL ${label}: expected ${expectedStatus}, got ${JSON.stringify(product)}`);
  return product;
}

async function adminApprove(token, spuId) {
  const response = await request('POST', `/admin/products/${spuId}/audit`, {
    token,
    body: { approved: true },
  });
  assert(response.status === 200 && response.data?.status === 'ON_SHELF', `FAIL admin approve ${spuId}: ${JSON.stringify(response)}`);
}

function assertBatchHas(result, spuId, success, label) {
  const item = (result.results || []).find((row) => Number(row.spuId) === Number(spuId));
  assert(item, `FAIL ${label} missing result for ${spuId}: ${JSON.stringify(result)}`);
  assert(Boolean(item.success) === success, `FAIL ${label} success mismatch for ${spuId}: ${JSON.stringify(item)}`);
  return item;
}

async function main() {
  console.log('VERIFY merchant product batch flow');

  const merchant1 = await loginMerchant(MERCHANT_1);
  const merchant2 = await loginMerchant(MERCHANT_2);
  console.log('PASS merchant1 and merchant2 login');

  const adminLogin = await request('POST', '/auth/admin/login', { body: ADMIN });
  assert(adminLogin.status === 200 && adminLogin.data?.token, `FAIL admin login: ${JSON.stringify(adminLogin)}`);
  const adminToken = adminLogin.data.token;
  console.log('PASS admin login for script-only audit');

  const categories = await request('GET', '/categories');
  assert(categories.status === 200, `FAIL query categories: ${JSON.stringify(categories)}`);
  const categoryId = findFirstCategoryId(getList({ items: categories.data }));
  assert(categoryId, `FAIL category missing: ${JSON.stringify(categories.data)}`);
  console.log(`PASS category selected ${categoryId}`);

  const created = [];
  for (let i = 1; i <= 3; i += 1) {
    created.push(await createProduct(merchant1.token, categoryId, i));
  }
  console.log(`PASS created ${created.length} DRAFT products`);

  const paged = await request(
    'GET',
    `/merchant/products?page=1&pageSize=2&keyword=${encodeURIComponent(BATCH_KEYWORD)}`,
    { token: merchant1.token },
  );
  assert(
    paged.status === 200
      && paged.data?.page === 1
      && paged.data?.pageSize === 2
      && Number(paged.data?.total) >= 3
      && Array.isArray(paged.data?.items)
      && paged.data.items.length <= 2,
    `FAIL paged product list: ${JSON.stringify(paged)}`,
  );
  console.log('PASS merchant product list returns page/pageSize/total/items');

  const filtered = await request(
    'GET',
    `/merchant/products?page=1&pageSize=10&keyword=${encodeURIComponent(BATCH_KEYWORD)}&status=DRAFT&categoryId=${categoryId}`,
    { token: merchant1.token },
  );
  const filteredItems = getList(filtered.data);
  assert(
    filtered.status === 200
      && Number(filtered.data?.total) >= 3
      && filteredItems.every((item) => item.status === 'DRAFT' && Number(item.categoryId) === Number(categoryId)),
    `FAIL filtered product list: ${JSON.stringify(filtered)}`,
  );
  console.log('PASS merchant product list supports server filters');

  const submitOk = await request('POST', '/merchant/products/batch-submit-audit', {
    token: merchant1.token,
    body: { spuIds: [created[0].spuId, created[1].spuId] },
  });
  assert(
    submitOk.status === 200 && submitOk.data?.successCount === 2 && submitOk.data?.failureCount === 0,
    `FAIL batch submit audit success: ${JSON.stringify(submitOk)}`,
  );
  await assertStatus(merchant1.token, created[0].spuId, 'PENDING_AUDIT', 'first batch submitted product');
  await assertStatus(merchant1.token, created[1].spuId, 'PENDING_AUDIT', 'second batch submitted product');
  console.log('PASS batch submit audit moves valid products to PENDING_AUDIT');

  const submitMixed = await request('POST', '/merchant/products/batch-submit-audit', {
    token: merchant1.token,
    body: { spuIds: [created[0].spuId, created[2].spuId] },
  });
  assert(
    submitMixed.status === 200 && submitMixed.data?.successCount === 1 && submitMixed.data?.failureCount === 1,
    `FAIL batch submit audit mixed result: ${JSON.stringify(submitMixed)}`,
  );
  assertBatchHas(submitMixed.data, created[0].spuId, false, 'PENDING_AUDIT product should fail submit');
  assertBatchHas(submitMixed.data, created[2].spuId, true, 'DRAFT product should submit');
  await assertStatus(merchant1.token, created[2].spuId, 'PENDING_AUDIT', 'third product submitted');
  console.log('PASS batch submit audit returns failure reason for invalid status');

  await adminApprove(adminToken, created[1].spuId);
  await assertStatus(merchant1.token, created[1].spuId, 'ON_SHELF', 'admin approved product');
  console.log('PASS admin approved one product to ON_SHELF');

  const offShelfMixed = await request('POST', '/merchant/products/batch-off-shelf', {
    token: merchant1.token,
    body: { spuIds: [created[1].spuId, created[0].spuId] },
  });
  assert(
    offShelfMixed.status === 200 && offShelfMixed.data?.successCount === 1 && offShelfMixed.data?.failureCount === 1,
    `FAIL batch off-shelf mixed result: ${JSON.stringify(offShelfMixed)}`,
  );
  assertBatchHas(offShelfMixed.data, created[1].spuId, true, 'ON_SHELF product should off-shelf');
  assertBatchHas(offShelfMixed.data, created[0].spuId, false, 'PENDING_AUDIT product should fail off-shelf');
  await assertStatus(merchant1.token, created[1].spuId, 'OFF_SHELF', 'approved product off-shelf');
  console.log('PASS batch off-shelf handles success and invalid status failure');

  const merchant2Products = await request('GET', '/merchant/products?page=1&pageSize=10&status=ON_SHELF', {
    token: merchant2.token,
  });
  const foreignProduct = getList(merchant2Products.data)[0];
  assert(foreignProduct?.spuId, `FAIL no merchant2 ON_SHELF product: ${JSON.stringify(merchant2Products)}`);

  const forbiddenSubmit = await request('POST', '/merchant/products/batch-submit-audit', {
    token: merchant1.token,
    body: { spuIds: [foreignProduct.spuId] },
  });
  assert(
    forbiddenSubmit.status === 200
      && forbiddenSubmit.data?.successCount === 0
      && forbiddenSubmit.data?.failureCount === 1
      && /permission/i.test(forbiddenSubmit.data?.failures?.[0]?.reason || ''),
    `FAIL batch submit should reject foreign product: ${JSON.stringify(forbiddenSubmit)}`,
  );

  const forbiddenOffShelf = await request('POST', '/merchant/products/batch-off-shelf', {
    token: merchant1.token,
    body: { spuIds: [foreignProduct.spuId] },
  });
  assert(
    forbiddenOffShelf.status === 200
      && forbiddenOffShelf.data?.successCount === 0
      && forbiddenOffShelf.data?.failureCount === 1
      && /permission/i.test(forbiddenOffShelf.data?.failures?.[0]?.reason || ''),
    `FAIL batch off-shelf should reject foreign product: ${JSON.stringify(forbiddenOffShelf)}`,
  );
  console.log('PASS batch operations reject products from another merchant');

  console.log('\nPASS merchant product batch verification');
}

main().catch((err) => {
  console.error('\nFAIL merchant product batch verification');
  console.error(err?.stack || err?.message || String(err));
  process.exit(1);
});
