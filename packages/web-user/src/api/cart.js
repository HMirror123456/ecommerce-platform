import client from './client';

export function fetchCartItems() {
  return client.get('/cart/items').then((r) => r.data);
}

export function addCartItem(skuId, quantity) {
  return client.post('/cart/items', { skuId, quantity }).then((r) => r.data);
}

export function updateCartItem(itemId, quantity) {
  return client.put(`/cart/items/${itemId}`, { quantity }).then((r) => r.data);
}

export function deleteCartItem(itemId) {
  return client.delete(`/cart/items/${itemId}`);
}
