<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { cancelOrder, fetchOrder, payOrder } from '@/api/order';

const STATUS_LABELS = {
  PENDING_PAYMENT: '待支付',
  PENDING_SHIPMENT: '待发货',
  SHIPPED: '已发货',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

const route = useRoute();
const router = useRouter();
const orderId = computed(() => Number(route.params.orderId));

const loading = ref(false);
const paying = ref(false);
const cancelling = ref(false);
const order = ref(null);
const paySuccess = ref(false);
const countdownText = ref('');
const isExpired = ref(false);
const payMethod = ref('mock');

let countdownTimer = null;

function formatPrice(value) {
  return `¥${Number(value).toFixed(2)}`;
}

function splitPrice(value) {
  const fixed = Number(value).toFixed(2);
  const [integer, decimal] = fixed.split('.');
  return { integer, decimal };
}

function formatTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN');
}

function updateCountdown() {
  if (!order.value?.paymentDeadline || order.value.status !== 'PENDING_PAYMENT') {
    countdownText.value = '';
    isExpired.value = false;
    return;
  }

  const remaining = new Date(order.value.paymentDeadline).getTime() - Date.now();
  if (remaining <= 0) {
    countdownText.value = '支付已超时';
    isExpired.value = true;
    return;
  }

  isExpired.value = false;
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  countdownText.value = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

async function loadOrder() {
  loading.value = true;
  try {
    order.value = await fetchOrder(orderId.value);
    paySuccess.value = order.value.status === 'PENDING_SHIPMENT';
    updateCountdown();
  } catch (e) {
    ElMessage.error(e.message || '加载订单失败');
    order.value = null;
  } finally {
    loading.value = false;
  }
}

async function onPay() {
  if (!order.value || isExpired.value) return;

  paying.value = true;
  try {
    const result = await payOrder(orderId.value);
    order.value = result.order;
    paySuccess.value = true;
    ElMessage.success('支付成功');
  } catch (e) {
    ElMessage.error(e.message || '支付失败');
    await loadOrder();
  } finally {
    paying.value = false;
  }
}

async function onCancel() {
  cancelling.value = true;
  try {
    await cancelOrder(orderId.value);
    ElMessage.success('订单已取消');
    router.push({ name: 'products' });
  } catch (e) {
    ElMessage.error(e.message || '取消失败');
  } finally {
    cancelling.value = false;
  }
}

onMounted(() => {
  loadOrder();
  countdownTimer = setInterval(updateCountdown, 1000);
});

onUnmounted(() => {
  if (countdownTimer) clearInterval(countdownTimer);
});
</script>

<template>
  <div class="payment-page" v-loading="loading">
    <template v-if="order">
      <div v-if="paySuccess" class="success-panel">
        <div class="success-icon">✓</div>
        <h2 class="success-title">支付成功</h2>
        <p class="success-sub">商家将尽快为您发货</p>
        <div class="success-meta">
          <p><span>订单号</span>{{ order.orderNo }}</p>
          <p><span>支付金额</span><em>{{ formatPrice(order.totalAmount) }}</em></p>
        </div>
        <div class="success-actions">
          <el-button
            type="primary"
            size="large"
            @click="router.push({ name: 'order-detail', params: { orderId: order.orderId } })"
          >
            查看订单
          </el-button>
          <el-button size="large" @click="router.push({ name: 'products' })">继续购物</el-button>
        </div>
      </div>

      <template v-else-if="order.status === 'CANCELLED'">
        <div class="success-panel muted">
          <div class="success-icon info">i</div>
          <h2 class="success-title">订单已取消</h2>
          <p class="success-sub">您可以重新下单购买</p>
          <div class="success-actions">
            <el-button type="primary" @click="router.push({ name: 'products' })">去逛逛</el-button>
          </div>
        </div>
      </template>

      <template v-else>
        <div class="amount-hero">
          <p class="hero-kicker">应付金额</p>
          <div class="hero-amount">
            <span class="symbol">¥</span>
            <span class="integer">{{ splitPrice(order.totalAmount).integer }}</span>
            <span class="decimal">.{{ splitPrice(order.totalAmount).decimal }}</span>
          </div>
          <p
            v-if="order.status === 'PENDING_PAYMENT' && countdownText"
            class="hero-countdown"
            :class="{ expired: isExpired }"
          >
            <template v-if="isExpired">订单已超时，请重新下单</template>
            <template v-else>请在 <strong>{{ countdownText }}</strong> 内完成支付</template>
          </p>
          <p class="hero-order">订单号 {{ order.orderNo }} · {{ STATUS_LABELS[order.status] || order.status }}</p>
        </div>

        <el-card shadow="never" class="section-card">
          <template #header><span class="card-title">支付方式</span></template>
          <div class="method-list">
            <button
              type="button"
              class="method-card"
              :class="{ active: payMethod === 'mock' }"
              @click="payMethod = 'mock'"
            >
              <span class="method-icon mock">M</span>
              <div class="method-body">
                <p class="method-name">模拟支付</p>
                <p class="method-desc">课程演示通道，点击即完成付款</p>
              </div>
              <span class="method-check" />
            </button>
          </div>
        </el-card>

        <el-card shadow="never" class="section-card">
          <template #header><span class="card-title">商品信息</span></template>
          <div v-for="item in order.items" :key="item.skuId" class="product-row">
            <span class="product-title">{{ item.title }}</span>
            <span class="product-qty">x{{ item.quantity }}</span>
            <span class="product-price">{{ formatPrice(item.price * item.quantity) }}</span>
          </div>
          <div class="order-meta">
            <p>下单时间：{{ formatTime(order.createdAt) }}</p>
            <p>支付截止：{{ formatTime(order.paymentDeadline) }}</p>
          </div>
        </el-card>

        <el-card v-if="order.addressSnapshot" shadow="never" class="section-card">
          <template #header><span class="card-title">收货信息</span></template>
          <p class="address-line strong">
            {{ order.addressSnapshot.receiverName }} {{ order.addressSnapshot.phone }}
          </p>
          <p class="address-line">{{ order.addressSnapshot.fullAddress }}</p>
        </el-card>

        <div v-if="order.status === 'PENDING_PAYMENT'" class="payment-bar">
          <div class="bar-amount">
            需支付
            <strong>{{ formatPrice(order.totalAmount) }}</strong>
          </div>
          <div class="bar-actions">
            <el-button size="large" :loading="cancelling" @click="onCancel">取消订单</el-button>
            <el-button
              type="primary"
              size="large"
              class="pay-btn"
              :loading="paying"
              :disabled="isExpired"
              @click="onPay"
            >
              立即支付
            </el-button>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>

<style scoped>
.payment-page {
  max-width: 720px;
  margin: 0 auto;
  padding-bottom: 40px;
}

.amount-hero {
  margin-bottom: 16px;
  padding: 28px 24px;
  text-align: center;
  color: #fff;
  border-radius: 12px;
  background:
    radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.16), transparent 40%),
    linear-gradient(135deg, #e4393c 0%, #c81623 100%);
  box-shadow: 0 10px 28px rgba(200, 22, 35, 0.28);
}

