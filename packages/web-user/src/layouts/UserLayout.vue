<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { fetchCartItems } from '@/api/cart';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const cartCount = ref(0);
const pageTitle = computed(() => route.meta.title || '');

async function refreshCartCount() {
  if (!auth.isLoggedIn) {
    cartCount.value = 0;
    return;
  }
  try {
    const items = await fetchCartItems();
    cartCount.value = items.reduce((sum, item) => sum + item.quantity, 0);
  } catch {
    cartCount.value = 0;
  }
}

function onLogout() {
  auth.logout();
  router.push({ name: 'login' });
}

onMounted(refreshCartCount);
watch(() => route.path, refreshCartCount);
</script>

<template>
  <el-container class="user-layout">
    <el-header class="header">
      <div class="header-inner">
        <router-link to="/cart" class="logo">电商平台</router-link>
        <nav class="nav-links">
          <router-link to="/cart" class="nav-link">
            购物车
            <el-badge v-if="cartCount > 0" :value="cartCount" class="cart-badge" />
          </router-link>
          <router-link to="/addresses" class="nav-link">地址管理</router-link>
        </nav>
        <div class="header-right">
          <span v-if="pageTitle" class="page-breadcrumb">{{ pageTitle }}</span>
          <span v-if="auth.phone" class="user-phone">{{ auth.phone }}</span>
          <el-button link type="primary" @click="onLogout">退出</el-button>
        </div>
      </div>
    </el-header>
    <el-main class="main">
      <router-view />
    </el-main>
  </el-container>
</template>

<style scoped>
.user-layout { min-height: 100vh; background: var(--content-bg); }
.header {
  height: 64px; padding: 0; background: #fff;
  border-bottom: 1px solid var(--border-color);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}
.header-inner {
  max-width: 1200px; height: 64px; margin: 0 auto; padding: 0 24px;
  display: flex; align-items: center; gap: 24px;
}
.logo {
  font-size: 20px; font-weight: 700; color: var(--color-primary); text-decoration: none;
}
.nav-links { display: flex; align-items: center; gap: 20px; flex: 1; }
.nav-link {
  color: var(--text-body); text-decoration: none; font-size: 14px;
  display: inline-flex; align-items: center; gap: 6px;
}
.nav-link.router-link-active { color: var(--color-primary); font-weight: 600; }
.header-right { display: flex; align-items: center; gap: 16px; margin-left: auto; }
.page-breadcrumb { color: var(--text-muted); font-size: 13px; }
.user-phone { color: var(--text-body); }
.main { max-width: 1200px; margin: 0 auto; padding: 24px; }
.cart-badge :deep(.el-badge__content) { transform: translateY(-2px); }
</style>
