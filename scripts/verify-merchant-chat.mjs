import http from 'http';

const BASE = process.env.API_BASE || 'http://localhost:8080/api';
const USER = { phone: '13800138000', password: '123456' };
const MERCHANT = { username: 'merchant1', password: '123456' };
const OTHER_MERCHANT = { username: 'merchant2', password: '123456' };
const ADDRESS_ID = 1;
const RUN_ID = String(Date.now()).slice(-6);
const CASE_LABELS = {
  applied: '仅退款',
  return: '退货退款',
  escalated: '平台仲裁',
};

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

async function sendMerchantText(token, threadId, content) {
  return request('POST', `/chat/threads/${threadId}/messages`, {
    token,
    body: { msgType: 'TEXT', content },
  });
}

async function createPaidShippedAfterSale({ userToken, merchantToken, merchantId, target, type, label }) {
  const createdOrder = await request('POST', '/orders', {
    token: userToken,
    body: {
      addressId: ADDRESS_ID,
      items: [{ skuId: target.sku.skuId, quantity: 1 }],
      remark: `自动化测试${CASE_LABELS[label] || '售后沟通'}-${RUN_ID}`,
    },
  });
  assert(
    createdOrder.status === 201 && createdOrder.data?.orderId,
    `FAIL create ${label} order: ${JSON.stringify(createdOrder)}`,
  );

  const orderId = createdOrder.data.orderId;
  const paid = await request('POST', `/orders/${orderId}/pay`, { token: userToken });
  const subOrder = (paid.data?.order?.subOrders || []).find((item) => Number(item.merchantId) === merchantId);
  assert(paid.status === 200 && subOrder?.subOrderId, `FAIL pay ${label} order`);

  const shipped = await request('POST', `/merchant/orders/${subOrder.subOrderId}/ship`, {
    token: merchantToken,
    body: { logisticsCompany: 'ZTO', trackingNo: `ZTCHAT${label}${RUN_ID}` },
  });
  assert(shipped.status === 200, `FAIL ship ${label} order`);

  const afterSale = await request('POST', `/orders/${orderId}/after-sales`, {
    token: userToken,
    body: {
      type,
      reason: label === 'return' ? '自动化测试退货退款' : label === 'escalated' ? '自动化测试平台仲裁' : '自动化测试仅退款',
      subOrderId: subOrder.subOrderId,
    },
  });
  assert(afterSale.status === 201 && afterSale.data?.afterSaleId, `FAIL create ${label} after-sale`);
  return { orderId, afterSaleId: afterSale.data.afterSaleId };
}

async function openUserMerchantThread(token, afterSaleId) {
  const response = await request('POST', `/after-sales/${afterSaleId}/merchant-chat/thread`, { token });
  assert(
    (response.status === 200 || response.status === 201) && response.data?.type === 'USER_MERCHANT',
    `FAIL user open USER_MERCHANT thread for after-sale ${afterSaleId}: ${JSON.stringify(response)}`,
  );
  return response.data;
}

