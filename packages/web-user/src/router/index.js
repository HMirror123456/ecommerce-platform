import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: () => import('@/layouts/UserLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: '/cart' },
        {
          path: 'cart',
          name: 'cart',
          component: () => import('@/views/CartView.vue'),
          meta: { title: '购物车' },
        },
        {
          path: 'addresses',
          name: 'addresses',
          component: () => import('@/views/AddressListView.vue'),
          meta: { title: '收货地址' },
        },
        {
          path: 'checkout',
          name: 'checkout',
          component: () => import('@/views/CheckoutView.vue'),
          meta: { title: '确认订单' },
        },
        {
          path: 'orders/:orderId/pay',
          name: 'payment',
          component: () => import('@/views/PaymentView.vue'),
          meta: { title: '订单支付' },
        },
      ],
    },
  ],
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.meta.public) {
    if (auth.isLoggedIn && to.name === 'login') {
      return to.query.redirect || '/cart';
    }
    return true;
  }
  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  return true;
});

export default router;
