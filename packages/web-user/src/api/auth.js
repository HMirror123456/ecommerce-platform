import client from './client';

export function login(phone, password) {
  return client.post('/auth/user/login', { phone, password }).then((r) => r.data);
}

export function register(phone, password) {
  return client.post('/auth/user/register', { phone, password }).then((r) => r.data);
}
