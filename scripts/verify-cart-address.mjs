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

const login = await request('POST', '/auth/user/login', {
  body: { phone: '13800138000', password: '123456' },
});
assert(login.status === 200 && login.data.token, 'user login failed');
const token = login.data.token;

const noAuth = await request('GET', '/cart/items');
assert(noAuth.status === 401, 'cart should require auth');

const merchantLogin = await request('POST', '/auth/merchant/login', {
  body: { username: 'merchant1', password: '123456' },
});
const merchantCart = await request('GET', '/cart/items', { token: merchantLogin.data.token });
assert(merchantCart.status === 403, 'merchant token should not access cart');

const createdAddr = await request('POST', '/users/addresses', {
  token,
  body: {
    receiverName: '测试收件人',
    phone: '13900001111',
    province: '上海市',
    city: '上海市',
    district: '浦东新区',
    detail: '世纪大道 1 号',
    isDefault: false,
  },
});
assert(createdAddr.status === 201, `create address failed: ${JSON.stringify(createdAddr)}`);
const addressId = createdAddr.data.id;

const listAddr = await request('GET', '/users/addresses', { token });
assert(Array.isArray(listAddr.data) && listAddr.data.some((a) => a.id === addressId), 'address list missing new item');

const updatedAddr = await request('PUT', `/users/addresses/${addressId}`, {
  token,
  body: { detail: '世纪大道 2 号' },
});
assert(updatedAddr.status === 200 && updatedAddr.data.detail === '世纪大道 2 号', 'update address failed');

const defaultAddr = await request('PATCH', `/users/addresses/${addressId}/default`, { token });
assert(defaultAddr.status === 200 && defaultAddr.data.isDefault === true, 'set default failed');

const addCart = await request('POST', '/cart/items', {
  token,
  body: { skuId: 1001, quantity: 2 },
});
assert(addCart.status === 201 && addCart.data.quantity === 2, `add cart failed: ${JSON.stringify(addCart)}`);
const itemId = addCart.data.itemId;

const addAgain = await request('POST', '/cart/items', {
  token,
  body: { skuId: 1001, quantity: 1 },
});
assert(addAgain.status === 201 && addAgain.data.quantity === 3, 'cart merge failed');

const updateCart = await request('PUT', `/cart/items/${itemId}`, {
  token,
  body: { quantity: 1 },
});
assert(updateCart.status === 200 && updateCart.data.quantity === 1, 'update cart failed');

const cartList = await request('GET', '/cart/items', { token });
assert(Array.isArray(cartList.data) && cartList.data.length >= 1, 'cart list empty');

const order = await request('POST', '/orders', {
  token,
  body: {
    addressId,
    items: [{ skuId: 1001, quantity: 1 }],
  },
});
assert(order.status === 201 && order.data.orderId, `create order failed: ${JSON.stringify(order)}`);

await request('DELETE', `/cart/items/${itemId}`, { token });
await request('DELETE', `/users/addresses/${addressId}`, { token });

console.log('OK: cart/address CRUD + auth + order flow passed');
