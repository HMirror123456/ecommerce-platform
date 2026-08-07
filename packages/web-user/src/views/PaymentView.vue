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

let countdownTimer = null;

function formatPrice(value) {
  return `¥${Number(value).toFixed(2)}`;
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
    router.push({ name: 'checkout', query: { spuId: 101, skuId: 1001, quantity: 1 } });
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
      <el-result
        v-if="paySuccess"
        icon="success"
        title="支付成功"
        sub-title="商家将尽快为您发货"
      >
        <template #extra>
          <p class="result-meta">订单号：{{ order.orderNo }}</p>
          <p class="result-meta">支付金额：{{ formatPrice(order.totalAmount) }}</p>
          <el-button type="primary" @click="router.push({ name: 'checkout', query: { spuId: 101, skuId: 1001, quantity: 1 } })">
            继续购物
          </el-button>
        </template>
      </el-result>

      <template v-else>
        <h2 class="page-title">订单支付</h2>

        <el-alert
          v-if="order.status === 'PENDING_PAYMENT' && countdownText"
          :title="isExpired ? '订单已超时，请重新下单' : `请在 ${countdownText} 内完成支付`"
          :type="isExpired ? 'error' : 'warning'"
          show-icon
          :closable="false"
          class="countdown-alert"
        />

        <el-card shadow="never" class="section-card">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="订单号">{{ order.orderNo }}</el-descriptions-item>
            <el-descriptions-item label="订单状态">{{ STATUS_LABELS[order.status] || order.status }}</el-descriptions-item>
            <el-descriptions-item label="下单时间">{{ formatTime(order.createdAt) }}</el-descriptions-item>
            <el-descriptions-item label="支付截止">{{ formatTime(order.paymentDeadline) }}</el-descriptions-item>
            <el-descriptions-item label="应付金额" :span="2">
              <span class="pay-amount">{{ formatPrice(order.totalAmount) }}</span>
            </el-descriptions-item>
          </el-descriptions>
        </el-card>

        <el-card shadow="never" class="section-card">
          <template #header><span>商品信息</span></template>
          <div v-for="item in order.items" :key="item.skuId" class="product-row">
            <span class="product-title">{{ item.title }}</span>
            <span class="product-qty">x{{ item.quantity }}</span>
            <span class="product-price">{{ formatPrice(item.price * item.quantity) }}</span>
          </div>
        </el-card>

        <el-card v-if="order.addressSnapshot" shadow="never" class="section-card">
          <template #header><span>收货信息</span></template>
          <p class="address-line">
            {{ order.addressSnapshot.receiverName }} {{ order.addressSnapshot.phone }}
          </p>
          <p class="address-line">{{ order.addressSnapshot.fullAddress }}</p>
        </el-card>

        <div v-if="order.status === 'PENDING_PAYMENT'" class="payment-actions">
          <el-button size="large" :loading="cancelling" @click="onCancel">取消订单</el-button>
          <el-button type="primary" size="large" :loading="paying" :disabled="isExpired" @click="onPay">
            立即支付 {{ formatPrice(order.totalAmount) }}
          </el-button>
        </div>

        <el-result
          v-else-if="order.status === 'CANCELLED'"
          icon="info"
          title="订单已取消"
          sub-title="您可以重新下单购买"
        />
      </template>
    </template>
  </div>
</template>

<style scoped>
.payment-page {
  max-width: 960px;
  margin: 0 auto;
  padding-bottom: 32px;
}
.page-title {
  margin: 0 0 16px;
  font-size: 20px;
}
.countdown-alert {
  margin-bottom: 16px;
}
.section-card {
  margin-bottom: 16px;
}
.pay-amount {
  font-size: 22px;
  font-weight: 700;
  color: var(--color-primary);
}
.product-row {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-color);
}
.product-row:last-child {
  border-bottom: none;
}
.product-title {
  flex: 1;
}
.product-qty {
  color: var(--text-muted);
}
.product-price {
  font-weight: 600;
  color: var(--color-primary);
}
.address-line {
  margin: 0 0 4px;
  color: var(--text-body);
}
.payment-actions {
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  padding: 16px 0;
}
.result-meta {
  margin: 0 0 8px;
  color: var(--text-body);
}
</style>
