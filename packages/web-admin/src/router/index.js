import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { public: true } },
    {
      path: '/',
      component: () => import('@/layouts/AdminLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: '/dashboard' },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/views/DashboardView.vue'),
          meta: { title: '工作台' },
        },
        {
          path: 'admins',
          name: 'admins',
          component: () => import('@/views/AdminAccountListView.vue'),
          meta: { requiresSuperAdmin: true, title: '管理员账号' },
        },
        {
          path: 'audit/products',
          name: 'product-audit',
          component: () => import('@/views/ProductAuditView.vue'),
          meta: { requiresOperator: true, title: '商品审核' },
        },
        {
          path: 'audit/merchants',
          name: 'merchant-audit',
          component: () => import('@/views/MerchantAuditView.vue'),
          meta: { requiresOperator: true, title: '商家审核' },
        },
        {
          path: 'after-sales',
          name: 'after-sales',
          component: () => import('@/views/AfterSaleListView.vue'),
          meta: { requiresCsAgent: true, title: '售后仲裁' },
        },
        {
          path: 'orders',
          name: 'order-list',
          component: () => import('@/views/OrderListView.vue'),
          meta: { title: '订单查询' },
        },
      ],
    },
  ],
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.meta.public) {
    if (auth.isLoggedIn && to.name === 'login') return '/dashboard';
    return true;
  }
  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  if (to.meta.requiresSuperAdmin && !auth.canManageAdmins) {
    return '/dashboard';
  }
  if (to.meta.requiresOperator && !auth.isOperator) {
    return '/dashboard';
  }
  if (to.meta.requiresCsAgent && !auth.isCsAgent) {
    return '/dashboard';
  }
  return true;
});

export default router;
