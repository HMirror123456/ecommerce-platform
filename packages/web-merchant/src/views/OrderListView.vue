<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useRoute, useRouter } from 'vue-router';
import { fetchMerchantOrders, getAfterSales, shipMerchantOrder } from '@/api/merchant';

const ORDER_STATUS_OPTIONS = [
  { label: '待支付', value: 'PENDING_PAYMENT' },
  { label: '已支付', value: 'PAID' },
  { label: '待发货', value: 'PENDING_SHIPMENT' },
  { label: '已发货', value: 'SHIPPED' },
  { label: '用户已确认收货 / 交易完成', value: 'COMPLETED' },
  { label: '已取消', value: 'CANCELLED' },
  { label: '售后中', value: 'REFUNDING' },
  { label: '已退款', value: 'REFUNDED' },
];

const loading = ref(false);
const route = useRoute();
const router = useRouter();
const orders = ref([]);
const afterSales = ref([]);
const total = ref(0);
const keyword = ref('');
const statusFilter = ref('');
const page = ref(1);
const pageSize = ref(10);
const shipDialogVisible = ref(false);
const shipFormRef = ref(null);
const shipSubmitting = ref(false);
const shipTarget = ref(null);
const shipForm = ref({ logisticsCompany: '', trackingNo: '' });
const shipRules = {
  logisticsCompany: [{ required: true, message: '请输入物流公司', trigger: 'blur' }],
  trackingNo: [{ required: true, message: '请输入运单号', trigger: 'blur' }],
};

const statusLabelMap = computed(() =>
  ORDER_STATUS_OPTIONS.reduce((map, item) => {
    map[item.value] = item.label;
    return map;
  }, {}),
);

const filteredOrders = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  return orders.value.filter((order) => {
    const matchStatus = !statusFilter.value || order.status === statusFilter.value;
    if (!q) return matchStatus;

    const searchable = [
      order.orderNo,
      order.subOrderId,
      ...getItems(order).map((item) => item.title),
      ...getShippingSearchValues(order),
    ]
      .filter((value) => value != null && value !== '')
      .map((value) => String(value).toLowerCase());

    return matchStatus && searchable.some((value) => value.includes(q));
  });
});

const paginatedOrders = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  return filteredOrders.value.slice(start, start + pageSize.value);
});

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

function getShippingSearchValues(row) {
  const address = getAddress(row);
  const values = [
    row?.receiverInfo,
    row?.shippingInfo,
    row?.address,
    row?.receiver,
    row?.deliveryInfo,
  ];
  if (address && typeof address === 'object') {
    values.push(...Object.values(address));
  } else if (address) {
    values.push(address);
  }
  return values;
}

function getShipment(row) {
  return row?.shipment || null;
}

function getReceiptDescription(row) {
  if (row?.status !== 'COMPLETED') return '';
  const receiptTime = row?.receivedAt || row?.confirmedAt || row?.completedAt;
  return receiptTime ? `用户已确认收货：${formatTime(receiptTime)}` : '用户已确认收货，交易完成';
}

const AFTER_SALE_STATUS_LABELS = {
  APPLIED: '等待商家处理',
  APPROVED: '等待用户寄回',
  RETURNING: '用户已寄回，待商家验收',
  REJECTED: '商家已拒绝',
  ESCALATED: '平台仲裁中',
  REFUNDED: '退款完成',
};

function getAfterSale(row) {
  const subOrderId = Number(row?.subOrderId);
  return afterSales.value.find((item) => Number(item?.subOrderId) === subOrderId)
    || afterSales.value.find((item) => item?.orderNo && item.orderNo === row?.orderNo)
    || null;
}

function getAfterSaleDescription(row) {
  const afterSale = getAfterSale(row);
  if (afterSale) return AFTER_SALE_STATUS_LABELS[afterSale.status] || '售后处理中';
  return row?.status === 'REFUNDING' ? '售后处理中' : '';
}

function getAfterSaleStatusText(row) {
  const afterSale = getAfterSale(row);
  if (afterSale?.status === 'ESCALATED') return '平台仲裁中';
  if (afterSale?.status === 'REFUNDED' || row?.status === 'REFUNDED') return '已退款';
  if (afterSale?.status) return `售后中 · ${getAfterSaleDescription(row)}`;
  return row?.status === 'REFUNDING' ? '售后中' : '-';
}

