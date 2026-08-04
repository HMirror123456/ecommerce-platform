import axios from 'axios';
import { useAuthStore } from '@/stores/auth';
import router from '@/router';

const client = axios.create({ baseURL: '/api', timeout: 15000 });

client.interceptors.request.use((config) => {
  const auth = useAuthStore();
  if (auth.token) config.headers.Authorization = `Bearer ${auth.token}`;
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    const msg = err.response?.data?.message || err.message;
    if (status === 401) {
      useAuthStore().logout();
      router.push({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } });
    }
    return Promise.reject(new Error(msg));
  },
);

export default client;
