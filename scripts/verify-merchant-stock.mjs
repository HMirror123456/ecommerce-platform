import http from 'http';

const BASE = process.env.API_BASE || 'http://localhost:8080/api';
const MERCHANT = { username: 'merchant1', password: '123456' };

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

function findFirstSku(products) {
  for (const product of products || []) {
    const sku = (product.skus || [])[0];
    if (sku?.skuId) return { product, sku };
  }
  return null;
}

function findSku(products, skuId) {
  for (const product of products || []) {
    const sku = (product.skus || []).find((item) => Number(item.skuId) === Number(skuId));
    if (sku) return sku;
  }
  return null;
}

async function fetchProducts(token) {
  const products = await request('GET', '/merchant/products', { token });
  assert(products.status === 200, `FAIL query merchant products: ${JSON.stringify(products)}`);
  return products.data?.list || [];
}

async function setStock(token, skuId, available) {
  return request('PATCH', `/merchant/skus/${skuId}/stock`, {
    token,
    body: { available },
  });
}

async function main() {
  console.log('VERIFY merchant stock flow');

  const login = await request('POST', '/auth/merchant/login', { body: MERCHANT });
  assert(login.status === 200 && login.data?.token, `FAIL merchant login: ${JSON.stringify(login)}`);
  const token = login.data.token;
  console.log('PASS merchant login');

  const products = await fetchProducts(token);
  const target = findFirstSku(products);
  assert(target, `FAIL no merchant SKU found: ${JSON.stringify(products)}`);

  const skuId = target.sku.skuId;
  const originalAvailable = Number(target.sku.stock?.available || 0);
  const nextAvailable = originalAvailable + 1;
  console.log(`PASS found SKU ${skuId}, available ${originalAvailable}`);

  const updated = await setStock(token, skuId, nextAvailable);
  assert(
    updated.status === 200
      && Number(updated.data?.skuId) === Number(skuId)
      && Number(updated.data?.stock?.available) === nextAvailable,
    `FAIL update stock: ${JSON.stringify(updated)}`,
  );
  assert(
    Number(updated.data?.stock?.locked) === Number(target.sku.stock?.locked || 0),
    `FAIL locked stock changed: ${JSON.stringify(updated.data)}`,
  );
  console.log(`PASS set available to ${nextAvailable}`);

  const productsAfter = await fetchProducts(token);
  const skuAfter = findSku(productsAfter, skuId);
  assert(
    Number(skuAfter?.stock?.available) === nextAvailable,
    `FAIL stock not persisted in product list: ${JSON.stringify(skuAfter)}`,
  );
  console.log('PASS merchant product list reflects updated stock');

  const invalid = await setStock(token, skuId, -1);
  assert(invalid.status === 400, `FAIL negative stock should be rejected: ${JSON.stringify(invalid)}`);
  console.log('PASS negative available rejected');

  const restored = await setStock(token, skuId, originalAvailable);
  assert(
    restored.status === 200 && Number(restored.data?.stock?.available) === originalAvailable,
    `FAIL restore stock: ${JSON.stringify(restored)}`,
  );
  console.log(`PASS restored available to ${originalAvailable}`);

  console.log('\nPASS merchant stock verification');
}

main().catch((err) => {
  console.error('\nFAIL merchant stock verification');
  console.error(err?.stack || err?.message || String(err));
  process.exit(1);
});
