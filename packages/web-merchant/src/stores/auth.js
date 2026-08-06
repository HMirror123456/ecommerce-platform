import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

const STORAGE_KEY = 'merchant_auth';

function loadStored() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
  } catch {
    return null;
  }
}

export const useAuthStore = defineStore('auth', () => {
  const stored = loadStored();
  const token = ref(stored?.token || '');
  const merchantId = ref(stored?.merchantId || null);
  const shopId = ref(stored?.shopId || null);
  const shopName = ref(stored?.shopName || '');
  const username = ref(stored?.username || '');

  const isLoggedIn = computed(() => !!token.value);

  function persist() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        token: token.value,
        merchantId: merchantId.value,
        shopId: shopId.value,
        shopName: shopName.value,
        username: username.value,
      }),
    );
  }

  function setSession(data, name) {
    token.value = data.token;
    merchantId.value = data.merchantId;
    shopId.value = data.shopId;
    shopName.value = data.shopName || '';
    username.value = name;
    persist();
  }

  function logout() {
    token.value = '';
    merchantId.value = null;
    shopId.value = null;
    shopName.value = '';
    username.value = '';
    localStorage.removeItem(STORAGE_KEY);
  }

  return { token, merchantId, shopId, shopName, username, isLoggedIn, setSession, logout };
});
