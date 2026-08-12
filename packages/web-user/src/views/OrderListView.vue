<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { confirmReceipt, fetchOrders } from '@/api/order';

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

function formatPrice(value) {
  return `¥${Number(value || 0).toFixed(2)}`;
}

function formatTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN');
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

/** 整单确认：仅全部子单已发货时（后端 canConfirmAllReceipt） */
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

onMounted(loadOrders);
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
          <el-tag size="small">{{ STATUS_LABELS[order.status] || order.status }}</el-tag>
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
              v-if="order.status === 'PENDING_PAYMENT'"
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
