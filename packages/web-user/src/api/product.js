import client from './client';

export function fetchProductDetail(spuId) {
  return client.get(`/products/${spuId}`).then((r) => r.data);
}
