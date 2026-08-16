<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useRoute, useRouter } from 'vue-router';
import {
  auditAfterSale,
  confirmAfterSaleReturn,
  getAfterSales,
  getMerchantAfterSaleChatThread,
  fetchMerchantChatThreads,
  notifyMerchantChatUnreadChanged,
} from '@/api/merchant';
import AfterSaleChatDrawer from '@/components/AfterSaleChatDrawer.vue';
import { getAfterSaleCommunicationMode } from '@/utils/afterSaleCommunication';

const AFTER_SALE_STATUS_OPTIONS = [
  { label: '待商家处理', value: 'APPLIED', type: 'warning' },
  { label: '等待用户寄回', value: 'APPROVED', type: 'success' },
  { label: '售后已拒绝', value: 'REJECTED', type: 'danger' },
  { label: '平台仲裁中', value: 'ESCALATED', type: 'primary' },
  { label: '用户已寄回', value: 'RETURNING', type: 'info' },
  { label: '退款已完成', value: 'REFUNDED', type: 'success' },
];

const route = useRoute();
const router = useRouter();

const AFTER_SALE_TYPE_LABELS = {
  REFUND_ONLY: '仅退款',
  RETURN_REFUND: '退货退款',
};

const loading = ref(false);
const list = ref([]);
const total = ref(0);
const keyword = ref('');
const status = ref('');
const page = ref(1);
const pageSize = ref(10);
const processingId = ref(null);
const chatAfterSaleId = ref(null);
const chatThread = ref(null);
const chatVisible = ref(false);
const chatUnreadByAfterSaleId = ref({});

const statusMap = AFTER_SALE_STATUS_OPTIONS.reduce((map, item) => {
  map[item.value] = item;
  return map;
}, {});

