import client from './client';

export function login(username, password) {
  return client.post('/auth/merchant/login', { username, password }).then((r) => r.data);
}

export function submitOnboardingApplication(payload) {
  return client.post('/merchant/applications', payload).then((r) => r.data);
}

export function fetchOnboardingStatus(contactPhone) {
  return client.get('/merchant/applications/status', { params: { contactPhone } }).then((r) => r.data);
}

export function fetchMerchantOrders(params) {
  return client.get('/merchant/orders', { params }).then((r) => r.data);
}

export function getDashboardSummary() {
  return client.get('/merchant/dashboard/summary').then((r) => r.data);
}

export function fetchCategories() {
  return client.get('/categories').then((r) => r.data);
}

export function shipMerchantOrder(subOrderId, payload) {
  return client.post(`/merchant/orders/${subOrderId}/ship`, payload).then((r) => r.data);
}

export function fetchMerchantProducts(params) {
  return client.get('/merchant/products', { params }).then((r) => r.data);
}

export function fetchMerchantProduct(spuId) {
  return client.get(`/merchant/products/${spuId}`).then((r) => r.data);
}

export function createMerchantProduct(payload) {
  return client.post('/merchant/products', payload).then((r) => r.data);
}

export function updateMerchantProduct(spuId, payload) {
  return client.put(`/merchant/products/${spuId}`, payload).then((r) => r.data);
}

export function submitMerchantProductAudit(spuId) {
  return client.post(`/merchant/products/${spuId}/submit-audit`).then((r) => r.data);
}

export function batchSubmitMerchantProductAudit(spuIds) {
  return client.post('/merchant/products/batch-submit-audit', { spuIds }).then((r) => r.data);
}

export function offShelfMerchantProduct(spuId) {
  return client.post(`/merchant/products/${spuId}/off-shelf`).then((r) => r.data);
}

export function batchOffShelfMerchantProducts(spuIds) {
  return client.post('/merchant/products/batch-off-shelf', { spuIds }).then((r) => r.data);
}

export function updateMerchantSkuStock(skuId, payload) {
  return client.patch(`/merchant/skus/${skuId}/stock`, payload).then((r) => r.data);
}

export function getAfterSales(params) {
  return client.get('/merchant/after-sales', { params }).then((r) => r.data);
}

export function auditAfterSale(afterSaleId, data) {
  return client.post(`/merchant/after-sales/${afterSaleId}/audit`, data).then((r) => r.data);
}

export function confirmAfterSaleReturn(afterSaleId) {
  return client.post(`/merchant/after-sales/${afterSaleId}/confirm-return`).then((r) => r.data);
}

export function openMerchantAfterSaleChat(afterSaleId) {
  return client.post(`/merchant/after-sales/${afterSaleId}/chat/thread`).then((r) => r.data);
}

export function fetchMerchantChatThreads(params) {
  return client.get('/chat/threads', { params: { type: 'USER_MERCHANT', ...params } }).then((r) => r.data);
}

export function fetchMerchantChatMessages(threadId, params) {
  return client.get(`/chat/threads/${threadId}/messages`, { params }).then((r) => r.data);
}

export function sendMerchantChatMessage(threadId, payload) {
  return client.post(`/chat/threads/${threadId}/messages`, payload).then((r) => r.data);
}
