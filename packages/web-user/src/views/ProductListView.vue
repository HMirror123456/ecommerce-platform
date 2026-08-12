<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import {
  Box,
  Cellphone,
  CoffeeCup,
  Goods,
  Headset,
  Monitor,
  ShoppingBag,
  Sunny,
  Van,
  CircleCheck,
  Service,
  Timer,
} from '@element-plus/icons-vue';
import ProductSearchBar from '@/components/ProductSearchBar.vue';
import { fetchCategories, fetchProductList } from '@/api/product';

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const categories = ref([]);
const products = ref([]);
const hotProducts = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(12);
const activeCategoryId = ref(null);
const searchKeyword = ref('');

const CATEGORY_ICONS = [Headset, Monitor, Sunny, Goods, ShoppingBag, Cellphone, CoffeeCup, Box];

const banners = [
  {
    key: 'digital',
    title: '数码好物季',
    desc: '耳机 · 键鼠 · 外设一站购齐',
    image: 'https://picsum.photos/seed/mall-banner-digital/1200/360',
    keyword: '耳机',
  },
  {
    key: 'home',
    title: '家居生活馆',
    desc: '灯光氛围，提升日常质感',
    image: 'https://picsum.photos/seed/mall-banner-home/1200/360',
    keyword: '台灯',
  },
  {
    key: 'service',
    title: '安心购演示链路',
    desc: 'Mock 支付 · 拆单发货 · 售后可介入',
    image: 'https://picsum.photos/seed/mall-banner-service/1200/360',
    keyword: '',
  },
];

const serviceItems = [
  { icon: CircleCheck, title: '正品保障', desc: '商家上架需平台审核' },
  { icon: Van, title: '多店合单', desc: '一单多商家拆单履约' },
  { icon: Timer, title: '7 天自动确认', desc: '发货后可手动/自动收货' },
  { icon: Service, title: '售后可追溯', desc: '商家处理与平台介入' },
];

const showHomeChrome = computed(() => !searchKeyword.value);

const showHotFloor = computed(
  () => !searchKeyword.value && activeCategoryId.value == null && hotProducts.value.length > 0,
);

const categoryEntries = computed(() => {
  const list = [];
  for (const root of categories.value || []) {
    list.push({ id: root.id, name: root.name });
    for (const child of root.children || []) {
      list.push({ id: child.id, name: child.name });
    }
  }
  return list.slice(0, 8);
});

const pageTitle = computed(() => {
  if (searchKeyword.value) return `搜索「${searchKeyword.value}」`;
  if (activeCategoryId.value == null) return '全部商品';
  return findCategoryName(categories.value, activeCategoryId.value) || '商品列表';
});

function findCategoryName(nodes, id) {
  for (const node of nodes || []) {
    if (node.id === id) return node.name;
    const child = findCategoryName(node.children, id);
    if (child) return child;
  }
  return null;
}

function categoryIcon(index) {
  return CATEGORY_ICONS[index % CATEGORY_ICONS.length];
}

function splitPrice(value) {
  const fixed = Number(value).toFixed(2);
  const [integer, decimal] = fixed.split('.');
  return { integer, decimal };
}

function parseCategoryFromRoute() {
  const raw = route.query.categoryId;
  if (raw == null || raw === '') return null;
  const id = Number(raw);
  return Number.isInteger(id) ? id : null;
}

function parseKeywordFromRoute() {
  const raw = route.query.keyword ?? route.query.q;
  return raw == null ? '' : String(raw).trim();
}

function buildProductsQuery({ categoryId, keyword } = {}) {
  const query = {};
  if (categoryId != null) query.categoryId = String(categoryId);
  if (keyword) query.keyword = keyword;
  return query;
}

async function loadCategories() {
  try {
    categories.value = await fetchCategories();
  } catch (e) {
    ElMessage.error(e.message || '加载分类失败');
    categories.value = [];
  }
}

async function loadHotProducts() {
  try {
    const data = await fetchProductList({ page: 1, pageSize: 8 });
    hotProducts.value = data.list || [];
  } catch {
    hotProducts.value = [];
  }
}

