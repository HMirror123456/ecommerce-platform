<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { fetchProductList } from '@/api/product';

const router = useRouter();

const loading = ref(false);
const products = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(12);

function splitPrice(value) {
  const fixed = Number(value).toFixed(2);
  const [integer, decimal] = fixed.split('.');
  return { integer, decimal };
}

async function loadProducts() {
  loading.value = true;
  try {
    const data = await fetchProductList({ page: page.value, pageSize: pageSize.value });
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

function onPageChange(nextPage) {
  page.value = nextPage;
  loadProducts();
}

function goDetail(spuId) {
  router.push({ name: 'product-detail', params: { spuId } });
}

onMounted(loadProducts);
</script>

<template>
  <div class="product-list-page">
    <div class="page-header">
      <h1 class="page-title">全部商品</h1>
      <p class="page-subtitle">精选好物，品质保障</p>
    </div>

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

    <el-empty v-else-if="products.length === 0" description="暂无上架商品" />

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
  </div>
</template>

<style scoped>
.product-list-page {
  padding-bottom: 32px;
}

.page-header {
  margin-bottom: 24px;
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

.product-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

@media (max-width: 992px) {
  .product-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .product-grid {
    grid-template-columns: repeat(2, 1fr);
  }
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
  margin: 0 0 12px;
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
</style>
