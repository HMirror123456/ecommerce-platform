/**
 * E2E smoke: merchant create → submit audit → admin approve/reject → C端可见
 * Run: node scripts/e2e-audit-flow.mjs  (API on :8080)
 */
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

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function loginMerchant() {
  const r = await request('POST', '/auth/merchant/login', {
    body: { username: 'merchant1', password: '123456' },
  });
  assert(r.status === 200 && r.data?.token, `merchant login failed: ${JSON.stringify(r)}`);
  return r.data.token;
}

async function loginAdmin() {
  const r = await request('POST', '/auth/admin/login', {
    body: { username: 'operator', password: 'operator123' },
  });
  assert(r.status === 200 && r.data?.token, `admin login failed: ${JSON.stringify(r)}`);
  return r.data.token;
}

async function main() {
  const merchantToken = await loginMerchant();
  const adminToken = await loginAdmin();

  // 1. Create product (DRAFT)
  const create = await request('POST', '/merchant/products', {
    token: merchantToken,
    body: {
      categoryId: 1,
      title: 'E2E 测试商品',
      description: '联调脚本创建',
      mainImage: 'https://picsum.photos/seed/e2e/200/200',
      skus: [{ specJson: { size: 'M' }, price: 99, stock: { available: 10 } }],
    },
  });
  assert(create.status === 201, `create product failed: ${JSON.stringify(create)}`);
  const spuId = create.data.spuId;
  console.log('✓ 商家创建商品', spuId);

  // 2. Submit audit
  const submit = await request('POST', `/merchant/products/${spuId}/submit-audit`, {
    token: merchantToken,
  });
  assert(submit.status === 200 && submit.data?.status === 'PENDING_AUDIT', `submit failed: ${JSON.stringify(submit)}`);
  console.log('✓ 提交审核 PENDING_AUDIT');

  // 3. Admin pending list contains it
  const pending = await request('GET', '/admin/products/pending?page=1&pageSize=50', { token: adminToken });
  assert(pending.data?.list?.some((p) => p.spuId === spuId), 'not in pending list');
  console.log('✓ Admin 待审列表可见');

  // 4. Reject first (test reject flow)
  const reject = await request('POST', `/admin/products/${spuId}/audit`, {
    token: adminToken,
    body: { approved: false, reason: '图片不清晰' },
  });
  assert(reject.status === 200 && reject.data?.status === 'REJECTED', `reject failed: ${JSON.stringify(reject)}`);
  console.log('✓ Admin 驳回 REJECTED');

  // 5. REJECTED resubmit
  const resubmit = await request('POST', `/merchant/products/${spuId}/submit-audit`, {
    token: merchantToken,
  });
  assert(resubmit.status === 200 && resubmit.data?.status === 'PENDING_AUDIT', `resubmit failed: ${JSON.stringify(resubmit)}`);
  console.log('✓ REJECTED 重提审核');

  // 6. Approve
  const approve = await request('POST', `/admin/products/${spuId}/audit`, {
    token: adminToken,
    body: { approved: true },
  });
  assert(approve.status === 200 && approve.data?.status === 'ON_SHELF', `approve failed: ${JSON.stringify(approve)}`);
  console.log('✓ Admin 通过 ON_SHELF');

  // 7. C端 products API
  const list = await request('GET', '/products?page=1&pageSize=50');
  assert(list.data?.list?.some((p) => p.spuId === spuId), 'not in public product list');
  const detail = await request('GET', `/products/${spuId}`);
  assert(detail.status === 200 && detail.data?.title === 'E2E 测试商品', `detail failed: ${JSON.stringify(detail)}`);
  console.log('✓ C端 GET /products 可见');

  // 8. Admin orders (create order if none)
  const userLogin = await request('POST', '/auth/user/login', {
    body: { phone: '13800138000', password: '123456' },
  });
  const userToken = userLogin.data?.token;
  const orderCreate = await request('POST', '/orders', {
    token: userToken,
    body: { addressId: 1, items: [{ skuId: 1001, quantity: 1 }] },
  });
  assert(orderCreate.status === 201, `order create: ${JSON.stringify(orderCreate)}`);
  const orderId = orderCreate.data?.orderId;
  console.log('✓ 用户下单', orderId);

  const adminOrders = await request('GET', '/admin/orders?page=1&pageSize=10', { token: adminToken });
  assert(adminOrders.status === 200 && adminOrders.data?.list?.length > 0, 'admin orders empty');
  const adminDetail = await request('GET', `/admin/orders/${orderId}`, { token: adminToken });
  assert(adminDetail.status === 200 && adminDetail.data?.orderId === orderId, 'admin order detail failed');
  console.log('✓ Admin 订单查询 OK');

  console.log('\n=== E2E 全部通过 ===');
}

main().catch((e) => {
  console.error('E2E FAILED:', e.message);
  process.exit(1);
});
