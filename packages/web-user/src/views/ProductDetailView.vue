<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { addCartItem } from '@/api/cart';
import { addFavorite, checkFavorite, removeFavorite } from '@/api/favorite';
import { fetchProductDetail } from '@/api/product';

const route = useRoute();
const router = useRouter();

const spuId = computed(() => Number(route.params.spuId));

const loading = ref(false);
const adding = ref(false);
const favoriting = ref(false);
const favorited = ref(false);
const product = ref(null);
const selectedSkuId = ref(null);
const quantity = ref(1);

const selectedSku = computed(() =>
  product.value?.skus?.find((sku) => sku.skuId === selectedSkuId.value) ?? null,
);

const maxQuantity = computed(() => selectedSku.value?.stock ?? 1);

const serviceTags = [
  { key: 'genuine', label: '正品保障' },
  { key: 'fast', label: '极速发货' },
  { key: 'return', label: '七天无理由' },
  { key: 'pay', label: '安全支付' },
];

function splitPrice(value) {
  const fixed = Number(value).toFixed(2);
  const [integer, decimal] = fixed.split('.');
  return { integer, decimal };
}

function formatSpecLabel(specJson) {
  if (!specJson || typeof specJson !== 'object') return '默认规格';
  return Object.entries(specJson)
    .map(([key, value]) => `${key}: ${value}`)
    .join(' / ');
}

function selectSku(sku) {
  if (sku.stock <= 0) {
    ElMessage.warning('该规格暂无库存');
    return;
  }
  selectedSkuId.value = sku.skuId;
  if (quantity.value > sku.stock) {
    quantity.value = sku.stock;
  }
}

function ensureSkuReady() {
  if (!selectedSku.value) {
    ElMessage.warning('请选择商品规格');
    return false;
  }
  if (selectedSku.value.stock <= 0) {
    ElMessage.warning('所选规格暂无库存');
    return false;
  }
  return true;
}

async function onAddCart() {
  if (!ensureSkuReady()) return;
  adding.value = true;
  try {
    await addCartItem(selectedSku.value.skuId, quantity.value);
    ElMessage.success('已加入购物车');
  } catch (e) {
    ElMessage.error(e.message || '加入购物车失败');
  } finally {
    adding.value = false;
  }
}

function onBuyNow() {
  if (!ensureSkuReady()) return;
  router.push({
    name: 'checkout',
    query: {
      spuId: spuId.value,
      skuId: selectedSku.value.skuId,
      quantity: quantity.value,
    },
  });
}

async function loadFavoriteState() {
  try {
    const data = await checkFavorite(spuId.value);
    favorited.value = Boolean(data.favorited);
  } catch {
    favorited.value = false;
  }
}

async function onToggleFavorite() {
  favoriting.value = true;
  try {
    if (favorited.value) {
      await removeFavorite(spuId.value);
      favorited.value = false;
      ElMessage.success('已取消收藏');
    } else {
      await addFavorite(spuId.value);
      favorited.value = true;
      ElMessage.success('已加入收藏');
    }
  } catch (e) {
    ElMessage.error(e.message || '操作失败');
  } finally {
    favoriting.value = false;
  }
}

async function loadProduct() {
  loading.value = true;
  product.value = null;
  selectedSkuId.value = null;
  quantity.value = 1;
  favorited.value = false;

  try {
    const data = await fetchProductDetail(spuId.value);
    product.value = data;
    const firstAvailable = data.skus?.find((sku) => sku.stock > 0) ?? data.skus?.[0];
    if (firstAvailable) {
      selectedSkuId.value = firstAvailable.skuId;
    }
    await loadFavoriteState();
  } catch (e) {
    ElMessage.error(e.message || '加载商品失败');
  } finally {
    loading.value = false;
  }
}

watch(maxQuantity, (max) => {
  if (quantity.value > max) quantity.value = Math.max(1, max);
});

watch(() => route.params.spuId, loadProduct);

onMounted(loadProduct);
</script>

