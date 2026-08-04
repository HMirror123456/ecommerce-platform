<script setup>
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { fetchMerchantOrders } from '@/api/merchant';

const ORDER_STATUS_OPTIONS = [
  { label: '待支付', value: 'PENDING_PAYMENT' },
  { label: '已支付', value: 'PAID' },
  { label: '待发货', value: 'PENDING_SHIPMENT' },
  { label: '已发货', value: 'SHIPPED' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '已取消', value: 'CANCELLED' },
  { label: '退款中', value: 'REFUNDING' },
  { label: '已退款', value: 'REFUNDED' },
];

const loading = ref(false);
const orders = ref([]);
const total = ref(0);
const status = ref('');

const statusLabelMap = computed(() =>
  ORDER_STATUS_OPTIONS.reduce((map, item) => {
    map[item.value] = item.label;
    return map;
  }, {}),
);

function formatTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN');
}

function formatPrice(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return '-';
  return `¥${numberValue.toFixed(2)}`;
}

function formatOrderAmount(items) {
  const safeItems = Array.isArray(items) ? items : [];
  const amount = safeItems.reduce((sum, item) => sum + Number(item?.price || 0) * Number(item?.quantity || 0), 0);
  return formatPrice(amount);
}

function getStatusLabel(value) {
  return statusLabelMap.value[value] || value || '-';
}

function getStatusTagType(value) {
  const typeMap = {
    PENDING_PAYMENT: 'warning',
    PAID: 'info',
    PENDING_SHIPMENT: 'warning',
    SHIPPED: 'primary',
    COMPLETED: 'success',
    CANCELLED: 'info',
    REFUNDING: 'danger',
    REFUNDED: 'success',
  };
  return typeMap[value] || 'info';
}

function getItems(row) {
  return Array.isArray(row?.items) ? row.items : [];
}

function getAddress(row) {
  return row?.addressSnapshot || {};
}

function getShipment(row) {
  return row?.shipment || null;
}

async function loadOrders() {
  loading.value = true;
  try {
    const params = status.value ? { status: status.value } : undefined;
    const data = await fetchMerchantOrders(params);
    orders.value = Array.isArray(data?.list) ? data.list : [];
    total.value = Number(data?.total) || 0;
  } catch (e) {
    ElMessage.error(e.message || '加载订单失败');
    orders.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

function onStatusChange() {
  loadOrders();
}

function showShipPlaceholder() {
  ElMessage.info('发货功能后续实现');
}

onMounted(loadOrders);
</script>

<template>
  <el-card shadow="never">
    <template #header>
      <div class="card-header">
        <span>商家订单列表</span>
        <el-select v-model="status" clearable placeholder="全部状态" class="status-filter" @change="onStatusChange">
          <el-option v-for="item in ORDER_STATUS_OPTIONS" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
      </div>
    </template>

    <el-table v-loading="loading" :data="orders" stripe>
      <template #empty>
        <el-empty description="暂无订单" />
      </template>
      <el-table-column prop="orderNo" label="订单编号" min-width="180" show-overflow-tooltip />
      <el-table-column prop="subOrderId" label="子订单" width="100" />
      <el-table-column label="状态" width="110">
        <template #default="{ row }">
          <el-tag :type="getStatusTagType(row.status)">{{ getStatusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="商品" min-width="260">
        <template #default="{ row }">
          <div v-if="getItems(row).length" class="items">
            <div v-for="item in getItems(row)" :key="item.skuId" class="item-line">
              <span class="item-title">{{ item.title || '-' }}</span>
              <span class="item-meta">{{ formatPrice(item.price) }} × {{ item.quantity || 0 }}</span>
            </div>
          </div>
          <span v-else>-</span>
        </template>
      </el-table-column>
      <el-table-column label="金额" width="110">
        <template #default="{ row }">{{ formatOrderAmount(row.items) }}</template>
      </el-table-column>
      <el-table-column label="收货信息" min-width="260">
        <template #default="{ row }">
          <div class="address">
            <div>{{ getAddress(row).receiverName || '-' }} / {{ getAddress(row).phone || '-' }}</div>
            <div class="muted">{{ getAddress(row).fullAddress || '-' }}</div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="170">
        <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="物流" min-width="180">
        <template #default="{ row }">
          <div v-if="getShipment(row)">
            <div>{{ getShipment(row).logisticsCompany || '-' }}</div>
            <div class="muted">{{ getShipment(row).trackingNo || '-' }}</div>
            <div class="muted">{{ formatTime(getShipment(row).shippedAt) }}</div>
          </div>
          <span v-else class="muted">未发货</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.status === 'PENDING_SHIPMENT'" link type="primary" @click="showShipPlaceholder">发货</el-button>
          <span v-else class="muted">-</span>
        </template>
      </el-table-column>
    </el-table>

    <div class="summary">共 {{ total }} 条订单</div>
  </el-card>
</template>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.status-filter { width: 180px; }
.items { display: flex; flex-direction: column; gap: 6px; }
.item-line { display: flex; justify-content: space-between; gap: 12px; }
.item-title { color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item-meta { flex: none; color: #666; }
.address { line-height: 1.5; }
.muted { color: #999; }
.summary {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
  color: #666;
}
</style>
