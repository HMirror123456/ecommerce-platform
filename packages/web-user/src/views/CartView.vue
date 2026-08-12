<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import ProductSearchBar from '@/components/ProductSearchBar.vue';
import { deleteCartItem, fetchCartItems, updateCartItem } from '@/api/cart';

const router = useRouter();
const loading = ref(false);
const items = ref([]);
const updatingId = ref(null);
const searchKeyword = ref('');
const appliedKeyword = ref('');

const filteredItems = computed(() => {
  const kw = appliedKeyword.value.trim().toLowerCase();
  if (!kw) return items.value;
  return items.value.filter((item) => {
    const title = String(item.sku?.title || '').toLowerCase();
    const shop = String(item.sku?.shopName || '').toLowerCase();
    return title.includes(kw) || shop.includes(kw);
  });
});

const validItems = computed(() =>
  filteredItems.value.filter((item) => item.sku?.title && item.sku.title !== '商品已下架'),
);

const invalidCount = computed(() => filteredItems.value.length - validItems.value.length);

const totalAmount = computed(() =>
  validItems.value.reduce((sum, item) => sum + (item.sku?.price || 0) * item.quantity, 0),
);

function isInvalid(row) {
  return !row.sku?.title || row.sku.title === '商品已下架';
}

function formatPrice(value) {
  return `¥${Number(value || 0).toFixed(2)}`;
}

function formatSpec(specJson) {
  if (!specJson || typeof specJson !== 'object') return '-';
  return Object.entries(specJson)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' / ');
}

async function loadCart() {
  loading.value = true;
  try {
    items.value = await fetchCartItems();
  } catch (e) {
    ElMessage.error(e.message || '加载购物车失败');
    items.value = [];
  } finally {
    loading.value = false;
  }
}

async function onQuantityChange(row, value) {
  if (!row?.itemId || updatingId.value || value == null) return;
  updatingId.value = row.itemId;
  try {
    await updateCartItem(row.itemId, value);
    await loadCart();
  } catch (e) {
    ElMessage.error(e.message || '更新数量失败');
    await loadCart();
  } finally {
    updatingId.value = null;
  }
}

async function onRemove(row) {
  try {
    await ElMessageBox.confirm('确认删除该商品？', '提示', { type: 'warning' });
    await deleteCartItem(row.itemId);
    ElMessage.success('已删除');
    await loadCart();
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e.message || '删除失败');
  }
}

function goCheckout() {
  if (validItems.value.length === 0) {
    ElMessage.warning('购物车没有可结算商品');
    return;
  }
  router.push({ name: 'checkout', query: { from: 'cart' } });
}

function onSearch(keyword) {
  const next = String(keyword || '').trim();
  searchKeyword.value = next;
  appliedKeyword.value = next;
}

onMounted(loadCart);
</script>

<template>
  <div class="cart-page">
    <div class="cart-toolbar">
      <ProductSearchBar
        v-model="searchKeyword"
        placeholder="在购物车中搜索商品"
        @search="onSearch"
      />
    </div>

    <div class="cart-body" v-loading="loading">
      <div v-if="!loading && items.length === 0" class="empty-tip">
        <p class="empty-text">购物车是空的，去挑几件喜欢的商品吧</p>
        <el-button type="primary" @click="router.push({ name: 'products' })">去逛逛</el-button>
      </div>

      <div v-else-if="!loading && filteredItems.length === 0" class="empty-tip compact">
        <p class="empty-text">没有找到匹配「{{ appliedKeyword }}」的购物车商品</p>
        <el-button @click="onSearch('')">清空搜索</el-button>
      </div>

      <template v-else-if="filteredItems.length > 0">
        <p class="page-subtitle">
          共 {{ filteredItems.length }} 件
          <template v-if="appliedKeyword">（关键词「{{ appliedKeyword }}」）</template>
          <template v-if="invalidCount > 0">（含 {{ invalidCount }} 件失效）</template>
        </p>

        <el-card shadow="never" class="cart-card">
          <div class="cart-header">
            <span class="col-product">商品信息</span>
            <span class="col-price">单价</span>
            <span class="col-qty">数量</span>
            <span class="col-subtotal">小计</span>
            <span class="col-action">操作</span>
          </div>

          <div
            v-for="row in filteredItems"
            :key="row.itemId"
            class="cart-row"
            :class="{ invalid: isInvalid(row) }"
          >
            <div class="col-product product-cell">
              <div class="thumb-wrap">
                <img
                  v-if="row.sku?.mainImage"
                  :src="row.sku.mainImage"
                  class="thumb"
                  :alt="row.sku?.title || ''"
                />
                <div v-else class="thumb placeholder">无图</div>
                <span v-if="isInvalid(row)" class="invalid-badge">失效</span>
              </div>
              <div class="product-text">
                <p class="title">{{ row.sku?.title || '-' }}</p>
                <p class="meta">
                  <span v-if="row.sku?.shopName">{{ row.sku.shopName }} · </span>
                  {{ formatSpec(row.sku?.specJson) }}
                </p>
                <p v-if="!isInvalid(row)" class="stock">库存 {{ row.sku?.stock ?? 0 }} 件</p>
              </div>
            </div>

            <div class="col-price">
              <span class="cell-label">单价</span>
              {{ isInvalid(row) ? '-' : formatPrice(row.sku?.price) }}
            </div>

            <div class="col-qty">
              <span class="cell-label">数量</span>
              <el-input-number
                :model-value="row.quantity"
                :min="1"
                :max="Math.max(1, row.sku?.stock || 1)"
                size="small"
                :disabled="updatingId === row.itemId || isInvalid(row)"
                @change="(val) => onQuantityChange(row, val)"
              />
            </div>

            <div class="col-subtotal">
              <span class="cell-label">小计</span>
              <span class="subtotal-value">
                {{ isInvalid(row) ? '-' : formatPrice((row.sku?.price || 0) * row.quantity) }}
              </span>
            </div>

            <div class="col-action">
              <el-button link type="danger" @click="onRemove(row)">删除</el-button>
            </div>
          </div>
        </el-card>

        <div class="cart-footer">
          <div class="footer-left">
            <el-button link type="primary" @click="router.push({ name: 'products' })">
              继续购物
            </el-button>
            <span class="footer-hint">已选 {{ validItems.length }} 件可结算商品</span>
          </div>
          <div class="footer-right">
            <div class="total">
              合计：
              <span class="total-amount">{{ formatPrice(totalAmount) }}</span>
            </div>
            <el-button
              type="primary"
              size="large"
              :disabled="validItems.length === 0"
              @click="goCheckout"
            >
              去结算
            </el-button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.cart-page {
  width: 100%;
  padding-bottom: 32px;
}

