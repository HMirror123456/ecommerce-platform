import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

const STORAGE_KEY = 'user_auth';

export const useAuthStore = defineStore('auth', () => {
  const token = ref('');
  const userId = ref(null);
  const phone = ref('');

  const isLoggedIn = computed(() => Boolean(token.value));

  function persist() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ token: token.value, userId: userId.value, phone: phone.value }),
    );
  }

  function loadStored() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      token.value = data.token || '';
      userId.value = data.userId ?? null;
      phone.value = data.phone || '';
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  function setSession(data, loginPhone) {
    token.value = data.token;
    userId.value = data.userId;
    phone.value = loginPhone;
    persist();
  }

  function logout() {
    token.value = '';
    userId.value = null;
    phone.value = '';
    localStorage.removeItem(STORAGE_KEY);
  }

  return { token, userId, phone, isLoggedIn, setSession, logout, loadStored };
});
