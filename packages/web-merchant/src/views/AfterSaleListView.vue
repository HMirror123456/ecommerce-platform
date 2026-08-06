<script setup>
import { computed, onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { auditAfterSale, getAfterSales } from '@/api/merchant';

const AFTER_SALE_STATUS_OPTIONS = [
  { label: '待商家处理', value: 'APPLIED', type: 'warning' },
  { label: '商家已同意', value: 'APPROVED', type: 'success' },
  { label: '商家已拒绝', value: 'REJECTED', type: 'danger' },
  { label: '待平台仲裁', value: 'ESCALATED', type: 'primary' },
  { label: '用户退货中', value: 'RETURNING', type: 'info' },
  { label: '已退款', value: 'REFUNDED', type: 'success' },
];

const AFTER_SALE_TYPE_LABELS = {
  REFUND_ONLY: '仅退款',
  RETURN_REFUND: '退货退款',
};

const loading = ref(false);
const list = ref([]);
const total = ref(0);
const keyword = ref('');
const status = ref('');
const processingId = ref(null);

const statusMap = AFTER_SALE_STATUS_OPTIONS.reduce((map, item) => {
  map[item.value] = item;
  return map;
}, {});

const filteredList = computed(() => {
  const q = keyword.value.trim().toLowerCase();
  const rows = list.value.filter((row) => {
    const matchStatus = !status.value || row.status === status.value;
    if (!q) return matchStatus;

    const searchable = [
      row.afterSaleId,
      row.id,
      row.orderNo,
      row.orderId,
      row.subOrderId,
      row.reason,
      row.auditReason,
      row.rejectReason,
      ...getItems(row).map((item) => item.title),
    ]
      .filter((value) => value != null && value !== '')
      .map((value) => String(value).toLowerCase());

    return matchStatus && searchable.some((value) => value.includes(q));
  });
  return sortAfterSales(rows);
});

function getSortId(row) {
  const value = row?.afterSaleId ?? row?.id ?? 0;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function sortAfterSales(rows) {
  return [...rows].sort((a, b) => getSortId(a) - getSortId(b));
}

function formatTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN');
}

function formatPrice(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return '-';
  return `¥${numberValue.toFixed(2)}`;
}

function getStatusLabel(value) {
  return statusMap[value]?.label || value || '-';
}

function getStatusTagType(value) {
  return statusMap[value]?.type || 'info';
}

function getTypeLabel(value) {
  return AFTER_SALE_TYPE_LABELS[value] || value || '-';
}

function getItems(row) {
  return Array.isArray(row?.items) ? row.items : [];
}

async function loadAfterSales() {
  loading.value = true;
  try {
    const data = await getAfterSales();
    const rows = Array.isArray(data) ? data : Array.isArray(data?.list) ? data.list : [];
    list.value = sortAfterSales(rows);
    total.value = Number(data?.total) || rows.length;
  } catch (e) {
    ElMessage.error(e.message || '加载售后单失败');
    list.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  keyword.value = '';
  status.value = '';
}

async function approve(row) {
  if (!row?.afterSaleId || processingId.value) return;
  try {
    await ElMessageBox.confirm('确认同意该售后申请？', '同意售后', {
      confirmButtonText: '同意',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }

  processingId.value = row.afterSaleId;
  try {
    const data = await auditAfterSale(row.afterSaleId, { approved: true });
    ElMessage.success(data?.message || '售后处理成功');
    await loadAfterSales();
  } catch (e) {
    ElMessage.error(e.message || '处理售后失败');
  } finally {
    processingId.value = null;
  }
}

async function reject(row) {
  if (!row?.afterSaleId || processingId.value) return;
  let reason = '';
  try {
    const result = await ElMessageBox.prompt('请填写拒绝原因', '拒绝售后', {
      confirmButtonText: '确认拒绝',
      cancelButtonText: '取消',
      inputType: 'textarea',
      inputValidator: (value) => !!String(value || '').trim(),
      inputErrorMessage: '拒绝原因不能为空',
      type: 'warning',
    });
    reason = result.value.trim();
  } catch {
    return;
  }

  processingId.value = row.afterSaleId;
  try {
    const data = await auditAfterSale(row.afterSaleId, { approved: false, reason });
    ElMessage.success(data?.message || '售后处理成功');
    await loadAfterSales();
  } catch (e) {
    ElMessage.error(e.message || '处理售后失败');
  } finally {
    processingId.value = null;
  }
}

onMounted(loadAfterSales);
</script>

<template>
  <el-card shadow="never">
    <template #header>
      <div class="card-header">
        <div>
          <div class="title">售后处理</div>
          <div class="description">处理待商家审核的售后申请，平台仲裁单仅展示</div>
        </div>
      </div>
    </template>

    <div class="filter-bar">
      <el-input
        v-model="keyword"
        clearable
        class="keyword-input"
        placeholder="搜索售后单号、订单号、子订单号、商品名或申请原因"
      />
      <el-select v-model="status" clearable placeholder="全部状态" class="status-filter">
        <el-option label="全部" value="" />
        <el-option
          v-for="item in AFTER_SALE_STATUS_OPTIONS"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
      <el-button @click="resetFilters">重置</el-button>
    </div>

    <el-table v-loading="loading" :data="filteredList" stripe>
      <template #empty>
        <el-empty description="暂无符合条件的售后单" />
      </template>
      <el-table-column prop="afterSaleId" label="售后单号" width="100" />
      <el-table-column prop="orderNo" label="订单号" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">{{ row.orderNo || row.orderId || '-' }}</template>
      </el-table-column>
      <el-table-column prop="subOrderId" label="子订单号" width="110" />
      <el-table-column label="售后类型" width="110">
        <template #default="{ row }">{{ getTypeLabel(row.type) }}</template>
      </el-table-column>
      <el-table-column label="商品" min-width="240">
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
      <el-table-column prop="reason" label="申请原因" min-width="180" show-overflow-tooltip />
      <el-table-column label="状态" width="130">
        <template #default="{ row }">
          <el-tag :type="getStatusTagType(row.status)">{{ getStatusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="申请时间" width="170">
        <template #default="{ row }">{{ formatTime(row.appliedAt) }}</template>
      </el-table-column>
      <el-table-column label="处理截止" width="170">
        <template #default="{ row }">{{ formatTime(row.merchantDeadline) }}</template>
      </el-table-column>
      <el-table-column label="处理原因" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">{{ row.auditReason || row.rejectReason || '-' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="140" fixed="right">
        <template #default="{ row }">
          <template v-if="row.status === 'APPLIED'">
            <el-button link type="success" :loading="processingId === row.afterSaleId" @click="approve(row)">同意</el-button>
            <el-button link type="danger" :disabled="!!processingId" @click="reject(row)">拒绝</el-button>
          </template>
          <span v-else class="muted">-</span>
        </template>
      </el-table-column>
    </el-table>

    <div class="summary">共 {{ filteredList.length }} / {{ total }} 条售后单</div>
  </el-card>
</template>

<style scoped>
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
.filter-bar {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.keyword-input {
  width: 420px;
}
.status-filter {
  width: 180px;
}
.items { display: flex; flex-direction: column; gap: 6px; }
.item-line { display: flex; justify-content: space-between; gap: 12px; }
.item-title { color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item-meta { flex: none; color: #666; }
.muted { color: #999; }
.summary {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
  color: #666;
}
</style>