.cart-toolbar {
  margin-bottom: 16px;
  display: flex;
  justify-content: flex-end;
}

.cart-body {
  width: 100%;
  min-height: 160px;
}

.page-subtitle {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--text-muted);
  text-align: left;
}

.empty-tip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  min-height: calc(100vh - 220px);
  padding: 24px;
}

.empty-tip.compact {
  min-height: 240px;
}

.empty-text {
  margin: 0 0 16px;
  font-size: 14px;
  color: var(--text-muted);
}

.cart-card {
  margin-bottom: 16px;
  border: 1px solid var(--border-color);
}

.cart-card :deep(.el-card__body) {
  padding: 0 20px;
}

.cart-header,
.cart-row {
  display: grid;
  grid-template-columns: minmax(280px, 1fr) 110px 140px 110px 72px;
  gap: 12px;
  align-items: center;
}

.cart-header {
  padding: 14px 0;
  border-bottom: 1px solid var(--border-color);
  font-size: 13px;
  color: var(--text-muted);
  font-weight: 500;
}

.cart-row {
  padding: 16px 0;
  border-bottom: 1px solid var(--border-color);
}

.cart-row:last-child {
  border-bottom: none;
}

.cart-row.invalid {
  opacity: 0.72;
  background: #fafafa;
  margin: 0 -20px;
  padding-left: 20px;
  padding-right: 20px;
}

.col-price,
.col-qty,
.col-subtotal,
.col-action {
  text-align: center;
}

.col-subtotal,
.col-action {
  text-align: right;
}

.product-cell {
  display: flex;
  gap: 12px;
  align-items: center;
  min-width: 0;
}

.thumb-wrap {
  position: relative;
  flex-shrink: 0;
  width: 80px;
  height: 80px;
}

.thumb {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid var(--border-color);
  display: block;
}

.thumb.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  color: var(--text-muted);
  font-size: 12px;
}

.invalid-badge {
  position: absolute;
  left: 0;
  top: 0;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 12px;
  padding: 1px 6px;
  border-radius: 4px 0 4px 0;
}

.product-text {
  min-width: 0;
}

.title {
  margin: 0 0 6px;
  font-weight: 600;
  color: var(--text-title);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.meta,
.stock {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
}

.subtotal-value {
  font-weight: 700;
  color: var(--color-primary);
}

.cell-label {
  display: none;
}

.cart-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 16px 24px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid var(--border-color);
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.footer-hint {
  font-size: 13px;
  color: var(--text-muted);
}

.footer-right {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-left: auto;
}

.total {
  color: var(--text-body);
}

.total-amount {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-primary);
}

@media (max-width: 768px) {
  .cart-header {
    display: none;
  }

  .cart-row {
    grid-template-columns: 1fr;
    gap: 10px;
    align-items: stretch;
  }

  .col-price,
  .col-qty,
  .col-subtotal,
  .col-action {
    display: flex;
    align-items: center;
    justify-content: space-between;
    text-align: left;
  }

  .cell-label {
    display: inline;
    color: var(--text-muted);
    font-size: 13px;
  }

  .cart-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .footer-right {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
