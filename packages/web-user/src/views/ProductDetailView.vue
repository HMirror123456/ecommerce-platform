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
          <img :src="product.mainImage" :alt="product.title" class="main-image" />
        </div>

        <div class="detail-info">
          <h1 class="product-title">{{ product.title }}</h1>
          <p class="shop-name">{{ product.shopName }}</p>

          <div v-if="selectedSku" class="price-block">
            <span class="price-symbol">¥</span>
            <span class="price-integer">{{ splitPrice(selectedSku.price).integer }}</span>
            <span class="price-decimal">.{{ splitPrice(selectedSku.price).decimal }}</span>
          </div>

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
            <span v-if="selectedSku" class="stock-hint">库存 {{ selectedSku.stock }} 件</span>
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
        <template #header><span>商品介绍</span></template>
        <p class="product-desc">{{ product.description || '暂无详细介绍' }}</p>
      </el-card>
    </template>
  </div>
</template>

<style scoped>
.product-detail-page {
  padding-bottom: 32px;
}

.breadcrumb {
  margin-bottom: 24px;
}

.detail-main {
  display: grid;
  grid-template-columns: 420px 1fr;
  gap: 32px;
  margin-bottom: 24px;
  padding: 24px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

@media (max-width: 768px) {
  .detail-main {
    grid-template-columns: 1fr;
  }
}

.detail-gallery {
  background: #fafafa;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border-color);
}

.main-image {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  display: block;
}

.detail-info {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.product-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  line-height: 1.4;
  color: var(--text-title);
}

.shop-name {
  margin: 0;
  font-size: 14px;
  color: var(--text-muted);
}

.price-block {
  display: flex;
  align-items: baseline;
  padding: 16px;
  background: #fff5f5;
  border-radius: 8px;
  color: var(--color-primary);
  font-weight: 700;
}

.price-symbol {
  font-size: 16px;
  margin-right: 4px;
}

.price-integer {
  font-size: 32px;
  line-height: 1;
}

.price-decimal {
  font-size: 18px;
  line-height: 1;
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
  line-height: 32px;
  color: var(--text-muted);
  font-size: 14px;
}

.spec-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
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
  transition: border-color 0.2s, color 0.2s;
}

.spec-option:hover:not(.disabled) {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.spec-option.active {
  border-color: var(--color-primary);
  color: var(--color-primary);
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

.stock-hint {
  margin-left: 12px;
  font-size: 13px;
  color: var(--text-muted);
  line-height: 32px;
}

.action-section {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.fav-btn,
.cart-btn,
.buy-btn {
  min-width: 120px;
  height: 48px;
  font-size: 16px;
  border-radius: 4px;
}

.desc-card {
  border-radius: 8px;
}

.product-desc {
  margin: 0;
  line-height: 1.8;
  color: var(--text-body);
  white-space: pre-wrap;
}
</style>