<template>
  <div class="product-detail-page" v-loading="loading">
    <el-breadcrumb separator="/" class="breadcrumb">
      <el-breadcrumb-item :to="{ name: 'products' }">全部商品</el-breadcrumb-item>
      <el-breadcrumb-item>商品详情</el-breadcrumb-item>
    </el-breadcrumb>

    <el-empty v-if="!loading && !product" description="商品不存在或未上架">
      <el-button type="primary" @click="router.push({ name: 'products' })">返回商品列表</el-button>
    </el-empty>

    <template v-else-if="product">
      <div class="detail-main">
        <div class="detail-gallery">
          <div class="gallery-frame">
            <img
              v-if="product.mainImage"
              :src="product.mainImage"
              :alt="product.title"
              class="main-image"
            />
            <div v-else class="main-image placeholder">暂无图片</div>
          </div>
          <div class="gallery-thumbs">
            <div class="thumb active">
              <img v-if="product.mainImage" :src="product.mainImage" :alt="product.title" />
              <span v-else>图</span>
            </div>
          </div>
        </div>

        <div class="detail-info">
          <div class="title-block">
            <h1 class="product-title">{{ product.title }}</h1>
            <p class="shop-name">
              <span class="shop-badge">店铺</span>
              {{ product.shopName }}
            </p>
          </div>

          <div v-if="selectedSku" class="price-block">
            <div class="price-main">
              <span class="price-label">售价</span>
              <span class="price-symbol">¥</span>
              <span class="price-integer">{{ splitPrice(selectedSku.price).integer }}</span>
              <span class="price-decimal">.{{ splitPrice(selectedSku.price).decimal }}</span>
            </div>
            <div class="price-side">
              <span v-if="selectedSku.stock > 0" class="stock-pill">有货</span>
              <span v-else class="stock-pill out">缺货</span>
              <span class="stock-text">库存 {{ selectedSku.stock }} 件</span>
            </div>
          </div>

          <ul class="service-row">
            <li v-for="tag in serviceTags" :key="tag.key">{{ tag.label }}</li>
          </ul>

          <div class="spec-section">
            <span class="spec-label">规格</span>
            <div class="spec-options">
              <button
                v-for="sku in product.skus"
                :key="sku.skuId"
                type="button"
                class="spec-option"
                :class="{
                  active: selectedSkuId === sku.skuId,
                  disabled: sku.stock <= 0,
                }"
                @click="selectSku(sku)"
              >
                {{ formatSpecLabel(sku.specJson) }}
                <span v-if="sku.stock <= 0" class="sold-out-tag">缺货</span>
              </button>
            </div>
          </div>

          <div class="quantity-section">
            <span class="spec-label">数量</span>
            <el-input-number
              v-model="quantity"
              :min="1"
              :max="maxQuantity"
              :disabled="!selectedSku || selectedSku.stock <= 0"
            />
          </div>

          <div class="action-section">
            <el-button
              size="large"
              class="fav-btn"
              :loading="favoriting"
              :type="favorited ? 'danger' : 'default'"
              plain
              @click="onToggleFavorite"
            >
              {{ favorited ? '已收藏' : '收藏' }}
            </el-button>
            <el-button
              size="large"
              class="cart-btn"
              :loading="adding"
              :disabled="!selectedSku || selectedSku.stock <= 0"
              @click="onAddCart"
            >
              加入购物车
            </el-button>
            <el-button
              type="primary"
              size="large"
              class="buy-btn"
              :disabled="!selectedSku || selectedSku.stock <= 0"
              @click="onBuyNow"
            >
              立即购买
            </el-button>
          </div>
        </div>
      </div>

      <el-card shadow="never" class="desc-card">
        <template #header>
          <div class="desc-header">
            <span class="desc-title">商品介绍</span>
            <span class="desc-hint">图文详情</span>
          </div>
        </template>
        <p class="product-desc">{{ product.description || '暂无详细介绍' }}</p>
      </el-card>
    </template>
  </div>
</template>

<style scoped>
.product-detail-page {
  padding-bottom: 40px;
}

.breadcrumb {
  margin-bottom: 16px;
}

.detail-main {
  display: grid;
  grid-template-columns: 440px 1fr;
  gap: 36px;
  margin-bottom: 20px;
  padding: 28px;
  background: #fff;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.04);
}

