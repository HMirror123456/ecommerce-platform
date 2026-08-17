<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { fetchMerchantChatUnreadCount } from '@/api/merchant';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const activeMenu = computed(() => route.path);
const pageTitle = computed(() => route.meta.title || '商家后台');
const displayName = computed(() => auth.shopName || auth.username || '商家');
const unreadCount = ref(0);
let unreadTimer = null;

async function refreshUnreadCount() {
  try {
    const data = await fetchMerchantChatUnreadCount();
    unreadCount.value = Number(data?.unreadCount) || 0;
  } catch {
    unreadCount.value = 0;
  }
}

function logout() {
  auth.logout();
  router.push({ name: 'login' });
}

onMounted(() => {
  refreshUnreadCount();
  window.addEventListener('merchant-chat-unread-changed', refreshUnreadCount);
  unreadTimer = window.setInterval(refreshUnreadCount, 15000);
});

onUnmounted(() => {
  window.removeEventListener('merchant-chat-unread-changed', refreshUnreadCount);
  if (unreadTimer) window.clearInterval(unreadTimer);
});
</script>

<template>
  <el-container class="layout">
    <el-aside width="220px" class="sidebar">
      <div class="logo">商家后台</div>
      <el-menu class="merchant-menu" :default-active="activeMenu" router background-color="#0f1d36" text-color="#cbd5e1" active-text-color="#fff">
        <el-menu-item index="/dashboard">
          <el-icon><HomeFilled /></el-icon>
          <span>工作台</span>
        </el-menu-item>
        <el-menu-item index="/products">
          <el-icon><Goods /></el-icon>
          <span>商品管理</span>
        </el-menu-item>
        <el-menu-item index="/orders">
          <el-icon><Tickets /></el-icon>
          <span>订单管理</span>
        </el-menu-item>
        <el-menu-item index="/after-sales">
          <el-icon><Service /></el-icon>
          <span>售后处理</span>
        </el-menu-item>
        <el-menu-item index="/chats">
          <el-icon><ChatDotRound /></el-icon>
          <el-badge type="danger" :value="unreadCount > 99 ? '99+' : unreadCount" :hidden="!unreadCount" class="chat-badge">
            <span>用户沟通</span>
          </el-badge>
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
          <span class="user">{{ displayName }}</span>
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
.layout { min-height: 100vh; }
.sidebar { background: var(--sidebar-bg); border-right: 1px solid rgba(255,255,255,.06); }
.logo {
  display: flex;
  align-items: center;
  height: 64px;
  padding: 0 22px;
  color: #fff;
  font-weight: 700;
  font-size: 17px;
  letter-spacing: .5px;
  border-bottom: 1px solid rgba(255,255,255,.1);
}
.merchant-menu { border-right: 0; padding: 10px 10px; }
.merchant-menu :deep(.el-menu-item) { height: 46px; line-height: 46px; margin: 4px 0; border-radius: 6px; }
.merchant-menu :deep(.el-menu-item.is-active) { background: rgba(22,119,255,.24) !important; font-weight: 600; }
.merchant-menu :deep(.el-menu-item:hover) { background: rgba(255,255,255,.07) !important; }
.header {
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #edf0f5;
  height: 64px;
  padding: 0 24px;
}
.header-right { display: flex; align-items: center; gap: 16px; }
.user { color: #475569; font-weight: 500; }
.main { background: var(--content-bg); padding: 24px; }
.chat-badge :deep(.el-badge__content) { top: 6px; right: -18px; min-width: 18px; height: 18px; line-height: 18px; font-weight: 700; box-shadow: 0 0 0 2px #0f1d36; }
@media (max-width: 768px) {
  .sidebar { width: 180px !important; }
  .main { padding: 16px; }
  .header { padding: 0 16px; }
}
</style>