function getAfterSaleTagType(row) {
  const afterSale = getAfterSale(row);
  if (afterSale?.status === 'ESCALATED') return 'danger';
  if (afterSale?.status === 'REFUNDED' || row?.status === 'REFUNDED') return 'success';
  if (afterSale?.status) return 'warning';
  return 'info';
}

function hasAfterSale(row) {
  return Boolean(getAfterSale(row)) || ['REFUNDING', 'REFUNDED'].includes(row?.status);
}

function viewAfterSale(row) {
  const afterSale = getAfterSale(row);
  router.push({
    path: '/after-sales',
    query: afterSale?.afterSaleId ? { afterSaleId: afterSale.afterSaleId } : { orderNo: row.orderNo },
  });
}

function getReadonlyActionText(status) {
  const textMap = {
    PENDING_PAYMENT: '待用户支付',
    PAID: '待系统流转',
    SHIPPED: '已发货',
    COMPLETED: '已完成',
    CANCELLED: '已取消',
    REFUNDING: '',
    REFUNDED: '已退款',
  };
  return textMap[status] || '-';
}

async function loadOrders() {
  loading.value = true;
  try {
    const [ordersResult, afterSalesResult] = await Promise.allSettled([
      fetchMerchantOrders(),
      getAfterSales(),
    ]);
    if (ordersResult.status !== 'fulfilled') throw ordersResult.reason;
    const data = ordersResult.value;
    orders.value = Array.isArray(data?.list) ? data.list : [];
    total.value = Number(data?.total) || 0;
    const afterSaleData = afterSalesResult.status === 'fulfilled' ? afterSalesResult.value : null;
    afterSales.value = Array.isArray(afterSaleData) ? afterSaleData : afterSaleData?.list || [];
    if (afterSalesResult.status === 'rejected') {
      ElMessage.warning(afterSalesResult.reason?.message || '售后状态加载失败，仍可查看订单');
    }
  } catch (e) {
    ElMessage.error(e.message || '加载订单失败');
    orders.value = [];
    afterSales.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  keyword.value = '';
  statusFilter.value = '';
  page.value = 1;
}

function handlePageChange(value) {
  page.value = value;
}

function handlePageSizeChange(value) {
  pageSize.value = value;
  page.value = 1;
}

function resetShipForm() {
  shipForm.value = { logisticsCompany: '', trackingNo: '' };
  shipFormRef.value?.clearValidate();
}

function openShipDialog(row) {
  shipTarget.value = row;
  shipDialogVisible.value = true;
  resetShipForm();
}

function closeShipDialog() {
  shipDialogVisible.value = false;
  shipTarget.value = null;
  resetShipForm();
}

async function submitShipment() {
  if (shipSubmitting.value) return;
  const valid = await shipFormRef.value?.validate().catch(() => false);
  if (!valid || !shipTarget.value) return;

  shipSubmitting.value = true;
  try {
    await ElMessageBox.confirm(
      `确认发货子订单 ${shipTarget.value.subOrderId}？提交后将写入物流信息并变为已发货。`,
      '确认发货',
      { confirmButtonText: '确认发货', cancelButtonText: '取消', type: 'warning' },
    );
    const data = await shipMerchantOrder(shipTarget.value.subOrderId, {
      logisticsCompany: shipForm.value.logisticsCompany,
      trackingNo: shipForm.value.trackingNo,
    });
    ElMessage.success(data?.message || '发货成功');
    closeShipDialog();
    await loadOrders();
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') {
      ElMessage.error(e.message || '发货失败');
    }
  } finally {
    shipSubmitting.value = false;
  }
}

watch([keyword, statusFilter], () => {
  page.value = 1;
});

onMounted(() => {
  statusFilter.value = route.query.status || '';
  loadOrders();
});
</script>