.hero-kicker {
  margin: 0 0 8px;
  font-size: 13px;
  opacity: 0.9;
}

.hero-amount {
  display: flex;
  align-items: baseline;
  justify-content: center;
  font-weight: 800;
  line-height: 1;
}

.hero-amount .symbol {
  font-size: 22px;
  margin-right: 4px;
}

.hero-amount .integer {
  font-size: 48px;
}

.hero-amount .decimal {
  font-size: 22px;
}

.hero-countdown {
  margin: 16px 0 0;
  font-size: 14px;
  opacity: 0.95;
}

.hero-countdown strong {
  font-size: 18px;
  letter-spacing: 0.04em;
}

.hero-countdown.expired {
  color: #ffe7ba;
}

.hero-order {
  margin: 10px 0 0;
  font-size: 12px;
  opacity: 0.8;
}

.section-card {
  margin-bottom: 16px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
}

.card-title {
  font-weight: 700;
}

.method-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.method-card {
  display: flex;
  align-items: center;
  gap: 14px;
  width: 100%;
  padding: 14px 16px;
  text-align: left;
  background: #fff;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
}

.method-card.active {
  border-color: var(--color-primary);
  background: #fff8f8;
  box-shadow: 0 0 0 1px var(--color-primary);
}

.method-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  color: #fff;
  flex-shrink: 0;
}

.method-icon.mock {
  background: linear-gradient(135deg, #e4393c, #ff7875);
}

.method-body {
  flex: 1;
  min-width: 0;
}

.method-name {
  margin: 0 0 4px;
  font-weight: 700;
  color: var(--text-title);
}

.method-desc {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}

.method-check {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid var(--border-color);
  position: relative;
  flex-shrink: 0;
}

.method-card.active .method-check {
  border-color: var(--color-primary);
  background: var(--color-primary);
}

.method-card.active .method-check::after {
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
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-color);
}

.product-row:last-of-type {
  border-bottom: none;
}

.product-title {
  flex: 1;
  min-width: 0;
}

.product-qty {
  color: var(--text-muted);
}

.product-price {
  font-weight: 600;
  color: var(--color-primary);
}

.order-meta {
  margin-top: 8px;
  padding-top: 12px;
  border-top: 1px dashed var(--border-color);
}

.order-meta p {
  margin: 0 0 4px;
  font-size: 12px;
  color: var(--text-muted);
}

.address-line {
  margin: 0 0 4px;
  color: var(--text-body);
}

.address-line.strong {
  font-weight: 600;
  color: var(--text-title);
}

.payment-bar {
  position: sticky;
  bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 14px 18px;
  background: #fff;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}

.bar-amount {
  color: var(--text-body);
}

.bar-amount strong {
  margin-left: 6px;
  font-size: 24px;
  color: var(--color-primary);
}

.bar-actions {
  display: flex;
  gap: 12px;
}

.pay-btn {
  min-width: 128px;
}

.success-panel {
  margin-top: 24px;
  padding: 40px 24px;
  text-align: center;
  background: #fff;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.04);
}

.success-panel.muted .success-icon {
  background: #f0f0f0;
  color: var(--text-muted);
}

.success-icon {
  width: 72px;
  height: 72px;
  margin: 0 auto 16px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #73d13d, #52c41a);
}

.success-icon.info {
  font-style: normal;
  font-size: 32px;
}

.success-title {
  margin: 0 0 8px;
  font-size: 24px;
}

.success-sub {
  margin: 0 0 20px;
  color: var(--text-muted);
}

.success-meta {
  display: inline-flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 24px;
  padding: 14px 20px;
  background: #fafafa;
  border-radius: 8px;
  text-align: left;
  min-width: min(360px, 100%);
}

.success-meta p {
  margin: 0;
  display: flex;
  justify-content: space-between;
  gap: 24px;
  color: var(--text-title);
}

.success-meta span {
  color: var(--text-muted);
}

.success-meta em {
  font-style: normal;
  font-weight: 700;
  color: var(--color-primary);
}

.success-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}
</style>