async function loadProducts() {
  loading.value = true;
  try {
    const params = { page: page.value, pageSize: pageSize.value };
    if (activeCategoryId.value != null) {
      params.categoryId = activeCategoryId.value;
    }
    if (searchKeyword.value) {
      params.keyword = searchKeyword.value;
    }
    const data = await fetchProductList(params);
    products.value = data.list || [];
    total.value = data.total || 0;
  } catch (e) {
    ElMessage.error(e.message || '加载商品失败');
    products.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

function selectCategory(categoryId) {
  const nextId = categoryId == null ? null : Number(categoryId);
  page.value = 1;
  activeCategoryId.value = nextId;
  router.replace({
    name: 'products',
    query: buildProductsQuery({ categoryId: nextId, keyword: searchKeyword.value }),
  });
}

function onSearch(keyword) {
  const next = String(keyword || '').trim();
  page.value = 1;
  searchKeyword.value = next;
  router.replace({
    name: 'products',
    query: buildProductsQuery({ categoryId: activeCategoryId.value, keyword: next }),
  });
}

function onBannerClick(banner) {
  page.value = 1;
  if (banner.keyword) {
    searchKeyword.value = banner.keyword;
    activeCategoryId.value = null;
    router.replace({
      name: 'products',
      query: buildProductsQuery({ keyword: banner.keyword }),
    });
    return;
  }
  searchKeyword.value = '';
  activeCategoryId.value = null;
  router.replace({ name: 'products', query: {} });
}

function onPageChange(nextPage) {
  page.value = nextPage;
  loadProducts();
}

function goDetail(spuId) {
  router.push({ name: 'product-detail', params: { spuId } });
}

watch(
  () => [route.query.categoryId, route.query.keyword, route.query.q],
  () => {
    activeCategoryId.value = parseCategoryFromRoute();
    searchKeyword.value = parseKeywordFromRoute();
    page.value = 1;
    loadProducts();
  },
);

onMounted(async () => {
  activeCategoryId.value = parseCategoryFromRoute();
  searchKeyword.value = parseKeywordFromRoute();
  await loadCategories();
  await Promise.all([loadProducts(), loadHotProducts()]);
});
</script>

<template>
  <div class="product-list-page">
    <!-- 1. 轮播 Banner -->
    <section v-if="showHomeChrome" class="home-carousel-wrap">
      <el-carousel height="280px" :interval="4500" arrow="hover" indicator-position="outside">
        <el-carousel-item v-for="banner in banners" :key="banner.key">
          <button type="button" class="banner-slide" @click="onBannerClick(banner)">
            <img :src="banner.image" :alt="banner.title" class="banner-image" loading="lazy" />
            <div class="banner-mask">
              <p class="banner-kicker">精选活动</p>
              <h2 class="banner-title">{{ banner.title }}</h2>
              <p class="banner-desc">{{ banner.desc }}</p>
              <span class="banner-cta">去看看</span>
            </div>
          </button>
        </el-carousel-item>
      </el-carousel>
    </section>

    <!-- 2. 分类图标行 -->
    <section v-if="showHomeChrome && categoryEntries.length" class="category-icons">
      <button
        v-for="(item, index) in categoryEntries"
        :key="item.id"
        type="button"
        class="category-icon-item"
        :class="{ active: activeCategoryId === item.id }"
        @click="selectCategory(item.id)"
      >
        <span class="icon-circle">
          <el-icon :size="22"><component :is="categoryIcon(index)" /></el-icon>
        </span>
        <span class="icon-label">{{ item.name }}</span>
      </button>
    </section>

    <!-- 3. 服务保障条 -->
    <section v-if="showHomeChrome" class="service-strip">
      <div v-for="item in serviceItems" :key="item.title" class="service-item">
        <el-icon class="service-icon" :size="18"><component :is="item.icon" /></el-icon>
        <div>
          <p class="service-title">{{ item.title }}</p>
          <p class="service-desc">{{ item.desc }}</p>
        </div>
      </div>
    </section>

    <!-- 4. 热销推荐 -->
    <section v-if="showHotFloor" class="hot-floor">
      <div class="floor-header">
        <h2 class="floor-title">热销推荐</h2>
        <p class="floor-subtitle">精选上架好物，点击直达详情</p>
      </div>
      <div class="hot-grid">
        <article
          v-for="item in hotProducts"
          :key="`hot-${item.spuId}`"
          class="product-card hot-card"
          @click="goDetail(item.spuId)"
        >
          <div class="product-image-wrap">
            <img :src="item.mainImage" :alt="item.title" class="product-image" loading="lazy" />
            <span class="hot-badge">热销</span>
          </div>
          <div class="product-body">
            <h3 class="product-title">{{ item.title }}</h3>
            <div class="product-price">
              <span class="price-symbol">¥</span>
              <span class="price-integer">{{ splitPrice(item.minPrice).integer }}</span>
              <span class="price-decimal">.{{ splitPrice(item.minPrice).decimal }}</span>
              <span class="price-suffix">起</span>
            </div>
          </div>
        </article>
      </div>
    </section>

    <div class="page-header">
      <div class="header-top">
        <div>
          <h1 class="page-title">{{ pageTitle }}</h1>
          <p class="page-subtitle">
            {{ searchKeyword ? '根据关键词筛选上架商品' : '左侧选分类，顶栏可随时搜索' }}
          </p>
        </div>
        <ProductSearchBar v-model="searchKeyword" @search="onSearch" />
      </div>
    </div>

    <div class="content-layout">
      <aside class="category-panel">
        <h2 class="category-title">商品分类</h2>
        <button
          type="button"
          class="category-item root"
          :class="{ active: activeCategoryId == null }"
          @click="selectCategory(null)"
        >
          全部商品
        </button>
        <div v-for="root in categories" :key="root.id" class="category-group">
          <button
            type="button"
            class="category-item root"
            :class="{ active: activeCategoryId === root.id }"
            @click="selectCategory(root.id)"
          >
            {{ root.name }}
          </button>
          <button
            v-for="child in root.children || []"
            :key="child.id"
            type="button"
            class="category-item child"
            :class="{ active: activeCategoryId === child.id }"
            @click="selectCategory(child.id)"
          >
            {{ child.name }}
          </button>
        </div>
      </aside>

      <section class="product-panel">
        <div v-if="loading" class="product-grid">
          <div v-for="n in 8" :key="n" class="product-card skeleton-card">
            <el-skeleton animated>
              <template #template>
                <el-skeleton-item variant="image" class="skeleton-image" />
                <div class="skeleton-body">
                  <el-skeleton-item variant="h3" />
                  <el-skeleton-item variant="text" style="width: 60%" />
                </div>
              </template>
            </el-skeleton>
          </div>
        </div>

        <el-empty
          v-else-if="products.length === 0"
          :description="searchKeyword ? '没有找到相关商品' : '该分类下暂无上架商品'"
        />

        <div v-else class="product-grid">
          <article
            v-for="item in products"
            :key="item.spuId"
            class="product-card"
            @click="goDetail(item.spuId)"
          >
            <div class="product-image-wrap">
              <img :src="item.mainImage" :alt="item.title" class="product-image" loading="lazy" />
            </div>
            <div class="product-body">
              <h3 class="product-title">{{ item.title }}</h3>
              <p v-if="item.categoryName" class="product-category">{{ item.categoryName }}</p>
              <div class="product-price">
                <span class="price-symbol">¥</span>
                <span class="price-integer">{{ splitPrice(item.minPrice).integer }}</span>
                <span class="price-decimal">.{{ splitPrice(item.minPrice).decimal }}</span>
                <span class="price-suffix">起</span>
              </div>
            </div>
          </article>
        </div>

        <div v-if="total > pageSize" class="pagination-wrap">
          <el-pagination
            v-model:current-page="page"
            :page-size="pageSize"
            :total="total"
            layout="prev, pager, next, total"
            background
            @current-change="onPageChange"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.product-list-page {
  padding-bottom: 32px;
}

.home-carousel-wrap {
  margin-bottom: 16px;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  border: 1px solid var(--border-color);
}

.banner-slide {
  position: relative;
  display: block;
  width: 100%;
  height: 280px;
  padding: 0;
  border: none;
  cursor: pointer;
  text-align: left;
  overflow: hidden;
  background: #f5f5f5;
}

.banner-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transform: scale(1.02);
  transition: transform 0.45s ease;
}

.banner-slide:hover .banner-image {
  transform: scale(1.06);
}

.banner-mask {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 32px 40px;
  background: linear-gradient(90deg, rgba(0, 0, 0, 0.55) 0%, rgba(0, 0, 0, 0.2) 55%, transparent 100%);
  color: #fff;
}

.banner-kicker {
  margin: 0 0 8px;
  font-size: 12px;
  letter-spacing: 0.06em;
  opacity: 0.9;
}

.banner-title {
  margin: 0 0 8px;
  font-size: 30px;
  font-weight: 700;
  line-height: 1.25;
}

.banner-desc {
  margin: 0 0 16px;
  font-size: 14px;
  opacity: 0.92;
}

.banner-cta {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 8px 16px;
  border-radius: 4px;
  background: var(--color-primary);
  font-size: 13px;
  font-weight: 600;
}

.category-icons {
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 16px;
  padding: 16px 12px;
  background: #fff;
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

.category-icon-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  border: none;
  background: transparent;
  cursor: pointer;
  padding: 8px 4px;
  border-radius: 8px;
  transition: background 0.15s;
}

.category-icon-item:hover,
.category-icon-item.active {
  background: #fff1f0;
}

.icon-circle {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff1f0;
  color: var(--color-primary);
}

.category-icon-item.active .icon-circle {
  background: var(--color-primary);
  color: #fff;
}

.icon-label {
  font-size: 12px;
  color: var(--text-body);
  line-height: 1.3;
  text-align: center;
}

.service-strip {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 20px;
  padding: 14px 16px;
  background: #fff;
  border: 1px solid var(--border-color);
  border-radius: 8px;
}

.service-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}

