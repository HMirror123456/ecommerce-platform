<script setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const activeMenu = computed(() => route.path);
const pageTitle = computed(() => route.meta.title || '平台管理后台');
const roleLabel = computed(() => (auth.role === 'OPERATOR' ? '运营管理员' : '客服管理员'));

function logout() {
  auth.logout();
  router.push({ name: 'login' });
}
</script>

<template>
  <el-container class="layout">
    <el-aside width="220px" class="sidebar">
      <div class="logo">平台管理后台</div>
      <el-menu :default-active="activeMenu" router background-color="#001529" text-color="#fff" active-text-color="#ffd04b">
        <el-menu-item index="/dashboard">
          <el-icon><Odometer /></el-icon>
          <span>工作台</span>
        </el-menu-item>
        <el-menu-item v-if="auth.isOperator" index="/audit/products">
          <el-icon><Goods /></el-icon>
          <span>商品审核</span>
        </el-menu-item>
        <el-menu-item v-if="auth.isOperator" index="/audit/merchants">
          <el-icon><Shop /></el-icon>
          <span>商家审核</span>
        </el-menu-item>
        <el-menu-item v-if="auth.isCsAgent" index="/after-sales">
          <el-icon><Service /></el-icon>
          <span>售后仲裁</span>
        </el-menu-item>
        <el-menu-item index="/orders">
          <el-icon><List /></el-icon>
          <span>订单查询</span>
        </el-menu-item>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="header">
        <el-breadcrumb separator="/">
          <el-breadcrumb-item>首页</el-breadcrumb-item>
          <el-breadcrumb-item>{{ pageTitle }}</el-breadcrumb-item>
        </el-breadcrumb>
        <div class="header-right">
          <span class="user">{{ auth.username }}（{{ roleLabel }}）</span>
          <el-button link type="primary" @click="logout">退出</el-button>
        </div>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.layout { height: 100vh; }
.sidebar { background: var(--sidebar-bg); }
.logo {
  height: 56px;
  line-height: 56px;
  text-align: center;
  color: #fff;
  font-weight: 600;
  font-size: 16px;
  border-bottom: 1px solid rgba(255,255,255,.1);
}
.header {
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #e8e8e8;
  height: 56px;
}
.header-right { display: flex; align-items: center; gap: 12px; }
.user { color: #666; }
.main { background: var(--content-bg); padding: 16px; }
</style>
