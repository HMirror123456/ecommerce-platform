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
      path: '/register',
      name: 'register',
      component: () => import('@/views/RegisterView.vue'),
      meta: { public: true },
    },
    {
      path: '/',
      component: () => import('@/layouts/UserLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        { path: '', redirect: '/products' },
        {
          path: 'products',
          name: 'products',
          component: () => import('@/views/ProductListView.vue'),
          meta: { title: '商品列表' },
        },
        {
          path: 'products/:spuId',
          name: 'product-detail',
          component: () => import('@/views/ProductDetailView.vue'),
          meta: { title: '商品详情' },
        },
        {
          path: 'cart',
          name: 'cart',
          component: () => import('@/views/CartView.vue'),
          meta: { title: '购物车' },
        },
        {
          path: 'checkout',
          name: 'checkout',
          component: () => import('@/views/CheckoutView.vue'),
          meta: { title: '确认订单' },
        },
        {
          path: 'user',
          component: () => import('@/layouts/ProfileLayout.vue'),
          meta: { title: '个人中心' },
          children: [
            {
              path: '',
              name: 'profile',
              component: () => import('@/views/ProfileView.vue'),
              meta: { title: '个人信息' },
            },
            {
              path: 'orders',
              name: 'user-orders',
              component: () => import('@/views/OrderListView.vue'),
              meta: { title: '我的订单' },
            },
            {
              path: 'favorites',
              name: 'user-favorites',
              component: () => import('@/views/FavoriteListView.vue'),
              meta: { title: '我的收藏' },
            },
            {
              path: 'addresses',
              name: 'user-addresses',
              component: () => import('@/views/AddressListView.vue'),
              meta: { title: '收货地址' },
            },
            {
              path: 'chats',
              name: 'user-chats',
              component: () => import('@/views/ChatListView.vue'),
              meta: { title: '沟通会话' },
            },
          ],
        },
        // 兼容旧路径
        { path: 'orders', redirect: '/user/orders' },
        { path: 'addresses', redirect: '/user/addresses' },
        {
          path: 'orders/:orderId/pay',
          name: 'payment',
          component: () => import('@/views/PaymentView.vue'),
          meta: { title: '订单支付' },
        },
        {
          path: 'orders/:orderId',
          name: 'order-detail',
          component: () => import('@/views/OrderDetailView.vue'),
          meta: { title: '订单详情' },
        },
      ],
    },
  ],
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.meta.public) {
    if (auth.isLoggedIn && (to.name === 'login' || to.name === 'register')) {
      return to.query.redirect || '/products';
    }
    return true;
  }
  if (to.meta.requiresAuth && !auth.isLoggedIn) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  return true;
});

export default router;
