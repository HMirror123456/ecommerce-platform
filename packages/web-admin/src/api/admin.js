import client from './client';

export function login(username, password) {
  return client.post('/auth/admin/login', { username, password }).then((r) => r.data);
}

export function fetchPendingProducts(params) {
  return client.get('/admin/products/pending', { params }).then((r) => r.data);
}

export function fetchProductDetail(spuId) {
  return client.get(`/admin/products/${spuId}`).then((r) => r.data);
}

export function auditProduct(spuId, approved, reason) {
  return client.post(`/admin/products/${spuId}/audit`, { approved, reason }).then((r) => r.data);
}

export function fetchOrders(params) {
  return client.get('/admin/orders', { params }).then((r) => r.data);
}

export function fetchOrderDetail(orderId) {
  return client.get(`/admin/orders/${orderId}`).then((r) => r.data);
}
