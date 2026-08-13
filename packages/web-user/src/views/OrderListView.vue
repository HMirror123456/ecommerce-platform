<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
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

const STATUS_TONE = {
  PENDING_PAYMENT: 'warning',
  PENDING_SHIPMENT: 'info',
  SHIPPED: 'primary',
  COMPLETED: 'success',
  REFUNDING: 'warning',
  REFUNDED: 'muted',
  CANCELLED: 'muted',
};

const route = useRoute();
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

function thumbText(title) {
  const t = String(title || '商').trim();
  return t.slice(0, 1);
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

function syncStatusFromRoute() {
  const q = route.query.status;
  const next = q == null ? '' : String(q);
  const allowed = STATUS_OPTIONS.some((o) => o.value === next);
  status.value = allowed ? next : '';
}

function onStatusChange(value) {
  const query = { ...route.query };
  if (value) query.status = value;
  else delete query.status;
  // 由 route.query.status 的 watch 统一拉取，避免重复请求
  router.replace({ query });
  if (String(route.query.status || '') === String(value || '')) {
    loadOrders();
  }
}

function goDetail(orderId, hash) {
  router.push({
    name: 'order-detail',
    params: { orderId },
    hash: hash || undefined,
  });
}

function afterSaleActionLabel(order) {
  if (order.activeAfterSaleCount > 0) {
    if (order.afterSaleFocusStatus === 'ESCALATED') return '平台仲裁中';
    if (order.afterSaleFocusStatus === 'APPROVED') return '去填写寄回';
    if (order.afterSaleFocusStatus === 'RETURNING') return '售后处理中';
    return '售后处理中';
  }
  if (['SHIPPED', 'COMPLETED', 'REFUNDING'].includes(order.status)) return '申请售后';
  return '';
}

function goAfterSale(order) {
  goDetail(order.orderId, '#after-sales');
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

watch(
  () => route.query.status,
  () => {
    syncStatusFromRoute();
    loadOrders();
  },
);

onMounted(() => {
  syncStatusFromRoute();
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
      <div>
        <h2 class="page-title">我的订单</h2>
        <p class="page-sub">跟踪支付、发货与售后进度</p>
      </div>
    </div>

    <div class="filter-bar">
      <button
        v-for="opt in STATUS_OPTIONS"
        :key="opt.value || 'all'"
        type="button"
        class="filter-chip"
        :class="{ active: status === opt.value }"
        @click="onStatusChange(opt.value)"
      >
        {{ opt.label }}
      </button>
    </div>

    <el-empty v-if="!loading && orders.length === 0" description="暂无相关订单">
      <el-button type="primary" @click="router.push({ name: 'products' })">去购物</el-button>
    </el-empty>

    <div v-else class="order-list">
      <article
        v-for="order in orders"
        :key="order.orderId"
        class="order-card"
        :class="`tone-${STATUS_TONE[order.status] || 'muted'}`"
      >
        <div class="order-top">
          <div class="order-meta">
            <span class="order-no">订单号 {{ order.orderNo }}</span>
            <span class="order-time">{{ formatTime(order.createdAt) }}</span>
          </div>
          <div class="status-wrap">
            <span class="status-pill" :class="STATUS_TONE[order.status] || 'muted'">
              {{ STATUS_LABELS[order.status] || order.status }}
            </span>
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
          <div
            v-for="item in order.items"
            :key="`${order.orderId}-${item.skuId}`"
            class="item-row"
            @click="goDetail(order.orderId)"
          >
            <div class="item-thumb">{{ thumbText(item.title) }}</div>
            <span class="item-title">{{ item.title }}</span>
            <span class="item-qty">x{{ item.quantity }}</span>
            <span class="item-price">{{ formatPrice(item.price * item.quantity) }}</span>
          </div>
        </div>

        <div class="order-footer">
          <div class="total">
            合计
            <span>{{ formatPrice(order.totalAmount) }}</span>
          </div>
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
              v-if="afterSaleActionLabel(order)"
              type="warning"
              plain
              @click="goAfterSale(order)"
            >
              {{ afterSaleActionLabel(order) }}
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
      </article>
    </div>
  </div>
</template>

<style scoped>
.page-header {
  margin-bottom: 12px;
}

.page-title {
  margin: 0 0 4px;
  font-size: 22px;
}

.page-sub {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}

.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}

.filter-chip {
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: #fafafa;
  color: var(--text-body);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.filter-chip:hover {
  border-color: #ffb4b4;
  color: var(--color-primary);
}

.filter-chip.active {
  background: #fff1f0;
  border-color: var(--color-primary);
  color: var(--color-primary);
  font-weight: 600;
}

.order-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.order-card {
  position: relative;
  padding: 16px 16px 16px 20px;
  background: #fff;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  overflow: hidden;
}

.order-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  background: #d9d9d9;
}

.order-card.tone-warning::before { background: #faad14; }
.order-card.tone-info::before { background: #1890ff; }
.order-card.tone-primary::before { background: var(--color-primary); }
.order-card.tone-success::before { background: #52c41a; }
.order-card.tone-muted::before { background: #bfbfbf; }

.order-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.order-no {
  font-weight: 700;
  margin-right: 12px;
}

.order-time {
  color: var(--text-muted);
  font-size: 13px;
}

.status-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  background: #f5f5f5;
  color: var(--text-body);
}

.status-pill.warning { background: #fff7e6; color: #d48806; }
.status-pill.info { background: #e6f7ff; color: #096dd9; }
.status-pill.primary { background: #fff1f0; color: var(--color-primary); }
.status-pill.success { background: #f6ffed; color: #389e0d; }
.status-pill.muted { background: #f5f5f5; color: var(--text-muted); }

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
  grid-template-columns: 44px 1fr 48px 96px;
  gap: 12px;
  align-items: center;
  padding: 10px 0;
  border-top: 1px solid var(--border-color);
  cursor: pointer;
}

.item-thumb {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: var(--color-primary);
  background: linear-gradient(135deg, #fff1f0, #ffe7e6);
  border: 1px solid #ffccc7;
}

.item-title {
  color: var(--text-body);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-qty {
  color: var(--text-muted);
  text-align: right;
}

.item-price {
  text-align: right;
  font-weight: 600;
  color: var(--color-primary);
}

.order-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-top: 4px;
  padding-top: 12px;
  border-top: 1px solid var(--border-color);
  flex-wrap: wrap;
}

.total {
  color: var(--text-body);
  font-size: 13px;
}

.total span {
  margin-left: 6px;
  font-size: 20px;
  font-weight: 800;
  color: var(--color-primary);
}

.actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

@media (max-width: 640px) {
  .item-row {
    grid-template-columns: 44px 1fr;
  }

  .item-qty,
  .item-price {
    grid-column: 2;
    text-align: left;
  }
}
</style>
