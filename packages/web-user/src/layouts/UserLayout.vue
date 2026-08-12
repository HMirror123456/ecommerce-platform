<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ShoppingBag } from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';
import ProductSearchBar from '@/components/ProductSearchBar.vue';
import { fetchCartItems } from '@/api/cart';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const pageTitle = computed(() => route.meta.title || '');
const headerKeyword = ref('');
const cartCount = ref(0);

const showHeaderSearch = computed(() => true);

const displayName = computed(() => auth.nickname || auth.phone || '');

async function refreshCartCount() {
  if (!auth.isLoggedIn) {
    cartCount.value = 0;
    return;
  }
  try {
    const list = await fetchCartItems();
    cartCount.value = Array.isArray(list) ? list.length : 0;
  } catch {
    // 顶栏角标失败时静默，不影响主流程
  }
}

watch(
  () => [route.name, route.query.keyword, route.query.q],
  () => {
    if (route.name === 'products') {
      const raw = route.query.keyword ?? route.query.q;
      headerKeyword.value = raw == null ? '' : String(raw).trim();
    }
  },
  { immediate: true },
);

watch(
  () => [route.name, auth.isLoggedIn],
  () => {
    refreshCartCount();
  },
);

function onHeaderSearch(keyword) {
  const next = String(keyword || '').trim();
  headerKeyword.value = next;
  const query = {};
  if (next) query.keyword = next;
  if (route.name === 'products' && route.query.categoryId) {
    query.categoryId = route.query.categoryId;
  }
  router.push({ name: 'products', query });
}

function onLogout() {
  auth.logout();
  cartCount.value = 0;
  router.push({ name: 'login' });
}

onMounted(refreshCartCount);
</script>

<template>
  <el-container class="user-layout">
    <el-header class="header">
      <div class="header-inner">
        <router-link to="/products" class="logo">
          <span class="logo-mark">E</span>
          <span class="logo-text">电商平台</span>
        </router-link>
        <div v-if="showHeaderSearch" class="header-search">
          <ProductSearchBar
            v-model="headerKeyword"
            placeholder="搜索商品名称"
            @search="onHeaderSearch"
          />
        </div>
        <div class="header-right">
          <router-link
            to="/products"
            class="nav-link"
            :class="{ active: route.name === 'products' || route.name === 'product-detail' }"
          >
            首页
          </router-link>
          <router-link
            to="/cart"
            class="nav-link cart-link"
            :class="{ active: route.name === 'cart' }"
          >
            <el-icon class="cart-icon"><ShoppingBag /></el-icon>
            <span>购物车</span>
            <span v-if="cartCount > 0" class="cart-badge">{{ cartCount > 99 ? '99+' : cartCount }}</span>
          </router-link>
          <router-link
            to="/user"
            class="nav-link user-link"
            :class="{ active: String(route.path).startsWith('/user') }"
          >
            <span v-if="auth.avatarUrl" class="nav-avatar">
              <img :src="auth.avatarUrl" alt="" />
            </span>
            <span v-else-if="displayName" class="nav-avatar fallback">
              {{ displayName.slice(0, 1) }}
            </span>
            <span>个人中心</span>
          </router-link>
          <span v-if="displayName" class="user-phone">{{ displayName }}</span>
          <el-button link type="primary" @click="onLogout">退出</el-button>
        </div>
      </div>
    </el-header>

    <el-main class="main">
      <h1 v-if="route.name === 'cart'" class="layout-page-title">购物车</h1>
      <p
        v-else-if="pageTitle && !['products', 'product-detail', 'profile', 'user-orders', 'user-favorites', 'user-addresses', 'user-chats'].includes(route.name)"
        class="page-breadcrumb"
      >
        {{ pageTitle }}
      </p>
      <router-view />
    </el-main>
  </el-container>
</template>

<style scoped>
.user-layout {
  min-height: 100vh;
  background: var(--content-bg);
}

.header {
  height: 64px;
  padding: 0;
  background: #fff;
  border-bottom: 1px solid var(--border-color);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-inner {
  max-width: 1200px;
  height: 64px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  align-items: center;
  gap: 20px;
}

.logo {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
}

.logo-mark {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 800;
  color: #fff;
  background: linear-gradient(135deg, #e4393c, #c81623);
  box-shadow: 0 4px 10px rgba(228, 57, 60, 0.28);
}

.logo-text {
  font-size: 20px;
  font-weight: 800;
  color: var(--color-primary);
  letter-spacing: 0.02em;
}

.header-search {
  flex: 1;
  min-width: 0;
  max-width: 480px;
}

.header-search :deep(.product-search-bar) {
  max-width: none;
}

.header-right {
  margin-left: auto;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 14px;
}

.nav-link {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: var(--text-body);
  text-decoration: none;
  padding: 4px 2px;
  transition: color 0.15s;
}

.nav-link:hover,
.nav-link.active {
  color: var(--color-primary);
  font-weight: 600;
}

.cart-link {
  padding-right: 8px;
}

.cart-icon {
  font-size: 16px;
}

.cart-badge {
  position: absolute;
  top: -6px;
  right: -10px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--color-primary);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  line-height: 18px;
  text-align: center;
  box-shadow: 0 0 0 2px #fff;
  animation: badge-pop 0.35s ease;
}

@keyframes badge-pop {
  0% { transform: scale(0.6); }
  70% { transform: scale(1.12); }
  100% { transform: scale(1); }
}

.user-link {
  gap: 6px;
}

.nav-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #fff1f0;
  color: var(--color-primary);
  font-size: 11px;
  font-weight: 700;
  flex-shrink: 0;
}

.nav-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.user-phone {
  color: var(--text-muted);
  font-size: 13px;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.main {
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  padding: 24px;
  flex: 1;
  display: block;
  text-align: left;
  box-sizing: border-box;
}

.layout-page-title {
  margin: 0 0 16px;
  padding: 0;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.3;
  color: var(--text-title);
  text-align: left;
}

.page-breadcrumb {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--text-muted);
  text-align: left;
}

@media (max-width: 768px) {
  .header {
    height: auto;
    min-height: 64px;
  }

  .header-inner {
    height: auto;
    min-height: 64px;
    padding: 10px 16px;
    flex-wrap: wrap;
    gap: 10px;
  }

  .header-search {
    order: 3;
    flex: 1 1 100%;
    max-width: none;
  }

  .header-right {
    margin-left: 0;
    flex-wrap: wrap;
    gap: 10px;
  }

  .user-phone {
    display: none;
  }

  .logo-text {
    font-size: 18px;
  }
}
</style>
