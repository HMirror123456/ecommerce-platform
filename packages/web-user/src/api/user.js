import client from './client';

export function fetchProfile() {
  return client.get('/users/me').then((r) => r.data);
}

export function updateProfile(payload) {
  return client.put('/users/me', payload).then((r) => r.data);
}
