<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { fetchAddresses } from '@/api/address';
import { fetchCartItems } from '@/api/cart';
import { fetchProductDetail } from '@/api/product';
import { createOrder } from '@/api/order';

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const submitting = ref(false);
const remark = ref('');
const lineItems = ref([]);
const addresses = ref([]);
const selectedAddressId = ref(null);

const selectedAddress = computed(() =>
  addresses.value.find((a) => a.id === selectedAddressId.value) || null,
);

const totalAmount = computed(() =>
  lineItems.value.reduce((sum, item) => sum + item.price * item.quantity, 0),
);

function formatPrice(value) {
  return `¥${Number(value).toFixed(2)}`;
}

function formatSpec(specJson) {
  if (!specJson || typeof specJson !== 'object') return '-';
  return Object.entries(specJson).map(([k, v]) => `${k}: ${v}`).join(' / ');
}

function formatFullAddress(addr) {
  if (!addr) return '';
  return `${addr.province}${addr.city}${addr.district}${addr.detail}`;
}

function parseCheckoutItems() {
  const stateItems = history.state?.items;
  if (Array.isArray(stateItems) && stateItems.length > 0) {
    return stateItems.map((item) => ({
      spuId: Number(item.spuId),
      skuId: Number(item.skuId),
      quantity: Math.max(1, Number(item.quantity) || 1),
    }));
  }
  const { spuId, skuId, quantity } = route.query;
  if (!spuId || !skuId) return [];
  return [{
    spuId: Number(spuId),
    skuId: Number(skuId),
    quantity: Math.max(1, Number(quantity) || 1),
  }];
}

async function loadAddresses() {
  addresses.value = await fetchAddresses();
  const defaultAddr = addresses.value.find((a) => a.isDefault);
  selectedAddressId.value = defaultAddr?.id ?? addresses.value[0]?.id ?? null;
}

async function loadFromCart() {
  const cart = await fetchCartItems();
  const valid = cart.filter((item) => item.sku?.title && item.sku.title !== '商品已下架');
  if (valid.length === 0) {
    throw new Error('购物车没有可结算商品');
  }
  lineItems.value = valid.map((item) => ({
    skuId: item.skuId,
    quantity: item.quantity,
    title: item.sku.title,
    mainImage: item.sku.mainImage,
    specJson: item.sku.specJson,
    price: item.sku.price,
    stock: item.sku.stock,
    shopName: item.sku.shopName,
  }));
}

async function loadFromDirectBuy() {
  const items = parseCheckoutItems();
  if (items.length === 0) {
    ElMessage.warning('缺少商品信息，请从商品页立即购买或购物车结算');
    lineItems.value = [];
    return;
  }
  const resolved = [];
  for (const item of items) {
    const product = await fetchProductDetail(item.spuId);
    const sku = product.skus?.find((s) => s.skuId === item.skuId);
    if (!sku) throw new Error(`SKU ${item.skuId} 不存在或未上架`);
    resolved.push({
      spuId: item.spuId,
      skuId: item.skuId,
      quantity: item.quantity,
      title: product.title,
      mainImage: product.mainImage,
      specJson: sku.specJson,
      price: sku.price,
      stock: sku.stock,
      shopName: product.shopName,
    });
  }
  lineItems.value = resolved;
}

async function loadCheckout() {
  loading.value = true;
  try {
    await loadAddresses();
    if (route.query.from === 'cart') {
      await loadFromCart();
    } else {
      await loadFromDirectBuy();
    }
  } catch (e) {
    ElMessage.error(e.message || '加载失败');
    lineItems.value = [];
  } finally {
    loading.value = false;
  }
}

async function onSubmitOrder() {
  if (lineItems.value.length === 0) {
    ElMessage.warning('没有可下单的商品');
    return;
  }
  if (!selectedAddressId.value) {
    ElMessage.warning('请选择收货地址');
    return;
  }

  submitting.value = true;
  try {
    const order = await createOrder({
      addressId: selectedAddressId.value,
      items: lineItems.value.map(({ skuId, quantity }) => ({ skuId, quantity })),
      remark: remark.value.trim() || undefined,
    });
    ElMessage.success('订单创建成功，请完成支付');
    router.push({ name: 'payment', params: { orderId: order.orderId } });
  } catch (e) {
    ElMessage.error(e.message || '下单失败');
  } finally {
    submitting.value = false;
  }
}

