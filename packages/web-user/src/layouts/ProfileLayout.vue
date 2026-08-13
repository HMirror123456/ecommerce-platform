<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import {
  ChatDotRound,
  Goods,
  Location,
  ShoppingBag,
  User,
} from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const auth = useAuthStore();

const menus = [
  { name: 'profile', label: '个人信息', path: '/user', icon: User },
  { name: 'user-orders', label: '我的订单', path: '/user/orders', icon: ShoppingBag },
  { name: 'user-favorites', label: '我的收藏', path: '/user/favorites', icon: Goods },
  { name: 'user-chats', label: '售后会话', path: '/user/chats', icon: ChatDotRound },
  { name: 'user-addresses', label: '收货地址', path: '/user/addresses', icon: Location },
];

const orderShortcuts = [
  { label: '待支付', status: 'PENDING_PAYMENT' },
  { label: '待发货', status: 'PENDING_SHIPMENT' },
  { label: '待收货', status: 'SHIPPED' },
  { label: '已完成', status: 'COMPLETED' },
];

const activePath = computed(() => {
  if (route.path.startsWith('/user/orders')) return '/user/orders';
  if (route.path.startsWith('/user/favorites')) return '/user/favorites';
  if (route.path.startsWith('/user/chats')) return '/user/chats';
  if (route.path.startsWith('/user/addresses')) return '/user/addresses';
  return '/user';
});

const displayName = computed(() => auth.nickname || auth.phone || '用户');
</script>

<template>
  <div class="profile-layout">
    <aside class="side">
      <div class="user-card">
        <div class="avatar">
          <img v-if="auth.avatarUrl" :src="auth.avatarUrl" alt="" class="avatar-img" />
          <span v-else>{{ displayName.slice(0, 1) }}</span>
        </div>
        <div class="meta">
          <p class="name">{{ displayName }}</p>
          <p class="phone">{{ auth.phone || '未绑定手机号' }}</p>
        </div>
      </div>

      <div class="shortcut-block">
        <p class="shortcut-title">订单快捷</p>
        <div class="shortcut-grid">
          <router-link
            v-for="item in orderShortcuts"
            :key="item.status"
            :to="{ path: '/user/orders', query: { status: item.status } }"
            class="shortcut-item"
          >
            {{ item.label }}
          </router-link>
        </div>
      </div>

      <nav class="menu">
        <router-link
          v-for="item in menus"
          :key="item.path"
          :to="item.path"
          class="menu-item"
          :class="{ active: activePath === item.path }"
        >
          <el-icon class="menu-icon"><component :is="item.icon" /></el-icon>
          <span>{{ item.label }}</span>
        </router-link>
      </nav>
    </aside>
    <section class="main-panel">
      <router-view />
    </section>
  </div>
</template>

<style scoped>
.profile-layout {
  display: grid;
  grid-template-columns: 248px 1fr;
  gap: 20px;
  align-items: start;
  padding-bottom: 24px;
}

@media (max-width: 768px) {
  .profile-layout {
    grid-template-columns: 1fr;
  }

  .side {
    position: static;
  }
}

.side {
  background: #fff;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 0 0 12px;
  position: sticky;
  top: 16px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
}

.user-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 16px;
  background:
    radial-gradient(circle at 85% 20%, rgba(255, 255, 255, 0.22), transparent 40%),
    linear-gradient(135deg, #e4393c 0%, #c81623 100%);
  color: #fff;
}

.avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 700;
  flex-shrink: 0;
  overflow: hidden;
  border: 2px solid rgba(255, 255, 255, 0.65);
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.name {
  margin: 0 0 4px;
  font-weight: 700;
  font-size: 16px;
}

.phone {
  margin: 0;
  font-size: 12px;
  opacity: 0.88;
}

.shortcut-block {
  padding: 14px 12px 8px;
  border-bottom: 1px solid var(--border-color);
}

.shortcut-title {
  margin: 0 0 10px 4px;
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 600;
}

.shortcut-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 10px 6px;
  border-radius: 8px;
  background: #fafafa;
  border: 1px solid var(--border-color);
  color: var(--text-body);
  font-size: 12px;
  text-decoration: none;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.shortcut-item:hover {
  background: #fff1f0;
  border-color: #ffccc7;
  color: var(--color-primary);
  font-weight: 600;
}

.menu {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 11px 12px;
  border-radius: 8px;
  color: var(--text-body);
  text-decoration: none;
  transition: background 0.15s, color 0.15s;
}

.menu-icon {
  font-size: 16px;
}

.menu-item:hover,
.menu-item.active {
  background: #fff1f0;
  color: var(--color-primary);
  font-weight: 600;
}

.main-panel {
  min-width: 0;
  background: #fff;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.03);
}
</style>
