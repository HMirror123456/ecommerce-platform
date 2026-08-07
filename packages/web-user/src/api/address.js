import client from './client';

export function fetchAddresses() {
  return client.get('/users/addresses').then((r) => r.data);
}

export function createAddress(payload) {
  return client.post('/users/addresses', payload).then((r) => r.data);
}

export function updateAddress(addressId, payload) {
  return client.put(`/users/addresses/${addressId}`, payload).then((r) => r.data);
}

export function deleteAddress(addressId) {
  return client.delete(`/users/addresses/${addressId}`);
}

export function setDefaultAddress(addressId) {
  return client.patch(`/users/addresses/${addressId}/default`).then((r) => r.data);
}
