import client from './client';

export function openAfterSaleChat(afterSaleId) {
  return client.post(`/after-sales/${afterSaleId}/chat/thread`).then((r) => r.data);
}

/** 查看已有客服会话（含已关闭），不新建 */
export function getAfterSaleChatThread(afterSaleId) {
  return client.get(`/after-sales/${afterSaleId}/chat/thread`).then((r) => r.data);
}

export function openMerchantChat(afterSaleId) {
  return client.post(`/after-sales/${afterSaleId}/merchant-chat/thread`).then((r) => r.data);
}

/** 查看已有商家会话（含已关闭），不新建 */
export function getMerchantChatThread(afterSaleId) {
  return client.get(`/after-sales/${afterSaleId}/merchant-chat/thread`).then((r) => r.data);
}

export function openOrderMerchantChat(orderId, payload) {
  return client.post(`/orders/${orderId}/merchant-chat/thread`, payload).then((r) => r.data);
}

export function fetchChatThreads(params) {
  return client.get('/chat/threads', { params }).then((r) => r.data);
}

export function fetchChatMessages(threadId, params) {
  return client.get(`/chat/threads/${threadId}/messages`, { params }).then((r) => r.data);
}

export function sendChatMessage(threadId, payload) {
  return client.post(`/chat/threads/${threadId}/messages`, payload).then((r) => r.data);
}

export function closeChatThread(threadId) {
  return client.post(`/chat/threads/${threadId}/close`).then((r) => r.data);
}
