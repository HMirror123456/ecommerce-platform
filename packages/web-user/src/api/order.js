import client from './client';

export function createOrder(payload) {
  return client.post('/orders', payload).then((r) => r.data);
}

export function fetchOrders(params) {
  return client.get('/orders', { params }).then((r) => r.data);
}

export function fetchOrder(orderId) {
  return client.get(`/orders/${orderId}`).then((r) => r.data);
}

export function payOrder(orderId) {
  return client.post(`/orders/${orderId}/pay`).then((r) => r.data);
}

export function cancelOrder(orderId) {
  return client.post(`/orders/${orderId}/cancel`).then((r) => r.data);
}

export function confirmReceipt(orderId) {
  return client.post(`/orders/${orderId}/confirm-receipt`).then((r) => r.data);
}

/** 领域：子单 SHIPPED → COMPLETED */
export function confirmSubOrderReceipt(orderId, subOrderId) {
  return client
    .post(`/orders/${orderId}/sub-orders/${subOrderId}/confirm-receipt`)
    .then((r) => r.data);
}

export function applyAfterSale(orderId, payload) {
  return client.post(`/orders/${orderId}/after-sales`, payload).then((r) => r.data);
}

export function escalateAfterSale(orderId, afterSaleId) {
  return client.post(`/orders/${orderId}/after-sales/${afterSaleId}/escalate`).then((r) => r.data);
}

export function submitAfterSaleReturn(orderId, afterSaleId, payload) {
  return client
    .post(`/orders/${orderId}/after-sales/${afterSaleId}/return`, payload)
    .then((r) => r.data);
}