onMounted(loadCheckout);
</script>

<template>
  <div class="checkout-page" v-loading="loading">
    <h2 class="page-title">确认订单</h2>

    <el-card shadow="never" class="section-card">
      <template #header>
        <div class="card-header">
          <span>收货地址</span>
          <router-link to="/addresses" class="link">管理地址</router-link>
        </div>
      </template>
      <el-empty v-if="!loading && addresses.length === 0" description="暂无收货地址">
        <router-link to="/addresses"><el-button type="primary">去添加</el-button></router-link>
      </el-empty>
      <el-radio-group v-else v-model="selectedAddressId" class="address-group">
        <el-radio v-for="addr in addresses" :key="addr.id" :label="addr.id" class="address-radio">
          <div class="address-block">
            <p class="address-name">
              {{ addr.receiverName }} {{ addr.phone }}
              <el-tag v-if="addr.isDefault" size="small" type="success">默认</el-tag>
            </p>
            <p class="address-detail">{{ formatFullAddress(addr) }}</p>
          </div>
        </el-radio>
      </el-radio-group>
    </el-card>

    <el-card shadow="never" class="section-card">
      <template #header><span>商品清单</span></template>
      <el-empty v-if="!loading && lineItems.length === 0" description="暂无商品" />
      <div v-for="item in lineItems" :key="item.skuId" class="product-row">
        <img :src="item.mainImage" :alt="item.title" class="product-image" />
        <div class="product-info">
          <p class="product-title">{{ item.title }}</p>
          <p class="product-meta">{{ item.shopName }} · {{ formatSpec(item.specJson) }}</p>
          <p class="product-stock">库存 {{ item.stock }}</p>
        </div>
        <div class="product-price">{{ formatPrice(item.price) }}</div>
        <div class="product-qty">x{{ item.quantity }}</div>
        <div class="product-subtotal">{{ formatPrice(item.price * item.quantity) }}</div>
      </div>
    </el-card>

    <el-card shadow="never" class="section-card">
      <template #header><span>订单备注</span></template>
      <el-input v-model="remark" type="textarea" :rows="2" placeholder="选填：给商家留言" maxlength="200" show-word-limit />
    </el-card>

    <div class="checkout-footer">
      <div class="total">
        合计：
        <span class="total-amount">{{ formatPrice(totalAmount) }}</span>
      </div>
      <el-button
        type="primary"
        size="large"
        :loading="submitting"
        :disabled="lineItems.length === 0 || !selectedAddressId"
        @click="onSubmitOrder"
      >
        提交订单
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.checkout-page { max-width: 960px; margin: 0 auto; padding-bottom: 32px; }
.page-title { margin: 0 0 16px; font-size: 20px; }
.section-card { margin-bottom: 16px; }
.card-header { display: flex; align-items: center; justify-content: space-between; width: 100%; font-weight: 600; }
.link { font-size: 13px; font-weight: normal; color: var(--color-primary); text-decoration: none; }
.address-group { display: flex; flex-direction: column; gap: 8px; width: 100%; }
.address-radio { height: auto; margin-right: 0; align-items: flex-start; }
.address-block { line-height: 1.6; padding: 4px 0; }
.address-name { margin: 0 0 4px; font-weight: 600; }
.address-detail { margin: 0; color: var(--text-body); }
.product-row {
  display: grid;
  grid-template-columns: 80px 1fr 100px 60px 100px;
  gap: 16px;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-color);
}
.product-row:last-child { border-bottom: none; }
.product-image {
  width: 80px; height: 80px; object-fit: cover;
  border-radius: 4px; border: 1px solid var(--border-color);
}
.product-title { margin: 0 0 4px; font-weight: 600; }
.product-meta, .product-stock { margin: 0; font-size: 12px; color: var(--text-muted); }
.product-price, .product-qty, .product-subtotal { text-align: right; color: var(--text-body); }
.product-subtotal { font-weight: 600; color: var(--color-primary); }
.checkout-footer {
  display: flex; align-items: center; justify-content: flex-end; gap: 24px;
  padding: 16px 24px; background: #fff; border-radius: 8px; border: 1px solid var(--border-color);
}
.total-amount { font-size: 24px; font-weight: 700; color: var(--color-primary); }
</style>
