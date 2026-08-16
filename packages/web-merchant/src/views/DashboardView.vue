<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';
import {
  fetchMerchantChatUnreadCount,
  fetchMerchantProducts,
  getAfterSales,
  getDashboardSummary,
} from '@/api/merchant';
import { useAuthStore } from '@/stores/auth';
import { getProductInventoryWarning } from '@/utils/inventoryWarning';

const router = useRouter();
const auth = useAuthStore();
const loading = ref(false);
const INVENTORY_PAGE_SIZE = 100;
const summary = ref({
  merchantId: null,
  shopId: null,
  shopName: '',
  productTotal: 0,
  draftProductCount: 0,
  pendingAuditProductCount: 0,
  onShelfProductCount: 0,
  rejectedProductCount: 0,
  offShelfProductCount: 0,
  pendingShipmentOrderCount: 0,
  shippedOrderCount: 0,
  lowStockProductCount: 0,
  outOfStockProductCount: 0,
  unreadMessageCount: 0,
  pendingAfterSaleCount: 0,
});

const statCards = [
  { label: '商品总数', key: 'productTotal', type: 'primary', path: '/products' },
  { label: '已上架商品', key: 'onShelfProductCount', type: 'success', path: '/products?status=ON_SHELF' },
  { label: '待审核商品', key: 'pendingAuditProductCount', type: 'warning', path: '/products?status=PENDING_AUDIT' },
  { label: '待发货订单', key: 'pendingShipmentOrderCount', type: 'warning', path: '/orders?status=PENDING_SHIPMENT' },
  { label: '待处理售后', key: 'pendingAfterSaleCount', type: 'warning', path: '/after-sales?status=APPLIED' },
  { label: '未读消息', key: 'unreadMessageCount', type: 'danger', path: '/chats' },
  { label: '低库存商品', key: 'lowStockProductCount', type: 'warning', path: '/products?stockAlert=LOW_STOCK' },
  { label: '缺货商品', key: 'outOfStockProductCount', type: 'danger', path: '/products?stockAlert=OUT_OF_STOCK' },
];

const shopInfo = computed(() => ({
  merchantId: summary.value.merchantId || auth.merchantId || '-',
  username: auth.username || '-',
  shopId: summary.value.shopId || auth.shopId || '-',
  shopName: summary.value.shopName || auth.shopName || '-',
}));

const todoItems = computed(() => {
  const todos = [];
  if (getNumber('unreadMessageCount')) todos.push({ label: `有 ${getNumber('unreadMessageCount')} 条未读消息，建议优先回复用户沟通。`, path: '/chats', type: 'danger' });
  if (getNumber('pendingShipmentOrderCount')) todos.push({ label: `有 ${getNumber('pendingShipmentOrderCount')} 笔待发货订单，请及时处理。`, path: '/orders?status=PENDING_SHIPMENT', type: 'warning' });
  if (getNumber('pendingAfterSaleCount')) todos.push({ label: `有 ${getNumber('pendingAfterSaleCount')} 笔待处理售后，请尽快审核。`, path: '/after-sales?status=APPLIED', type: 'warning' });
  if (getNumber('lowStockProductCount') || getNumber('outOfStockProductCount')) todos.push({ label: '存在低库存或缺货商品，建议及时补货。', path: '/products?stockAlert=LOW_STOCK', type: 'warning' });
  return todos;
});

function getNumber(key) {
  return Number(summary.value?.[key]) || 0;
}

async function getInventoryAlertSummary() {
  let currentPage = 1;
  let total = 0;
  let products = [];

  do {
    const data = await fetchMerchantProducts({ page: currentPage, pageSize: INVENTORY_PAGE_SIZE });
    const rows = Array.isArray(data?.items) ? data.items : Array.isArray(data?.list) ? data.list : [];
    products = products.concat(rows);
    total = Number(data?.total) || products.length;
    currentPage += 1;
    if (!rows.length) break;
  } while (products.length < total);

  return products.reduce(
    (counts, product) => {
      const warning = getProductInventoryWarning(product);
      if (warning.level === 'LOW_STOCK') counts.lowStockProductCount += 1;
      if (warning.level === 'OUT_OF_STOCK') counts.outOfStockProductCount += 1;
      return counts;
    },
    { lowStockProductCount: 0, outOfStockProductCount: 0 },
  );
}

async function getUnreadMessageSummary() {
  const data = await fetchMerchantChatUnreadCount();
  return { unreadMessageCount: Number(data?.unreadCount) || 0 };
}

async function getAfterSaleSummary() {
  const data = await getAfterSales();
  const list = Array.isArray(data) ? data : data?.list || [];
  return { pendingAfterSaleCount: list.filter((item) => item.status === 'APPLIED').length };
}