.service-icon {
  color: var(--color-primary);
  margin-top: 2px;
  flex-shrink: 0;
}

.service-title {
  margin: 0 0 2px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-title);
}

.service-desc {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
}

.hot-floor {
  margin-bottom: 24px;
}

.floor-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 12px;
}

.floor-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: var(--text-title);
}

.floor-subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}

.hot-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.hot-card .product-image-wrap {
  position: relative;
}

.hot-badge {
  position: absolute;
  left: 0;
  top: 0;
  padding: 2px 8px;
  font-size: 12px;
  color: #fff;
  background: var(--color-primary);
  border-radius: 0 0 8px 0;
}

.page-header {
  margin-bottom: 24px;
}

.header-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.page-title {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 700;
  color: var(--text-title);
}

.page-subtitle {
  margin: 0;
  font-size: 14px;
  color: var(--text-muted);
}

.content-layout {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 20px;
  align-items: start;
}

.category-panel {
  background: #fff;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px 12px;
  position: sticky;
  top: 16px;
}

.category-title {
  margin: 0 8px 12px;
  font-size: 16px;
  font-weight: 700;
}

.category-group {
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px solid var(--border-color);
}

.category-item {
  display: block;
  width: 100%;
  border: none;
  background: transparent;
  text-align: left;
  padding: 10px 12px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-body);
  font-size: 14px;
  transition: background 0.15s, color 0.15s;
}

