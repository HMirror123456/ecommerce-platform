import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

const STORAGE_KEY = 'admin_auth';

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
  const adminId = ref(stored?.adminId || null);
  const role = ref(stored?.role || '');
  const username = ref(stored?.username || '');

  const isLoggedIn = computed(() => !!token.value);
  const isOperator = computed(() => role.value === 'OPERATOR');
  const isCsAgent = computed(() => role.value === 'CS_AGENT');

  function persist() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ token: token.value, adminId: adminId.value, role: role.value, username: username.value }),
    );
  }

  function setSession(data, name) {
    token.value = data.token;
    adminId.value = data.adminId;
    role.value = data.role;
    username.value = name;
    persist();
  }

  function logout() {
    token.value = '';
    adminId.value = null;
    role.value = '';
    username.value = '';
    localStorage.removeItem(STORAGE_KEY);
  }

  return { token, adminId, role, username, isLoggedIn, isOperator, isCsAgent, setSession, logout };
});
