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

const totalQuantity = computed(() =>
  lineItems.value.reduce((sum, item) => sum + item.quantity, 0),
);

function formatPrice(value) {
  return `¥${Number(value).toFixed(2)}`;
}

function splitPrice(value) {
  const fixed = Number(value).toFixed(2);
  const [integer, decimal] = fixed.split('.');
  return { integer, decimal };
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
  const rawIds = String(route.query.itemIds || '')
    .split(',')
    .map((id) => Number(id))
    .filter((id) => Number.isInteger(id) && id > 0);
  const selected = rawIds.length
    ? valid.filter((item) => rawIds.includes(item.itemId))
    : valid;
  if (selected.length === 0) {
    throw new Error(rawIds.length ? '所选商品不可结算，请返回购物车重新勾选' : '购物车没有可结算商品');
  }
  lineItems.value = selected.map((item) => ({
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
    <div class="page-header">
      <h2 class="page-title">确认订单</h2>
      <p class="page-sub">核对收货信息与商品后提交</p>
    </div>

    <el-card shadow="never" class="section-card">
      <template #header>
        <div class="card-header">
          <span class="card-title">收货地址</span>
          <router-link to="/user/addresses" class="link">管理地址</router-link>
        </div>
      </template>
      <el-empty v-if="!loading && addresses.length === 0" description="暂无收货地址">
        <router-link to="/user/addresses"><el-button type="primary">去添加</el-button></router-link>
      </el-empty>
      <div v-else class="address-grid">
        <button
          v-for="addr in addresses"
          :key="addr.id"
          type="button"
          class="address-card"
          :class="{ active: selectedAddressId === addr.id }"
          @click="selectedAddressId = addr.id"
        >
          <div class="address-top">
            <p class="address-name">
              {{ addr.receiverName }}
              <span class="phone">{{ addr.phone }}</span>
            </p>
            <el-tag v-if="addr.isDefault" size="small" type="danger" effect="plain">默认</el-tag>
          </div>
          <p class="address-detail">{{ formatFullAddress(addr) }}</p>
          <span class="address-check" />
        </button>
      </div>
    </el-card>

    <el-card shadow="never" class="section-card">
      <template #header><span class="card-title">商品清单</span></template>
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
      <template #header><span class="card-title">订单备注</span></template>
      <el-input
        v-model="remark"
        type="textarea"
        :rows="2"
        placeholder="选填：给商家留言"
        maxlength="200"
        show-word-limit
      />
      <p v-if="selectedAddress" class="ship-hint">
        将送达：{{ selectedAddress.receiverName }} · {{ formatFullAddress(selectedAddress) }}
      </p>
    </el-card>

    <div class="checkout-footer">
      <div class="footer-meta">
        <span>共 {{ totalQuantity }} 件</span>
        <div class="total">
          合计：
          <span class="total-amount">
            <i>¥</i>{{ splitPrice(totalAmount).integer }}.{{ splitPrice(totalAmount).decimal }}
          </span>
        </div>
      </div>
      <el-button
        type="primary"
        size="large"
        class="submit-btn"
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
.checkout-page {
  max-width: 960px;
  margin: 0 auto;
  padding-bottom: 32px;
}

.page-header {
  margin-bottom: 16px;
}

.page-title {
  margin: 0 0 6px;
  font-size: 22px;
}

.page-sub {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}

.section-card {
  margin-bottom: 16px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.card-title {
  font-weight: 700;
}

.link {
  font-size: 13px;
  font-weight: normal;
  color: var(--color-primary);
  text-decoration: none;
}

.address-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 720px) {
  .address-grid {
    grid-template-columns: 1fr;
  }

  .product-row {
    grid-template-columns: 72px 1fr;
    gap: 10px;
  }

  .product-price,
  .product-qty,
  .product-subtotal {
    grid-column: 2;
    text-align: left;
  }
}

.address-card {
  position: relative;
  padding: 14px 16px;
  text-align: left;
  background: #fff;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
}

.address-card:hover {
  border-color: #ffb4b4;
}

.address-card.active {
  border-color: var(--color-primary);
  background: #fff8f8;
  box-shadow: 0 0 0 1px var(--color-primary);
}

.address-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.address-name {
  margin: 0;
  font-weight: 700;
  color: var(--text-title);
}

.address-name .phone {
  margin-left: 8px;
  font-weight: 500;
  color: var(--text-body);
}

.address-detail {
  margin: 0;
  padding-right: 24px;
  line-height: 1.6;
  color: var(--text-body);
  font-size: 13px;
}

.address-check {
  position: absolute;
  right: 12px;
  bottom: 12px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--border-color);
}

.address-card.active .address-check {
  border-color: var(--color-primary);
  background: var(--color-primary);
}

.address-card.active .address-check::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 1px;
  width: 5px;
  height: 9px;
  border: solid #fff;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

.product-row {
  display: grid;
  grid-template-columns: 80px 1fr 100px 60px 100px;
  gap: 16px;
  align-items: center;
  padding: 14px 0;
  border-bottom: 1px solid var(--border-color);
}

.product-row:last-child {
  border-bottom: none;
}

.product-image {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: #fafafa;
}

.product-title {
  margin: 0 0 4px;
  font-weight: 600;
}

.product-meta,
.product-stock {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}

.product-price,
.product-qty,
.product-subtotal {
  text-align: right;
  color: var(--text-body);
}

.product-subtotal {
  font-weight: 700;
  color: var(--color-primary);
}

.ship-hint {
  margin: 12px 0 0;
  font-size: 12px;
  color: var(--text-muted);
}

.checkout-footer {
  position: sticky;
  bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 24px;
  flex-wrap: wrap;
  padding: 14px 20px;
  background: #fff;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}

.footer-meta {
  display: flex;
  align-items: baseline;
  gap: 16px;
  color: var(--text-body);
  font-size: 13px;
}

.total-amount {
  margin-left: 4px;
  font-size: 26px;
  font-weight: 800;
  color: var(--color-primary);
  line-height: 1;
}

.total-amount i {
  font-style: normal;
  font-size: 16px;
  margin-right: 2px;
}

.submit-btn {
  min-width: 140px;
  height: 44px;
  font-size: 16px;
}
</style>