function normalizeAfterSaleSearch(query) {
  const value = String(query || '').replace(/\s+/g, '');
  const afterSaleIdMatch = value.match(/^(?:售后单)?#?(\d+)$/);
  if (afterSaleIdMatch) {
    return { afterSaleId: Number(afterSaleIdMatch[1]), keyword: '' };
  }
  return { afterSaleId: null, keyword: value.toLowerCase() };
}

const filteredList = computed(() => {
  const search = normalizeAfterSaleSearch(keyword.value);
  const rows = list.value.filter((row) => {
    const matchStatus = !status.value || row.status === status.value;
    if (!matchStatus) return false;
    if (search.afterSaleId != null) return Number(row.afterSaleId) === search.afterSaleId;
    if (!search.keyword) return true;

    const searchable = [
      row.orderNo,
      row.orderId,
      row.subOrderId,
      ...getItems(row).map((item) => item.title),
    ]
      .filter((value) => value != null && value !== '')
      .map((value) => String(value).toLowerCase());

    return searchable.some((value) => value.includes(search.keyword));
  });
  return sortAfterSales(rows);
});

const paginatedList = computed(() => {
  const start = (page.value - 1) * pageSize.value;
  return filteredList.value.slice(start, start + pageSize.value);
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

function getStatusDescription(row) {
  if (row?.status === 'APPLIED') return '请在处理截止前审核该售后申请';
  if (row?.status === 'APPROVED' && row?.type === 'RETURN_REFUND') return '已同意退货退款，等待用户填写寄回物流并寄回商品';
  if (row?.status === 'APPROVED') return '商家已同意，仅退款将由系统继续处理';
  if (row?.status === 'RETURNING') return '用户已寄回商品，等待商家验收后退款';
  if (row?.status === 'REFUNDED' && row?.type === 'RETURN_REFUND') return '退货验收通过，退款已完成';
  if (row?.status === 'REFUNDED') return '退款已完成';
  if (row?.status === 'ESCALATED') return '该售后由平台仲裁，商家不可继续处理';
  if (row?.status === 'REJECTED') return '商家已拒绝，等待用户是否继续沟通或申请平台介入。';
  return '-';
}

function getTypeLabel(value) {
  return AFTER_SALE_TYPE_LABELS[value] || value || '-';
}

function getItems(row) {
  return Array.isArray(row?.items) ? row.items : [];
}

function getReasonText(row) {
  return row?.reason || '-';
}

function getReturnShipment(row) {
  const shipment = row?.returnShipment;
  if (!shipment) return null;
  if (typeof shipment === 'string') {
    try {
      const parsed = JSON.parse(shipment);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }
  return typeof shipment === 'object' ? shipment : null;
}

function getTimelineSteps(row) {
  const isReturnRefund = row?.type === 'RETURN_REFUND';
  const status = row?.status;
  const shipment = getReturnShipment(row);
  const applied = { label: '提交申请', state: 'done', time: row?.appliedAt };
  const audit = {
    label: '商家审核',
    state: status === 'APPLIED' ? 'current' : 'done',
    time: row?.auditedAt,
  };

  if (status === 'REJECTED') {
    return [
      applied,
      {
        label: '商家审核：已拒绝',
        state: 'rejected',
        time: row?.auditedAt,
        note: row?.auditReason || row?.rejectReason || '商家已拒绝该售后申请',
      },
    ];
  }

  if (status === 'ESCALATED') {
    return [
      applied,
      {
        label: '平台仲裁中',
        state: 'current',
        time: row?.escalatedAt,
        note: '请等待平台处理，商家暂不可继续处理。',
      },
    ];
  }

  if (!isReturnRefund) {
    const refundState = status === 'REFUNDED' ? 'done' : status === 'APPROVED' ? 'current' : 'pending';
    return [
      applied,
      audit,
      { label: '退款完成', state: refundState },
    ];
  }

  const returningState = status === 'APPROVED' ? 'current' : ['RETURNING', 'REFUNDED'].includes(status) ? 'done' : 'pending';
  const acceptanceState = status === 'RETURNING' ? 'current' : status === 'REFUNDED' ? 'done' : 'pending';
  const refundedState = status === 'REFUNDED' ? 'done' : 'pending';
  return [
    applied,
    audit,
    { label: '用户寄回', state: returningState, time: shipment?.shippedAt },
    { label: '商家验收', state: acceptanceState },
    { label: '退款完成', state: refundedState },
  ];
}

function getTimelineStateLabel(state) {
  if (state === 'done') return '已完成';
  if (state === 'current') return '当前';
  if (state === 'rejected') return '已拒绝';
  return '待处理';
}

function getOperationHint(row) {
  if (row?.status === 'ESCALATED') return '等待平台处理';
  if (row?.status === 'APPROVED' && row?.type === 'RETURN_REFUND') return '等待用户寄回';
  if (row?.status === 'REFUNDED') return '已退款';
  return '';
}

function getCommunicationMode(row) {
  return getAfterSaleCommunicationMode(row);
}

function getAfterSaleUnreadCount(row) {
  return Number(chatUnreadByAfterSaleId.value[row?.afterSaleId]) || 0;
}

async function loadChatUnreadCounts() {
  try {
    const data = await fetchMerchantChatThreads({});
    chatUnreadByAfterSaleId.value = (data?.list || []).reduce((counts, thread) => {
      if (!thread.afterSaleId) return counts;
      counts[thread.afterSaleId] = (counts[thread.afterSaleId] || 0) + (Number(thread.unreadCount) || 0);
      return counts;
    }, {});
  } catch {
    chatUnreadByAfterSaleId.value = {};
  }
}

async function loadAfterSales() {
  loading.value = true;
  try {
    const data = await getAfterSales();
    const rows = Array.isArray(data) ? data : Array.isArray(data?.list) ? data.list : [];
    list.value = sortAfterSales(rows);
    total.value = Number(data?.total) || rows.length;
    await loadChatUnreadCounts();
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
  page.value = 1;
  router.replace({ path: '/after-sales' });
}

function handlePageChange(value) {
  page.value = value;
}

function handlePageSizeChange(value) {
  pageSize.value = value;
  page.value = 1;
}

function getReturnProgress(row) {
  if (row?.type !== 'RETURN_REFUND') return '';
  if (row.status === 'APPROVED') return '待用户寄回商品';
  if (row.status === 'RETURNING') return '已寄回，待商家验收';
  if (row.status === 'REFUNDED') return '退货验收通过，退款已完成';
  return '';
}

async function openChat(row) {
  if (!row?.afterSaleId) return;
  const communicationMode = getCommunicationMode(row);
  try {
    const thread = await getMerchantAfterSaleChatThread(Number(row.afterSaleId));
    chatAfterSaleId.value = null;
    chatThread.value = thread;
    chatVisible.value = true;
  } catch (e) {
    if (communicationMode.openMethod === 'GET_HISTORY') {
      ElMessage.info(e.message || '暂无可查看的历史沟通记录');
      return;
    }
    chatThread.value = null;
    chatAfterSaleId.value = Number(row.afterSaleId);
    chatVisible.value = true;
  }
}

async function handleChatRead() {
  notifyMerchantChatUnreadChanged();
  await loadChatUnreadCounts();
}

async function approve(row) {
  if (!row?.afterSaleId || processingId.value) return;
  if (row.status !== 'APPLIED') {
    ElMessage.warning('当前售后状态不允许同意');
    return;
  }
  try {
    await ElMessageBox.confirm(
      row.type === 'RETURN_REFUND'
        ? '确认同意该退货退款申请？同意后需等待用户寄回商品。'
        : '确认同意该仅退款申请？同意后将直接退款。',
      '同意售后',
      {
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
  if (row.status !== 'APPLIED') {
    ElMessage.warning('当前售后状态不允许拒绝');
    return;
  }
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

async function confirmReturn(row) {
  if (!row?.afterSaleId || processingId.value) return;
  if (row.status !== 'RETURNING') {
    ElMessage.warning('仅退货中售后可以验收退款');
    return;
  }
  try {
    await ElMessageBox.confirm(
      '确认已收到退货并完成验收？确认后将退款并回滚库存。',
      '验收通过并退款',
      { confirmButtonText: '确认退款', cancelButtonText: '取消', type: 'warning' },
    );
  } catch {
    return;
  }

  processingId.value = row.afterSaleId;
  try {
    const data = await confirmAfterSaleReturn(row.afterSaleId);
    ElMessage.success(data?.message || '验收通过，已退款');
    await loadAfterSales();
  } catch (e) {
    ElMessage.error(e.message || '验收失败');
  } finally {
    processingId.value = null;
  }
}

watch([keyword, status], () => {
  page.value = 1;
});

watch(
  () => [route.query.afterSaleId, route.query.orderNo],
  ([afterSaleId, orderNo]) => {
    keyword.value = afterSaleId ? `#${afterSaleId}` : orderNo ? String(orderNo) : '';
  },
);

onMounted(() => {
  status.value = route.query.status || '';
  keyword.value = route.query.afterSaleId ? `#${route.query.afterSaleId}` : route.query.orderNo ? String(route.query.orderNo) : '';
  loadAfterSales();
});
</script>

<template>
  <el-card shadow="never">
    <template #header>
      <div class="card-header">
        <div>
          <div class="title">售后处理</div>
          <div class="description">处理待审售后；退货中可验收退款；已同意退货请等待用户寄回</div>
        </div>
      </div>
    </template>

    <div class="filter-bar">
      <el-input
        v-model="keyword"
        clearable
        class="keyword-input"
        placeholder="搜索售后单号、订单号、子订单号或商品名"
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

    <el-table v-loading="loading" :data="paginatedList" stripe>
      <template #empty>
        <el-empty description="未找到匹配的售后单，请调整搜索或筛选条件" />
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
      <el-table-column label="申请原因" min-width="220" show-overflow-tooltip>
        <template #default="{ row }">
          <el-tooltip :content="getReasonText(row)" placement="top" :disabled="getReasonText(row) === '-'">
            <span class="reason-text">{{ getReasonText(row) }}</span>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column label="售后状态" min-width="210">
        <template #default="{ row }">
          <el-tag :type="getStatusTagType(row.status)">{{ getStatusLabel(row.status) }}</el-tag>
          <div class="status-description">{{ getStatusDescription(row) }}</div>
        </template>
      </el-table-column>
      <el-table-column label="沟通状态" min-width="180">
        <template #default="{ row }">
          <el-tag :type="getCommunicationMode(row).isReadOnly ? 'info' : 'primary'" size="small">
            {{ getCommunicationMode(row).displayText }}
          </el-tag>
          <el-tag v-if="getAfterSaleUnreadCount(row)" type="danger" size="small" class="unread-tag">
            未读 {{ getAfterSaleUnreadCount(row) }} 条
          </el-tag>
          <div v-if="getCommunicationMode(row).needsMerchantAction" class="communication-tip">
            {{ getCommunicationMode(row).merchantActionText }}
          </div>
        </template>
      </el-table-column>
      <el-table-column label="售后进度" min-width="250">
        <template #default="{ row }">
          <div class="after-sale-timeline">
            <div
              v-for="(step, index) in getTimelineSteps(row)"
              :key="`${row.afterSaleId}-${step.label}`"
              class="timeline-step"
              :class="`is-${step.state}`"
            >
              <span class="timeline-index">{{ index + 1 }}</span>
              <div class="timeline-content">
                <div class="timeline-title-row">
                  <span>{{ step.label }}</span>
                  <span class="timeline-state">{{ getTimelineStateLabel(step.state) }}</span>
                </div>
                <div v-if="step.time" class="timeline-time">{{ formatTime(step.time) }}</div>
                <div v-if="step.note" class="timeline-note">{{ step.note }}</div>
              </div>
            </div>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="申请时间" width="170">
        <template #default="{ row }">{{ formatTime(row.appliedAt) }}</template>
      </el-table-column>
      <el-table-column label="处理截止" width="170">
        <template #default="{ row }">{{ formatTime(row.merchantDeadline) }}</template>
      </el-table-column>
      <el-table-column label="用户寄回信息" min-width="230">
        <template #default="{ row }">
          <div v-if="getReturnProgress(row)" class="return-progress">{{ getReturnProgress(row) }}</div>
          <div v-if="getReturnShipment(row)" class="shipment-info">
            <div>物流公司：{{ getReturnShipment(row).logisticsCompany || '-' }}</div>
            <div>物流单号：{{ getReturnShipment(row).trackingNo || '-' }}</div>
            <div>寄回时间：{{ formatTime(getReturnShipment(row).shippedAt) }}</div>
          </div>
          <span v-else class="muted">{{ row.type === 'RETURN_REFUND' ? '用户暂未填写寄回物流' : '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="处理原因" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">{{ row.auditReason || row.rejectReason || '-' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="250" fixed="right">
        <template #default="{ row }">
          <div class="after-sale-actions">
            <template v-if="row.status === 'APPLIED'">
              <el-button
                link
                type="success"
                :disabled="!!processingId && processingId !== row.afterSaleId"
                :loading="processingId === row.afterSaleId"
                @click="approve(row)"
              >
                同意
              </el-button>
              <el-button
                link
                type="danger"
                :disabled="!!processingId && processingId !== row.afterSaleId"
                :loading="processingId === row.afterSaleId"
                @click="reject(row)"
              >
                拒绝
              </el-button>
            </template>
            <template v-else-if="row.status === 'RETURNING'">
              <el-button
                link
                type="primary"
                :disabled="!!processingId && processingId !== row.afterSaleId"
                :loading="processingId === row.afterSaleId"
                @click="confirmReturn(row)"
              >
                验收通过并退款
              </el-button>
            </template>
            <span v-if="getOperationHint(row)" class="muted">{{ getOperationHint(row) }}</span>
            <el-button link type="primary" @click="openChat(row)">{{ getCommunicationMode(row).actionLabel }}</el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-bar">
      <div class="summary">筛选 {{ filteredList.length }} 条，共 {{ total }} 条售后单</div>
      <el-pagination
        :current-page="page"
        :page-size="pageSize"
        :page-sizes="[10, 20, 50]"
        :total="filteredList.length"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handlePageSizeChange"
        @current-change="handlePageChange"
      />
    </div>
    <AfterSaleChatDrawer
      v-model="chatVisible"
      :after-sale-id="chatAfterSaleId"
      :initial-thread="chatThread"
      @read="handleChatRead"
    />
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
.reason-text { display: inline-block; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: bottom; }
.status-description { margin-top: 6px; color: #666; font-size: 12px; line-height: 18px; }
.unread-tag { margin-left: 6px; }
.communication-tip { margin-top: 6px; color: #e6a23c; font-size: 12px; line-height: 18px; }
.after-sale-timeline { display: flex; flex-direction: column; gap: 8px; }
.timeline-step { position: relative; display: flex; gap: 8px; min-height: 32px; color: #999; font-size: 12px; }
.timeline-step:not(:last-child)::after {
  position: absolute;
  top: 22px;
  left: 9px;
  width: 1px;
  height: calc(100% - 12px);
  background: #dcdfe6;
  content: '';
}
.timeline-index {
  position: relative;
  z-index: 1;
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #dcdfe6;
  color: #fff;
  font-size: 11px;
}
.timeline-content { min-width: 0; flex: 1; }
.timeline-title-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; line-height: 18px; }
.timeline-state { flex: none; font-size: 11px; }
.timeline-time, .timeline-note { margin-top: 2px; color: #999; line-height: 18px; }
.timeline-note { color: #606266; }
.timeline-step.is-done { color: #67c23a; }
.timeline-step.is-current { color: #409eff; font-weight: 600; }
.timeline-step.is-rejected { color: #f56c6c; }
.timeline-step.is-done .timeline-index { background: #67c23a; }
.timeline-step.is-current .timeline-index { background: #409eff; }
.timeline-step.is-rejected .timeline-index { background: #f56c6c; }
.return-progress { margin-bottom: 5px; color: #409eff; font-size: 12px; font-weight: 600; }
.shipment-info { color: #333; font-size: 13px; line-height: 21px; }
.muted { color: #999; }
.after-sale-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.pagination-bar {
  margin-top: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.summary {
  color: #666;
}
</style>