async function assertMerchantHistoryOnly(token, afterSaleId, status) {
  const reopened = await request('POST', `/merchant/after-sales/${afterSaleId}/chat/thread`, { token });
  assert(reopened.status === 409, `FAIL ${status} after-sale accepted POST: ${JSON.stringify(reopened)}`);

  const history = await request('GET', `/after-sales/${afterSaleId}/merchant-chat/thread`, { token });
  assert(
    history.status === 200 && history.data?.type === 'USER_MERCHANT' && history.data?.status === 'CLOSED',
    `FAIL ${status} history should return CLOSED USER_MERCHANT thread: ${JSON.stringify(history)}`,
  );

  const denied = await sendMerchantText(token, history.data.id, '自动化测试：终态售后不应继续发送消息。');
  assert(denied.status >= 400, `FAIL merchant sent message in ${status} history: ${JSON.stringify(denied)}`);
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
    .find(({ sku }) => Number(sku.stock?.available || 0) >= 4);
  assert(target, 'FAIL no ON_SHELF merchant SKU with at least 4 available stock');

  const appliedCase = await createPaidShippedAfterSale({
    userToken,
    merchantToken,
    merchantId,
    target,
    type: 'REFUND_ONLY',
    label: 'applied',
  });
  const { afterSaleId } = appliedCase;

  const openedByUser = await openUserMerchantThread(userToken, afterSaleId);
  const threadId = openedByUser.id;
  const openedByMerchant = await request('POST', `/merchant/after-sales/${afterSaleId}/chat/thread`, { token: merchantToken });
  assert(openedByMerchant.status === 200 && openedByMerchant.data?.id === threadId, 'FAIL merchant should get same thread');
  const initialMessages = await request('GET', `/chat/threads/${threadId}/messages`, { token: merchantToken });
  assert(initialMessages.status === 200 && initialMessages.data?.list?.some((item) => item.msgType === 'CARD'), 'FAIL initial card missing');
  console.log('PASS USER_MERCHANT thread and card are idempotent');

  const reply = await sendMerchantText(merchantToken, threadId, '自动化测试：商家正在处理该售后申请。');
  assert(reply.status === 201 && reply.data?.senderType === 'MERCHANT', 'FAIL merchant send message');
  const userMessages = await request('GET', `/chat/threads/${threadId}/messages`, { token: userToken });
  assert(userMessages.status === 200 && userMessages.data?.list?.some((item) => item.id === reply.data.id), 'FAIL user read merchant message');
  console.log('PASS APPLIED merchant reply is visible to user');

  const returnCase = await createPaidShippedAfterSale({
    userToken,
    merchantToken,
    merchantId,
    target,
    type: 'RETURN_REFUND',
    label: 'return',
  });
  const returnThread = await openUserMerchantThread(userToken, returnCase.afterSaleId);
  const approved = await request('POST', `/merchant/after-sales/${returnCase.afterSaleId}/audit`, {
    token: merchantToken,
    body: { approved: true },
  });
  assert(approved.status === 200 && approved.data?.afterSale?.status === 'APPROVED', 'FAIL approve RETURN_REFUND after-sale');
  const approvedMessage = await sendMerchantText(
    merchantToken,
    returnThread.id,
    '自动化测试：商家已同意退货退款，请用户寄回商品。',
  );
  assert(approvedMessage.status === 201, 'FAIL merchant send in APPROVED thread');

  const returned = await request('POST', `/orders/${returnCase.orderId}/after-sales/${returnCase.afterSaleId}/return`, {
    token: userToken,
    body: { logisticsCompany: 'ZTO', trackingNo: `ZTRTN${RUN_ID}` },
  });
  assert(returned.status === 200 && returned.data?.status === 'RETURNING', 'FAIL submit RETURN_REFUND return shipment');
  const returningMessage = await sendMerchantText(
    merchantToken,
    returnThread.id,
    '自动化测试：用户已填写寄回物流，等待商家验收。',
  );
  assert(returningMessage.status === 201, 'FAIL merchant send in RETURNING thread');
  console.log('PASS APPROVED and RETURNING merchant replies are allowed');

  const rejectedCase = await createPaidShippedAfterSale({
    userToken,
    merchantToken,
    merchantId,
    target,
    type: 'REFUND_ONLY',
    label: 'rejected',
  });
  const rejectedThread = await openUserMerchantThread(userToken, rejectedCase.afterSaleId);
  const rejected = await request('POST', `/merchant/after-sales/${rejectedCase.afterSaleId}/audit`, {
    token: merchantToken,
    body: { approved: false, reason: '自动化测试：当前售后申请暂不符合处理条件。' },
  });
  assert(rejected.status === 200 && rejected.data?.afterSale?.status === 'REJECTED', 'FAIL reject after-sale');
  const rejectedHistory = await request('GET', `/after-sales/${rejectedCase.afterSaleId}/merchant-chat/thread`, { token: merchantToken });
  assert(
    rejectedHistory.status === 200 && rejectedHistory.data?.id === rejectedThread.id && rejectedHistory.data?.status === 'OPEN',
    `FAIL REJECTED USER_MERCHANT thread should stay OPEN: ${JSON.stringify(rejectedHistory)}`,
  );
  const rejectedMessage = await sendMerchantText(
    merchantToken,
    rejectedThread.id,
    '自动化测试：商家愿意继续说明拒绝原因并协商处理方案。',
  );
  assert(rejectedMessage.status === 201, 'FAIL merchant send in REJECTED thread');
  console.log('PASS REJECTED merchant thread remains open and replyable');

  const escalatedCase = await createPaidShippedAfterSale({
    userToken,
    merchantToken,
    merchantId,
    target,
    type: 'REFUND_ONLY',
    label: 'escalated',
  });
  await openUserMerchantThread(userToken, escalatedCase.afterSaleId);
  const escalated = await request(
    'POST',
    `/orders/${escalatedCase.orderId}/after-sales/${escalatedCase.afterSaleId}/escalate`,
    { token: userToken },
  );
  assert(escalated.status === 200 && escalated.data?.afterSale?.status === 'ESCALATED', 'FAIL escalate after-sale');
  await assertMerchantHistoryOnly(merchantToken, escalatedCase.afterSaleId, 'ESCALATED');

  const refunded = await request('POST', `/merchant/after-sales/${afterSaleId}/audit`, {
    token: merchantToken,
    body: { approved: true },
  });
  assert(refunded.status === 200 && refunded.data?.afterSale?.status === 'REFUNDED', 'FAIL refund REFUND_ONLY after-sale');
  await assertMerchantHistoryOnly(merchantToken, afterSaleId, 'REFUNDED');
  console.log('PASS ESCALATED and REFUNDED histories are CLOSED and read-only');

  const deniedOtherMerchant = await request('GET', `/chat/threads/${threadId}/messages`, { token: otherMerchantToken });
  assert(deniedOtherMerchant.status === 403, 'FAIL other merchant accessed thread');
  const merchantThreads = await request('GET', '/chat/threads', { token: merchantToken });
  assert(merchantThreads.status === 200 && merchantThreads.data?.list?.some((item) => item.id === threadId), 'FAIL merchant thread list');
  const csThread = await request('GET', `/after-sales/${escalatedCase.afterSaleId}/chat/thread`, { token: userToken });
  assert(csThread.status === 200 && csThread.data?.type === 'USER_CS', 'FAIL get USER_CS history after escalation');
  const deniedCs = await request('GET', `/chat/threads/${csThread.data?.id}/messages`, { token: merchantToken });
  assert(deniedCs.status === 403, 'FAIL merchant accessed USER_CS');
  console.log('PASS merchant permission boundaries and USER_CS isolation');
}

main().then(() => console.log('\nPASS merchant chat verification')).catch((err) => {
  console.error('\nFAIL merchant chat verification');
  console.error(err?.stack || err?.message || String(err));
  process.exit(1);
});
