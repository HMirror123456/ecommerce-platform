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
        <router-link to="/" class="logo">电商平台</router-link>
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
  justify-content: space-between;
}
.logo {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-primary);
  text-decoration: none;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}
.page-breadcrumb {
  color: var(--text-muted);
  font-size: 13px;
}
.user-phone {
  color: var(--text-body);
}
.main {
  max-width: 1200px;
  margin: 0 auto;
  padding: 24px;
}
</style>
