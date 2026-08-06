<script setup>
import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useRouter } from 'vue-router';
import { fetchMerchantProducts, submitMerchantProductAudit } from '@/api/merchant';

const PRODUCT_STATUS_OPTIONS = [
  { label: '草稿', value: 'DRAFT', type: 'info' },
  { label: '待审核', value: 'PENDING_AUDIT', type: 'warning' },
  { label: '已上架', value: 'ON_SHELF', type: 'success' },
  { label: '已驳回', value: 'REJECTED', type: 'danger' },
  { label: '已下架', value: 'OFF_SHELF', type: 'info' },
];

const loading = ref(false);
const products = ref([]);
const total = ref(0);
const submittingSpuId = ref(null);
const router = useRouter();

const statusMap = PRODUCT_STATUS_OPTIONS.reduce((map, item) => {
  map[item.value] = item;
  return map;
}, {});

function formatTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN');
}

function getStatusLabel(value) {
  return statusMap[value]?.label || value || '-';
}

function getStatusTagType(value) {
  return statusMap[value]?.type || 'info';
}

function getSkus(row) {
  return Array.isArray(row?.skus) ? row.skus : [];
}

function getStockSummary(row) {
  const skus = getSkus(row);
  return skus.reduce(
    (summary, sku) => {
      summary.available += Number(sku?.stock?.available || 0);
      summary.locked += Number(sku?.stock?.locked || 0);
      return summary;
    },
    { available: 0, locked: 0 },
  );
}

async function loadProducts() {
  loading.value = true;
  try {
    const data = await fetchMerchantProducts();
    products.value = Array.isArray(data?.list) ? data.list : [];
    total.value = Number(data?.total) || 0;
  } catch (e) {
    ElMessage.error(e.message || '加载商品失败');
    products.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

function canSubmitAudit(status) {
  return status === 'DRAFT' || status === 'REJECTED';
}

function getSubmitAuditLabel(status) {
  return status === 'REJECTED' ? '重新提交审核' : '提交审核';
}

async function confirmSubmitAudit(row) {
  if (!row?.spuId || submittingSpuId.value) return;

  const isResubmit = row.status === 'REJECTED';
  const confirmMessage = isResubmit
    ? `平台驳回原因：${row.rejectReason || '未填写'}\n\n确认修改后重新提交审核？`
    : '确认将该商品提交平台审核？提交后将进入待审核状态。';
  const confirmTitle = isResubmit ? '重新提交审核确认' : '提交审核确认';
  const confirmButtonText = isResubmit ? '重新提交审核' : '提交审核';

  try {
    await ElMessageBox.confirm(confirmMessage, confirmTitle, {
      confirmButtonText,
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }

  submittingSpuId.value = row.spuId;
  try {
    const data = await submitMerchantProductAudit(row.spuId);
    ElMessage.success(data?.message || '提交审核成功');
    await loadProducts();
  } catch (e) {
    ElMessage.error(e.message || '提交审核失败');
  } finally {
    submittingSpuId.value = null;
  }
}

onMounted(loadProducts);
</script>

<template>
  <el-card shadow="never">
    <template #header>
      <div class="card-header">
        <div>
          <div class="title">商品管理</div>
          <div class="description">管理商家已创建的商品，并提交平台审核</div>
        </div>
        <el-button type="primary" @click="router.push({ name: 'product-create' })">发布商品</el-button>
      </div>
    </template>

    <el-table v-loading="loading" :data="products" stripe>
      <template #empty>
        <el-empty description="暂无商品" />
      </template>
      <el-table-column prop="spuId" label="商品ID" width="100" />
      <el-table-column prop="title" label="商品标题" min-width="220" show-overflow-tooltip />
      <el-table-column label="分类ID" width="100">
        <template #default="{ row }">{{ row.categoryId ?? '-' }}</template>
      </el-table-column>
      <el-table-column label="商品状态" width="110">
        <template #default="{ row }">
          <el-tag :type="getStatusTagType(row.status)">{{ getStatusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="驳回原因" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">
          <span v-if="row.status === 'REJECTED' && row.rejectReason" class="reject-reason">
            {{ row.rejectReason }}
          </span>
          <span v-else class="muted">-</span>
        </template>
      </el-table-column>
      <el-table-column label="SKU数量" width="100">
        <template #default="{ row }">{{ getSkus(row).length }}</template>
      </el-table-column>
      <el-table-column label="库存信息" min-width="160">
        <template #default="{ row }">
          <div class="stock">
            <span>可用 {{ getStockSummary(row).available }}</span>
            <span class="muted">锁定 {{ getStockSummary(row).locked }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column label="提交审核时间" width="180">
        <template #default="{ row }">{{ formatTime(row.submittedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="canSubmitAudit(row.status)"
            link
            type="primary"
            :loading="submittingSpuId === row.spuId"
            @click="confirmSubmitAudit(row)"
          >
            {{ getSubmitAuditLabel(row.status) }}
          </el-button>
          <span v-else class="muted">-</span>
        </template>
      </el-table-column>
    </el-table>

    <div class="summary">共 {{ total }} 个商品</div>
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
.stock {
  display: flex;
  flex-direction: column;
  gap: 4px;
  line-height: 1.4;
}
.muted { color: #999; }
.reject-reason { color: #f56c6c; }
.summary {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
  color: #666;
}
</style>
