<script setup>
import { onMounted, onUnmounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { confirmReceipt, fetchOrders } from '@/api/order';
import { addCartItem } from '@/api/cart';

const STATUS_OPTIONS = [
  { label: '全部', value: '' },
  { label: '待支付', value: 'PENDING_PAYMENT' },
  { label: '待发货', value: 'PENDING_SHIPMENT' },
  { label: '已发货', value: 'SHIPPED' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '退款中', value: 'REFUNDING' },
  { label: '已退款', value: 'REFUNDED' },
  { label: '已取消', value: 'CANCELLED' },
];

const STATUS_LABELS = Object.fromEntries(
  STATUS_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label]),
);

const router = useRouter();
const loading = ref(false);
const orders = ref([]);
const status = ref('');
const nowMs = ref(Date.now());
const rebuyingId = ref(null);
let tickTimer = null;

function formatPrice(value) {
  return `¥${Number(value || 0).toFixed(2)}`;
}

function formatTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN');
}

function paymentRemainText(order) {
  void nowMs.value;
  if (order.status !== 'PENDING_PAYMENT' || !order.paymentDeadline) return '';
  const remaining = new Date(order.paymentDeadline).getTime() - Date.now();
  if (remaining <= 0) return '已超时';
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return `剩余 ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function isPaymentExpired(order) {
  void nowMs.value;
  if (order.status !== 'PENDING_PAYMENT' || !order.paymentDeadline) return false;
  return new Date(order.paymentDeadline).getTime() <= Date.now();
}

async function loadOrders() {
  loading.value = true;
  try {
    const data = await fetchOrders(status.value ? { status: status.value } : undefined);
    orders.value = data.list || [];
  } catch (e) {
    ElMessage.error(e.message || '加载订单失败');
    orders.value = [];
  } finally {
    loading.value = false;
  }
}

function goDetail(orderId) {
  router.push({ name: 'order-detail', params: { orderId } });
}

function goPay(orderId) {
  router.push({ name: 'payment', params: { orderId } });
}

async function onConfirmReceipt(orderId) {
  try {
    await ElMessageBox.confirm('确认已收到全部商品？确认后订单将完成。', '确认收货', { type: 'info' });
    await confirmReceipt(orderId);
    ElMessage.success('确认收货成功，订单已完成');
    await loadOrders();
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e.message || '确认收货失败');
  }
}

async function onBuyAgain(order) {
  const lines = (order.items || []).filter((it) => Number(it.skuId) > 0);
  if (!lines.length) {
    ElMessage.warning('订单没有可加购的商品');
    return;
  }
  rebuyingId.value = order.orderId;
  let ok = 0;
  let fail = 0;
  try {
    for (const line of lines) {
      try {
        await addCartItem(Number(line.skuId), Math.max(1, Number(line.quantity) || 1));
        ok += 1;
      } catch {
        fail += 1;
      }
    }
    if (ok > 0 && fail === 0) {
      ElMessage.success(`已将 ${ok} 种商品加入购物车`);
      router.push({ name: 'cart' });
    } else if (ok > 0) {
      ElMessage.warning(`成功 ${ok} 种，失败 ${fail} 种（可能已下架或库存不足）`);
      router.push({ name: 'cart' });
    } else {
      ElMessage.error('加购失败，商品可能已下架或库存不足');
    }
  } finally {
    rebuyingId.value = null;
  }
}

onMounted(() => {
  loadOrders();
  tickTimer = setInterval(() => {
    nowMs.value = Date.now();
  }, 1000);
});

onUnmounted(() => {
  if (tickTimer) clearInterval(tickTimer);
});
</script>

<template>
  <div class="order-list-page" v-loading="loading">
    <div class="page-header">
      <h2 class="page-title">我的订单</h2>
      <el-radio-group v-model="status" size="small" @change="loadOrders">
        <el-radio-button v-for="opt in STATUS_OPTIONS" :key="opt.value || 'all'" :label="opt.value">
          {{ opt.label }}
        </el-radio-button>
      </el-radio-group>
    </div>

    <el-empty v-if="!loading && orders.length === 0" description="暂无订单">
      <el-button type="primary" @click="router.push({ name: 'products' })">去购物</el-button>
    </el-empty>

    <div v-else class="order-list">
      <el-card v-for="order in orders" :key="order.orderId" shadow="never" class="order-card">
        <div class="order-top">
          <div>
            <span class="order-no">订单号 {{ order.orderNo }}</span>
            <span class="order-time">{{ formatTime(order.createdAt) }}</span>
          </div>
          <div class="status-wrap">
            <el-tag size="small">{{ STATUS_LABELS[order.status] || order.status }}</el-tag>
            <span
              v-if="order.status === 'PENDING_PAYMENT' && paymentRemainText(order)"
              class="pay-countdown"
              :class="{ expired: isPaymentExpired(order) }"
            >
              {{ paymentRemainText(order) }}
            </span>
          </div>
        </div>

        <div class="items">
          <div v-for="item in order.items" :key="`${order.orderId}-${item.skuId}`" class="item-row">
            <span class="item-title">{{ item.title }}</span>
            <span class="item-qty">x{{ item.quantity }}</span>
            <span class="item-price">{{ formatPrice(item.price * item.quantity) }}</span>
          </div>
        </div>

        <div class="order-footer">
          <div class="total">合计：<span>{{ formatPrice(order.totalAmount) }}</span></div>
          <div class="actions">
            <el-button
              v-if="order.status === 'PENDING_PAYMENT' && !isPaymentExpired(order)"
              type="primary"
              @click="goPay(order.orderId)"
            >
              去支付
            </el-button>
            <el-button
              v-if="order.canConfirmAllReceipt"
              type="primary"
              @click="onConfirmReceipt(order.orderId)"
            >
              确认收货
            </el-button>
            <el-button
              v-else-if="order.status === 'SHIPPED'"
              type="primary"
              plain
              @click="goDetail(order.orderId)"
            >
              去确认收货
            </el-button>
            <el-button
              v-if="order.items?.length && order.status !== 'PENDING_PAYMENT'"
              :loading="rebuyingId === order.orderId"
              @click="onBuyAgain(order)"
            >
              再买一单
            </el-button>
            <el-button @click="goDetail(order.orderId)">查看详情</el-button>
          </div>
        </div>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}
.page-title { margin: 0; font-size: 20px; }
.order-list { display: flex; flex-direction: column; gap: 12px; }
.order-card { border: 1px solid var(--border-color); }
.order-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.order-no { font-weight: 600; margin-right: 12px; }
.order-time { color: var(--text-muted); font-size: 13px; }
.status-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.pay-countdown {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-primary);
}
.pay-countdown.expired {
  color: var(--color-error, #f56c6c);
}
.item-row {
  display: grid;
  grid-template-columns: 1fr 60px 100px;
  gap: 12px;
  padding: 8px 0;
  border-top: 1px solid var(--border-color);
}
.item-title { color: var(--text-body); }
.item-qty { color: var(--text-muted); text-align: right; }
.item-price { text-align: right; font-weight: 600; color: var(--color-primary); }
.order-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
}
.total span { font-size: 18px; font-weight: 700; color: var(--color-primary); }
.actions { display: flex; gap: 8px; }
</style>
