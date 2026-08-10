import client from './client';

export function fetchCategories() {
  return client.get('/categories').then((r) => r.data);
}

export function fetchProductList(params) {
  return client.get('/products', { params }).then((r) => r.data);
}

export function fetchProductDetail(spuId) {
  return client.get(`/products/${spuId}`).then((r) => r.data);
}