@media (max-width: 900px) {
  .detail-main {
    grid-template-columns: 1fr;
    gap: 24px;
    padding: 20px;
  }
}

.detail-gallery {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.gallery-frame {
  background: linear-gradient(160deg, #fafafa 0%, #f0f0f0 100%);
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.main-image {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  display: block;
  transition: transform 0.35s ease;
}

.gallery-frame:hover .main-image {
  transform: scale(1.03);
}

.main-image.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 14px;
}

.gallery-thumbs {
  display: flex;
  gap: 8px;
}

.thumb {
  width: 64px;
  height: 64px;
  border-radius: 6px;
  border: 2px solid transparent;
  overflow: hidden;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  font-size: 12px;
}

.thumb.active {
  border-color: var(--color-primary);
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.detail-info {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
}

.title-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.product-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.4;
  color: var(--text-title);
}

.shop-name {
  margin: 0;
  font-size: 14px;
  color: var(--text-body);
  display: flex;
  align-items: center;
  gap: 8px;
}

.shop-badge {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  font-size: 12px;
  color: var(--color-primary);
  background: #fff1f0;
  border: 1px solid #ffccc7;
  border-radius: 3px;
}

.price-block {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 18px 20px;
  background: linear-gradient(90deg, #fff5f5 0%, #fff 70%);
  border-radius: 8px;
  border: 1px solid #ffe4e4;
}

.price-main {
  display: flex;
  align-items: baseline;
  color: var(--color-primary);
  font-weight: 700;
}

.price-label {
  margin-right: 10px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-muted);
}

.price-symbol {
  font-size: 16px;
  margin-right: 2px;
}

.price-integer {
  font-size: 36px;
  line-height: 1;
}

.price-decimal {
  font-size: 18px;
  line-height: 1;
}

.price-side {
  display: flex;
  align-items: center;
  gap: 10px;
}

.stock-pill {
  padding: 2px 8px;
  font-size: 12px;
  color: #389e0d;
  background: #f6ffed;
  border: 1px solid #b7eb8f;
  border-radius: 999px;
}

.stock-pill.out {
  color: var(--text-muted);
  background: #fafafa;
  border-color: var(--border-color);
}

.stock-text {
  font-size: 13px;
  color: var(--text-muted);
}

.service-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.service-row li {
  position: relative;
  padding-left: 14px;
  font-size: 13px;
  color: var(--text-body);
}

.service-row li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  width: 6px;
  height: 6px;
  margin-top: -3px;
  border-radius: 50%;
  background: var(--color-primary);
}

.spec-section,
.quantity-section {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.spec-label {
  flex-shrink: 0;
  width: 48px;
  line-height: 36px;
  color: var(--text-muted);
  font-size: 14px;
}

.spec-options {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.spec-option {
  position: relative;
  padding: 8px 16px;
  font-size: 14px;
  color: var(--text-title);
  background: #fff;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s, box-shadow 0.2s, background 0.2s;
}

.spec-option:hover:not(.disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.spec-option.active {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: #fff8f8;
  box-shadow: 0 0 0 1px var(--color-primary);
}

.spec-option.disabled {
  color: var(--text-muted);
  cursor: not-allowed;
  background: #fafafa;
}

.sold-out-tag {
  margin-left: 4px;
  font-size: 12px;
  color: var(--text-muted);
}

.action-section {
  margin-top: 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding-top: 8px;
}

.fav-btn,
.cart-btn,
.buy-btn {
  min-width: 128px;
  height: 48px;
  font-size: 16px;
  border-radius: 4px;
}

.cart-btn {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.cart-btn:hover:not(:disabled) {
  background: #fff5f5;
}

.buy-btn {
  min-width: 148px;
}

.desc-card {
  border-radius: 10px;
  border: 1px solid var(--border-color);
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.03);
}

.desc-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.desc-title {
  font-weight: 700;
  font-size: 16px;
}

.desc-hint {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 400;
}

.product-desc {
  margin: 0;
  line-height: 1.85;
  color: var(--text-body);
  white-space: pre-wrap;
}
</style>
