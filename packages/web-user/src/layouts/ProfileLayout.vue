<script setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const auth = useAuthStore();

const menus = [
  { name: 'profile', label: '个人信息', path: '/user' },
  { name: 'user-orders', label: '我的订单', path: '/user/orders' },
  { name: 'user-favorites', label: '我的收藏', path: '/user/favorites' },
  { name: 'user-chats', label: '售后会话', path: '/user/chats' },
  { name: 'user-addresses', label: '收货地址', path: '/user/addresses' },
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
          <p class="phone">{{ auth.phone }}</p>
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
          {{ item.label }}
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
  grid-template-columns: 240px 1fr;
  gap: 20px;
  align-items: start;
  padding-bottom: 24px;
}

@media (max-width: 768px) {
  .profile-layout {
    grid-template-columns: 1fr;
  }
}

.side {
  background: #fff;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
  position: sticky;
  top: 16px;
}

.user-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-bottom: 16px;
  margin-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #fff1f0;
  color: var(--color-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
  flex-shrink: 0;
  overflow: hidden;
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
  color: var(--text-title);
}

.phone {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}

.menu {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.menu-item {
  display: block;
  padding: 10px 12px;
  border-radius: 4px;
  color: var(--text-body);
  text-decoration: none;
  transition: background 0.15s, color 0.15s;
}

.menu-item:hover,
.menu-item.active {
  background: #fff1f0;
  color: var(--color-primary);
  font-weight: 600;
}

.main-panel {
  min-width: 0;
}
</style>
