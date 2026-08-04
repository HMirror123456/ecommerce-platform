import client from './client';

export function login(username, password) {
  return client.post('/auth/merchant/login', { username, password }).then((r) => r.data);
}
