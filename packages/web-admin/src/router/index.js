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
        { path: '', redirect: '/audit/products' },
        {
          path: 'audit/products',
          name: 'product-audit',
          component: () => import('@/views/ProductAuditView.vue'),
          meta: { requiresOperator: true, title: '商品审核' },
        },
      ],
    },
  ],
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.meta.public) {
    if (auth.isLoggedIn && to.name === 'login') return '/audit/products';
    return true;
  }
  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  if (to.meta.requiresOperator && !auth.isOperator) {
    return { name: 'login', query: { reason: 'forbidden' } };
  }
  return true;
});

export default router;