.category-item.root {
  font-weight: 600;
  color: var(--text-title);
}

.category-item.child {
  padding-left: 28px;
  font-size: 13px;
}

.category-item:hover,
.category-item.active {
  background: #fff1f0;
  color: var(--color-primary);
  font-weight: 600;
}

.product-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.product-card {
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: box-shadow 0.2s, transform 0.2s;
}

.product-card:hover {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
}

.skeleton-card {
  cursor: default;
  padding: 0;
}

.skeleton-card:hover {
  box-shadow: none;
  transform: none;
}

.skeleton-image {
  width: 100%;
  height: 220px;
}

.skeleton-body {
  padding: 12px 16px 16px;
}

.product-image-wrap {
  aspect-ratio: 1;
  background: #fafafa;
  overflow: hidden;
}

.product-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.3s;
}

.product-card:hover .product-image {
  transform: scale(1.05);
}

.product-body {
  padding: 12px 16px 16px;
}

.product-title {
  margin: 0 0 6px;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.5;
  color: var(--text-title);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 42px;
}

.product-category {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--text-muted);
}

.product-price {
  display: flex;
  align-items: baseline;
  color: var(--color-primary);
  font-weight: 700;
}

.price-symbol {
  font-size: 14px;
  margin-right: 2px;
}

.price-integer {
  font-size: 22px;
  line-height: 1;
}

.price-decimal {
  font-size: 14px;
  line-height: 1;
}

.price-suffix {
  margin-left: 4px;
  font-size: 12px;
  font-weight: 400;
  color: var(--text-muted);
}

.pagination-wrap {
  display: flex;
  justify-content: center;
  margin-top: 32px;
}

@media (max-width: 992px) {
  .hot-grid,
  .product-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .category-icons {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .service-strip {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .content-layout {
    grid-template-columns: 1fr;
  }

  .banner-slide,
  .home-carousel-wrap :deep(.el-carousel),
  .home-carousel-wrap :deep(.el-carousel__container) {
    height: 200px !important;
  }

  .banner-mask {
    padding: 20px;
  }

  .banner-title {
    font-size: 22px;
  }

  .category-icons {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .service-strip {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
