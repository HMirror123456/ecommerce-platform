import http from 'http';

const BASE = process.env.API_BASE || 'http://localhost:8080/api';
const USER = { phone: '13800138000', password: '123456' };
const MERCHANT = { username: 'merchant1', password: '123456' };
const OTHER_MERCHANT = { username: 'merchant2', password: '123456' };
const ADDRESS_ID = 1;
const RUN_ID = String(Date.now()).slice(-6);

function request(method, path, { token, body } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    }, (res) => {
      let raw = '';
      res.on('data', (chunk) => { raw += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: raw ? JSON.parse(raw) : null });
        } catch {
          resolve({ status: res.statusCode, data: raw });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function openMerchantThread(token, afterSaleId) {
  const response = await request('POST', `/merchant/after-sales/${afterSaleId}/chat/thread`, { token });
  assert(
    (response.status === 200 || response.status === 201) && response.data?.type === 'USER_MERCHANT',
    `FAIL open USER_MERCHANT thread for after-sale ${afterSaleId}: ${JSON.stringify(response)}`,
  );
  return response.data;
}

async function sendMerchantText(token, threadId, content) {
  return request('POST', `/chat/threads/${threadId}/messages`, {
    token,
    body: { msgType: 'TEXT', content },
  });
}

async function main() {
  console.log('VERIFY merchant chat flow');
  const userLogin = await request('POST', '/auth/user/login', { body: USER });
  const merchantLogin = await request('POST', '/auth/merchant/login', { body: MERCHANT });
  const otherMerchantLogin = await request('POST', '/auth/merchant/login', { body: OTHER_MERCHANT });
  assert(userLogin.status === 200 && userLogin.data?.token, 'FAIL user login');
  assert(merchantLogin.status === 200 && merchantLogin.data?.token, 'FAIL merchant login');
  assert(otherMerchantLogin.status === 200 && otherMerchantLogin.data?.token, 'FAIL other merchant login');
  const userToken = userLogin.data.token;
  const merchantToken = merchantLogin.data.token;
  const otherMerchantToken = otherMerchantLogin.data.token;
  const merchantId = Number(merchantLogin.data.merchantId);
  console.log('PASS login');

  const products = await request('GET', '/merchant/products', { token: merchantToken });
  const target = (Array.isArray(products.data) ? products.data : products.data?.list || [])
    .flatMap((product) => (product.status === 'ON_SHELF' ? (product.skus || []).map((sku) => ({ product, sku })) : []))
    .find(({ sku }) => Number(sku.stock?.available || 0) >= 1);
  assert(target, 'FAIL no ON_SHELF merchant SKU with stock');

  const createdOrder = await request('POST', '/orders', {
    token: userToken,
    body: { addressId: ADDRESS_ID, items: [{ skuId: target.sku.skuId, quantity: 1 }], remark: `聊天验证-${RUN_ID}` },
  });
  assert(createdOrder.status === 201 && createdOrder.data?.orderId, 'FAIL create order');
  const orderId = createdOrder.data.orderId;
  const paid = await request('POST', `/orders/${orderId}/pay`, { token: userToken });
  const subOrder = (paid.data?.order?.subOrders || []).find((item) => Number(item.merchantId) === merchantId);
  assert(paid.status === 200 && subOrder?.subOrderId, 'FAIL pay order');
  const shipped = await request('POST', `/merchant/orders/${subOrder.subOrderId}/ship`, {
    token: merchantToken,
    body: { logisticsCompany: '中通快递', trackingNo: `ZTCHAT${RUN_ID}` },
  });
  assert(shipped.status === 200, 'FAIL ship order');
  const afterSale = await request('POST', `/orders/${orderId}/after-sales`, {
    token: userToken,
    body: { type: 'REFUND_ONLY', reason: '聊天功能验证', subOrderId: subOrder.subOrderId },
  });
  assert(afterSale.status === 201 && afterSale.data?.afterSaleId, 'FAIL create after-sale');
  const afterSaleId = afterSale.data.afterSaleId;

  const openedByUser = await request('POST', `/after-sales/${afterSaleId}/merchant-chat/thread`, { token: userToken });
  assert(openedByUser.status === 201 && openedByUser.data?.type === 'USER_MERCHANT', 'FAIL user open merchant chat');
  const threadId = openedByUser.data.id;
  const openedByMerchant = await request('POST', `/merchant/after-sales/${afterSaleId}/chat/thread`, { token: merchantToken });
  assert(openedByMerchant.status === 200 && openedByMerchant.data?.id === threadId, 'FAIL merchant should get same thread');
  const initialMessages = await request('GET', `/chat/threads/${threadId}/messages`, { token: merchantToken });
  assert(initialMessages.status === 200 && initialMessages.data?.list?.some((item) => item.msgType === 'CARD'), 'FAIL initial card missing');
  console.log('PASS USER_MERCHANT thread and card are idempotent');

  const reply = await sendMerchantText(merchantToken, threadId, `商家回复-${RUN_ID}`);
  assert(reply.status === 201 && reply.data?.senderType === 'MERCHANT', 'FAIL merchant send message');
  const userMessages = await request('GET', `/chat/threads/${threadId}/messages`, { token: userToken });
  assert(userMessages.status === 200 && userMessages.data?.list?.some((item) => item.id === reply.data.id), 'FAIL user read merchant message');
  console.log('PASS APPLIED merchant reply is visible to user');

  const afterSales = await request('GET', '/merchant/after-sales', { token: merchantToken });
  assert(afterSales.status === 200 && Array.isArray(afterSales.data?.list), 'FAIL query merchant after-sales');
  const byStatus = (status) => afterSales.data.list.find((item) => item.status === status);
  for (const status of ['APPROVED', 'RETURNING']) {
    const item = byStatus(status);
    assert(item?.afterSaleId, `FAIL missing ${status} demo after-sale`);
    const thread = await openMerchantThread(merchantToken, item.afterSaleId);
    const sent = await sendMerchantText(merchantToken, thread.id, `${status} 商家沟通-${RUN_ID}`);
    assert(sent.status === 201 && sent.data?.senderType === 'MERCHANT', `FAIL merchant send in ${status} thread`);
  }
  console.log('PASS APPROVED and RETURNING merchant replies are allowed');

  for (const status of ['ESCALATED', 'REFUNDED']) {
    const item = byStatus(status);
    assert(item?.afterSaleId, `FAIL missing ${status} demo after-sale`);
    const thread = await openMerchantThread(merchantToken, item.afterSaleId);
    const denied = await sendMerchantText(merchantToken, thread.id, `${status} 商家不应发送-${RUN_ID}`);
    assert(denied.status === 403, `FAIL merchant sent message in ${status} thread: ${JSON.stringify(denied)}`);
  }
  console.log('PASS ESCALATED and REFUNDED merchant threads are read-only');

  const deniedOtherMerchant = await request('GET', `/chat/threads/${threadId}/messages`, { token: otherMerchantToken });
  assert(deniedOtherMerchant.status === 403, 'FAIL other merchant accessed thread');
  const merchantThreads = await request('GET', '/chat/threads', { token: merchantToken });
  assert(merchantThreads.status === 200 && merchantThreads.data?.list?.some((item) => item.id === threadId), 'FAIL merchant thread list');
  const csThread = await request('POST', `/after-sales/${afterSaleId}/chat/thread`, { token: userToken });
  const deniedCs = await request('GET', `/chat/threads/${csThread.data?.id}/messages`, { token: merchantToken });
  assert(deniedCs.status === 403, 'FAIL merchant accessed USER_CS');
  console.log('PASS merchant permission boundaries and USER_CS isolation');
}

main().then(() => console.log('\nPASS merchant chat verification')).catch((err) => {
  console.error('\nFAIL merchant chat verification');
  console.error(err?.stack || err?.message || String(err));
  process.exit(1);
});