<template>
  <el-card shadow="never" class="order-page">
    <template #header>
      <div class="card-header">
        <div>
          <div class="title">订单管理</div>
          <div class="description">查看订单履约、物流信息与售后进度</div>
        </div>
      </div>
    </template>

    <div class="filter-bar">
      <el-input
        v-model="keyword"
        clearable
        class="keyword-input"
        placeholder="搜索订单号 / 子订单号 / 商品名 / 收货信息"
      />
      <el-select v-model="statusFilter" clearable placeholder="全部状态" class="status-filter">
        <el-option label="全部" value="" />
        <el-option
          v-for="item in ORDER_STATUS_OPTIONS"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
      <el-button @click="resetFilters">重置</el-button>
    </div>

    <el-table v-loading="loading" :data="paginatedOrders" stripe>
      <template #empty>
        <el-empty description="暂无符合条件的订单" />
      </template>
      <el-table-column label="订单编号" min-width="190" show-overflow-tooltip>
        <template #default="{ row }">
          <span class="order-no" :title="row.orderNo || '-'">{{ row.orderNo || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column prop="subOrderId" label="子订单" width="100" />
      <el-table-column label="状态" min-width="180">
        <template #default="{ row }">
          <el-tag :type="getStatusTagType(row.status)">{{ getStatusLabel(row.status) }}</el-tag>
          <div v-if="getReceiptDescription(row)" class="receipt-description">{{ getReceiptDescription(row) }}</div>
        </template>
      </el-table-column>
      <el-table-column label="售后状态" min-width="180">
        <template #default="{ row }">
          <el-tag v-if="getAfterSaleStatusText(row) !== '-'" :type="getAfterSaleTagType(row)">
            {{ getAfterSaleStatusText(row) }}
          </el-tag>
          <span v-else class="muted">-</span>
        </template>
      </el-table-column>
      <el-table-column label="商品" min-width="260">
        <template #default="{ row }">
          <div v-if="getItems(row).length" class="items">
            <div v-for="item in getItems(row)" :key="item.skuId" class="item-line">
              <span class="item-title">{{ item.title || '-' }}</span>
              <span class="item-meta">{{ formatPrice(item.price) }} x {{ item.quantity || 0 }}</span>
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
      <el-table-column label="操作" width="170" fixed="right">
        <template #default="{ row }">
          <div class="action-list">
            <el-button
              v-if="row.status === 'PENDING_SHIPMENT'"
              link
              type="primary"
              :disabled="shipSubmitting"
              @click="openShipDialog(row)"
            >
              填写物流 / 发货
            </el-button>
            <span v-else-if="row.status !== 'REFUNDING'" class="muted">{{ getReadonlyActionText(row.status) }}</span>
            <el-button v-if="hasAfterSale(row)" link type="primary" @click="viewAfterSale(row)">
              查看售后
            </el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-bar">
      <div class="summary">筛选 {{ filteredOrders.length }} 条，共 {{ total }} 条订单</div>
      <el-pagination
        :current-page="page"
        :page-size="pageSize"
        :page-sizes="[10, 20, 50]"
        :total="filteredOrders.length"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handlePageSizeChange"
        @current-change="handlePageChange"
      />
    </div>
  </el-card>

  <el-dialog v-model="shipDialogVisible" title="订单发货" width="420px" @closed="closeShipDialog">
    <el-descriptions :column="1" border class="ship-info">
      <el-descriptions-item label="订单编号">{{ shipTarget?.orderNo || '-' }}</el-descriptions-item>
      <el-descriptions-item label="子订单ID">{{ shipTarget?.subOrderId || '-' }}</el-descriptions-item>
    </el-descriptions>

    <el-form ref="shipFormRef" :model="shipForm" :rules="shipRules" label-position="top">
      <el-form-item label="物流公司" prop="logisticsCompany">
        <el-input v-model="shipForm.logisticsCompany" />
      </el-form-item>
      <el-form-item label="运单号" prop="trackingNo">
        <el-input v-model="shipForm.trackingNo" />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button :disabled="shipSubmitting" @click="closeShipDialog">取消</el-button>
      <el-button type="primary" :loading="shipSubmitting" @click="submitShipment">确认发货</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.title { color: #1f2937; font-size: 17px; font-weight: 700; line-height: 26px; }
.description { margin-top: 4px; color: #94a3b8; font-size: 13px; }
.filter-bar {
  margin-bottom: 18px;
  display: flex;
  align-items: center;
  gap: 10px 12px;
  flex-wrap: wrap;
}
.keyword-input {
  width: 360px;
}
.status-filter {
  width: 160px;
}
.items { display: flex; flex-direction: column; gap: 7px; }
.item-line { display: flex; justify-content: space-between; gap: 12px; min-width: 0; }
.item-title { color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item-meta { flex: none; color: #666; }
.order-no { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-variant-numeric: tabular-nums; }
.address { line-height: 1.65; min-width: 0; }
.receipt-description { margin-top: 5px; color: #67c23a; font-size: 12px; line-height: 18px; }
.muted { color: #999; }
.action-list { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; min-height: 32px; }
.ship-info { margin-bottom: 18px; }
.pagination-bar {
  margin-top: 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.summary {
  color: #64748b;
}
@media (max-width: 900px) {
  .keyword-input { width: min(100%, 360px); }
}
</style>
