<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { deleteCartItem, fetchCartItems, updateCartItem } from '@/api/cart';

const router = useRouter();
const loading = ref(false);
const items = ref([]);
const updatingId = ref(null);

const totalAmount = computed(() =>
  items.value.reduce((sum, item) => sum + (item.sku?.price || 0) * item.quantity, 0),
);

const validItems = computed(() =>
  items.value.filter((item) => item.sku?.title && item.sku.title !== '商品已下架'),
);

function formatPrice(value) {
  return `¥${Number(value || 0).toFixed(2)}`;
}

function formatSpec(specJson) {
  if (!specJson || typeof specJson !== 'object') return '-';
  return Object.entries(specJson).map(([k, v]) => `${k}: ${v}`).join(' / ');
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
  if (!row?.itemId || updatingId.value) return;
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

onMounted(loadCart);
</script>

<template>
  <div class="cart-page" v-loading="loading">
    <h2 class="page-title">购物车</h2>

    <el-card shadow="never">
      <el-empty v-if="!loading && items.length === 0" description="购物车是空的">
        <el-button type="primary" @click="router.push({ name: 'products' })">去逛逛</el-button>
      </el-empty>

      <el-table v-else :data="items" stripe>
        <el-table-column label="商品" min-width="280">
          <template #default="{ row }">
            <div class="product-cell">
              <img v-if="row.sku?.mainImage" :src="row.sku.mainImage" class="thumb" alt="" />
              <div>
                <p class="title">{{ row.sku?.title || '-' }}</p>
                <p class="meta">{{ row.sku?.shopName }} · {{ formatSpec(row.sku?.specJson) }}</p>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="单价" width="100">
          <template #default="{ row }">{{ formatPrice(row.sku?.price) }}</template>
        </el-table-column>
        <el-table-column label="数量" width="150">
          <template #default="{ row }">
            <el-input-number
              :model-value="row.quantity"
              :min="1"
              :max="Math.max(1, row.sku?.stock || 1)"
              :disabled="updatingId === row.itemId || row.sku?.title === '商品已下架'"
              @change="(val) => onQuantityChange(row, val)"
            />
          </template>
        </el-table-column>
        <el-table-column label="小计" width="100">
          <template #default="{ row }">{{ formatPrice((row.sku?.price || 0) * row.quantity) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="80">
          <template #default="{ row }">
            <el-button link type="danger" @click="onRemove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="items.length > 0" class="footer">
        <div class="total">合计：<span>{{ formatPrice(totalAmount) }}</span></div>
        <el-button type="primary" size="large" @click="goCheckout">去结算</el-button>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.page-title { margin: 0 0 16px; font-size: 20px; }
.product-cell { display: flex; gap: 12px; align-items: center; }
.thumb { width: 64px; height: 64px; object-fit: cover; border-radius: 4px; border: 1px solid var(--border-color); }
.title { margin: 0 0 4px; font-weight: 600; }
.meta { margin: 0; font-size: 12px; color: var(--text-muted); }
.footer {
  margin-top: 16px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 24px;
}
.total span { font-size: 22px; font-weight: 700; color: var(--color-primary); }
</style>
