import client from './client';

export function login(phone, password) {
  return client.post('/auth/user/login', { phone, password }).then((r) => r.data);
}
