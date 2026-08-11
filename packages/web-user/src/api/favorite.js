import client from './client';

export function fetchFavorites() {
  return client.get('/favorites').then((r) => r.data);
}

export function addFavorite(spuId) {
  return client.post('/favorites', { spuId }).then((r) => r.data);
}

export function removeFavorite(spuId) {
  return client.delete(`/favorites/${spuId}`);
}

export function checkFavorite(spuId) {
  return client.get(`/favorites/${spuId}`).then((r) => r.data);
}
