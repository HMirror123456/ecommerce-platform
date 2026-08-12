<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const pageTitle = computed(() => route.meta.title || '');

function onLogout() {
  auth.logout();
  router.push({ name: 'login' });
}
</script>

<template>
  <el-container class="user-layout">
    <el-header class="header">
      <div class="header-inner">
        <router-link to="/products" class="logo">电商平台</router-link>
        <div class="header-right">
          <router-link to="/products" class="nav-link">首页</router-link>
          <router-link to="/cart" class="nav-link">购物车</router-link>
          <router-link to="/user" class="nav-link">个人中心</router-link>
          <span v-if="auth.nickname || auth.phone" class="user-phone">{{ auth.nickname || auth.phone }}</span>
          <el-button link type="primary" @click="onLogout">退出</el-button>
        </div>
      </div>
    </el-header>

    <el-main class="main">
      <h1 v-if="route.name === 'cart'" class="layout-page-title">购物车</h1>
      <p
        v-else-if="pageTitle && !['products', 'product-detail', 'profile', 'user-orders', 'user-favorites', 'user-addresses'].includes(route.name)"
        class="page-breadcrumb"
      >
        {{ pageTitle }}
      </p>
      <router-view />
    </el-main>

    <el-footer class="footer">
      <div class="footer-inner">
        <span>© 2026 电商平台 · 课程演示项目</span>
      </div>
    </el-footer>
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
}
.header-inner {
  max-width: 1200px;
  height: 64px;
  margin: 0 auto;
  padding: 0 24px;
  display: flex;
  align-items: center;
  gap: 24px;
}
.logo {
  flex-shrink: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--color-primary);
  text-decoration: none;
}
.header-right {
  margin-left: auto;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 16px;
}
.nav-link {
  font-size: 14px;
  color: var(--text-body);
  text-decoration: none;
}
.nav-link:hover {
  color: var(--color-primary);
}
.user-phone {
  color: var(--text-body);
  font-size: 13px;
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
.footer {
  height: auto;
  padding: 24px;
  background: #fff;
  border-top: 1px solid var(--border-color);
}
.footer-inner {
  max-width: 1200px;
  margin: 0 auto;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