async function refreshUnreadMessageCount() {
  try {
    summary.value = { ...summary.value, ...(await getUnreadMessageSummary()) };
  } catch {
    summary.value = { ...summary.value, unreadMessageCount: 0 };
  }
}

function openStatCard(item) {
  if (item.path) router.push(item.path);
}

async function loadSummary() {
  loading.value = true;
  try {
    const data = await getDashboardSummary();
    summary.value = { ...summary.value, ...(data || {}) };
    const [inventoryResult, unreadResult, afterSaleResult] = await Promise.allSettled([
      getInventoryAlertSummary(),
      getUnreadMessageSummary(),
      getAfterSaleSummary(),
    ]);
    if (inventoryResult.status === 'fulfilled') {
      summary.value = { ...summary.value, ...inventoryResult.value };
    } else {
      ElMessage.warning(inventoryResult.reason?.message || '库存预警统计加载失败');
    }
    if (unreadResult.status === 'fulfilled') {
      summary.value = { ...summary.value, ...unreadResult.value };
    } else {
      ElMessage.warning(unreadResult.reason?.message || '未读消息统计加载失败');
    }
    if (afterSaleResult.status === 'fulfilled') {
      summary.value = { ...summary.value, ...afterSaleResult.value };
    } else {
      ElMessage.warning(afterSaleResult.reason?.message || '待处理售后统计加载失败');
    }
  } catch (e) {
    ElMessage.error(e.message || '加载工作台统计失败');
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadSummary();
  window.addEventListener('merchant-inventory-changed', loadSummary);
  window.addEventListener('merchant-chat-unread-changed', refreshUnreadMessageCount);
});

onUnmounted(() => {
  window.removeEventListener('merchant-inventory-changed', loadSummary);
  window.removeEventListener('merchant-chat-unread-changed', refreshUnreadMessageCount);
});
</script>

<template>
  <div v-loading="loading" class="dashboard">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <div class="title">店铺信息</div>
            <div class="description">当前登录商家的基础信息，来自商家账号和店铺数据</div>
          </div>
          <el-tag type="success">已入驻</el-tag>
        </div>
      </template>

      <el-descriptions :column="4" border>
        <el-descriptions-item label="商家 ID">{{ shopInfo.merchantId }}</el-descriptions-item>
        <el-descriptions-item label="登录账号">{{ shopInfo.username }}</el-descriptions-item>
        <el-descriptions-item label="店铺 ID">{{ shopInfo.shopId }}</el-descriptions-item>
        <el-descriptions-item label="店铺名称">{{ shopInfo.shopName }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <div class="title">商家工作台</div>
            <div class="description">
              {{ summary.shopName || '当前店铺' }} 的商品审核与订单履约概览
            </div>
          </div>
          <el-button :loading="loading" :disabled="loading" @click="loadSummary">刷新</el-button>
        </div>
      </template>

      <el-row :gutter="16">
        <el-col v-for="item in statCards" :key="item.key" :xs="24" :sm="12" :md="8">
          <div class="stat-card" :class="[{ clickable: item.path }, `is-${item.type}`]" @click="openStatCard(item)">
            <div class="stat-label">{{ item.label }}</div>
            <div class="stat-value">{{ getNumber(item.key) }}</div>
            <el-tag size="small" :type="item.type">实时统计</el-tag>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <el-card shadow="never" class="todo-card">
      <template #header><span>今日待办</span></template>
      <div v-if="todoItems.length" class="todo-list">
        <div v-for="item in todoItems" :key="item.label" class="todo-item" @click="router.push(item.path)">
          <el-tag :type="item.type" size="small">待办</el-tag>
          <span>{{ item.label }}</span>
        </div>
      </div>
      <el-empty v-else :image-size="56" description="暂无紧急待办" />
    </el-card>

  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.title {
  color: #333;
  font-weight: 600;
  line-height: 24px;
}
.description {
  margin-top: 4px;
  color: #999;
  font-size: 13px;
}
.stat-card {
  min-height: 116px;
  margin-bottom: 16px;
  padding: 18px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  background: #fff;
}
.stat-card.clickable { cursor: pointer; }
.stat-card.clickable:hover { border-color: #f56c6c; box-shadow: 0 4px 12px rgba(245, 108, 108, .12); }
.stat-card.is-danger { border-color: #fbc4c4; }
.stat-card.is-warning { border-color: #f3d19e; }
.todo-list { display: flex; flex-direction: column; gap: 10px; }
.todo-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid #ebeef5; border-radius: 6px; color: #606266; cursor: pointer; }
.todo-item:hover { border-color: #409eff; }
.stat-label {
  color: #666;
  font-size: 13px;
}
.stat-value {
  margin: 10px 0;
  color: #333;
  font-size: 30px;
  font-weight: 600;
}
</style>
