<script setup>
import { computed, onMounted, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { arbitrateAfterSale, fetchAdminAfterSales } from '@/api/admin';

const TYPE_LABELS = {
  REFUND_ONLY: '仅退款',
  RETURN_REFUND: '退货退款',
};

const STATUS_META = {
  ESCALATED: { label: '待仲裁', type: 'danger' },
  REFUNDED: { label: '已退款', type: 'success' },
  REJECTED: { label: '已拒绝', type: 'info' },
  APPROVED: { label: '已同意', type: 'success' },
  APPLIED: { label: '待商家处理', type: 'warning' },
  RETURNING: { label: '退货中', type: 'warning' },
};

const activeTab = ref('pending');
const loading = ref(false);
const list = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(20);
const actionLoading = ref(false);

const rejectVisible = ref(false);
const rejectReason = ref('');
const rejectTargetId = ref(null);

const isPending = computed(() => activeTab.value === 'pending');

function statusQuery() {
  if (activeTab.value === 'pending') return 'ESCALATED';
  if (activeTab.value === 'completed') return 'COMPLETED';
  return 'ALL';
}

function formatTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN');
}

function formatItems(items) {
  if (!Array.isArray(items) || !items.length) return '-';
  return items.map((i) => `${i.title || `SKU ${i.skuId}`}×${i.quantity}`).join('；');
}

function statusMeta(status) {
  return STATUS_META[status] || { label: status || '-', type: 'info' };
}

async function loadList() {
  loading.value = true;
  try {
    const data = await fetchAdminAfterSales({
      status: statusQuery(),
      page: page.value,
      pageSize: pageSize.value,
    });
    list.value = data.list || [];
    total.value = data.total || 0;
  } catch (e) {
    ElMessage.error(e.message || '加载失败');
  } finally {
    loading.value = false;
  }
}

function onTabChange() {
  page.value = 1;
  loadList();
}

async function handleApprove(row) {
  try {
    await ElMessageBox.confirm(
      `确认同意工单 #${row.afterSaleId}？仅退款将直接退款；退货退款将等待用户寄回。`,
      '平台仲裁同意',
      { type: 'success', confirmButtonText: '同意' },
    );
    actionLoading.value = true;
    const result = await arbitrateAfterSale(row.afterSaleId, true, '平台仲裁同意');
    ElMessage.success(
      result?.status === 'APPROVED' ? '已同意，等待用户寄回' : '已裁定同意，售后已退款',
    );
    await loadList();
  } catch (e) {
    if (e !== 'cancel' && e?.message) ElMessage.error(e.message);
  } finally {
    actionLoading.value = false;
  }
}

function openReject(row) {
  rejectTargetId.value = row.afterSaleId;
  rejectReason.value = '';
  rejectVisible.value = true;
}

async function submitReject() {
  if (!rejectReason.value.trim()) {
    ElMessage.warning('请填写拒绝原因');
    return;
  }
  actionLoading.value = true;
  try {
    await arbitrateAfterSale(rejectTargetId.value, false, rejectReason.value.trim());
    ElMessage.success('已裁定拒绝');
    rejectVisible.value = false;
    await loadList();
  } catch (e) {
    ElMessage.error(e.message || '操作失败');
  } finally {
    actionLoading.value = false;
  }
}

watch(page, () => loadList());
onMounted(loadList);
</script>

<template>
  <el-card shadow="never">
    <template #header>
      <div class="card-header">
        <span>售后仲裁</span>
        <el-tag type="info">待仲裁可裁定 · 已完成只读</el-tag>
      </div>
    </template>

    <el-tabs v-model="activeTab" @tab-change="onTabChange">
      <el-tab-pane label="待仲裁" name="pending" />
      <el-tab-pane label="已完成" name="completed" />
      <el-tab-pane label="全部" name="all" />
    </el-tabs>

    <el-table
      v-loading="loading"
      :data="list"
      stripe
      :empty-text="isPending ? '暂无待仲裁售后' : '暂无售后记录'"
    >
      <el-table-column prop="afterSaleId" label="工单ID" width="90" />
      <el-table-column prop="orderNo" label="订单号" min-width="140" show-overflow-tooltip />
      <el-table-column prop="shopName" label="店铺" width="120" show-overflow-tooltip />
      <el-table-column label="类型" width="110">
        <template #default="{ row }">{{ TYPE_LABELS[row.type] || row.type }}</template>
      </el-table-column>
      <el-table-column v-if="!isPending" label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusMeta(row.status).type" size="small">
            {{ statusMeta(row.status).label }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="reason" label="申请原因" min-width="160" show-overflow-tooltip />
      <el-table-column label="商品" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">{{ formatItems(row.items) }}</template>
      </el-table-column>
      <el-table-column label="申请时间" width="170">
        <template #default="{ row }">{{ formatTime(row.appliedAt) }}</template>
      </el-table-column>
      <el-table-column v-if="isPending" label="商家处理截止" width="170">
        <template #default="{ row }">{{ formatTime(row.merchantDeadline) }}</template>
      </el-table-column>
      <el-table-column v-if="!isPending" label="处理时间" width="170">
        <template #default="{ row }">{{ formatTime(row.auditedAt) }}</template>
      </el-table-column>
      <el-table-column v-if="!isPending" label="处理说明" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">{{ row.auditReason || '-' }}</template>
      </el-table-column>
      <el-table-column v-if="isPending" label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button link type="success" :disabled="actionLoading" @click="handleApprove(row)">同意</el-button>
          <el-button link type="danger" :disabled="actionLoading" @click="openReject(row)">拒绝</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pager">
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
      />
    </div>
  </el-card>

  <el-dialog v-model="rejectVisible" title="平台仲裁拒绝" width="420px">
    <el-form label-position="top">
      <el-form-item label="拒绝原因" required>
        <el-input
          v-model="rejectReason"
          type="textarea"
          :rows="4"
          placeholder="请说明拒绝原因，用户将看到该说明"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="rejectVisible = false">取消</el-button>
      <el-button type="danger" :loading="actionLoading" @click="submitReject">确认拒绝</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.card-header { display: flex; align-items: center; justify-content: space-between; }
.pager { margin-top: 16px; display: flex; justify-content: flex-end; }
</style>
