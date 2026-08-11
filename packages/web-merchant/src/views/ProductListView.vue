<script setup>
import { computed, onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useRouter } from 'vue-router';
import {
  batchOffShelfMerchantProducts,
  batchSubmitMerchantProductAudit,
  fetchCategories,
  fetchMerchantProducts,
  offShelfMerchantProduct,
  submitMerchantProductAudit,
  updateMerchantSkuStock,
} from '@/api/merchant';

const PRODUCT_STATUS_OPTIONS = [
  { label: '草稿', value: 'DRAFT', type: 'info' },
  { label: '待审核', value: 'PENDING_AUDIT', type: 'warning' },
  { label: '已上架', value: 'ON_SHELF', type: 'success' },
  { label: '已驳回', value: 'REJECTED', type: 'danger' },
  { label: '已下架', value: 'OFF_SHELF', type: 'info' },
];

const loading = ref(false);
const tableRef = ref(null);
const products = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const selectedRows = ref([]);
const batchSubmitLoading = ref(false);
const batchOffShelfLoading = ref(false);
const submittingSpuId = ref(null);
const offShelvingSpuId = ref(null);
const stockDialogVisible = ref(false);
const stockFormRef = ref(null);
const stockSubmitting = ref(false);
const stockTarget = ref(null);
const stockForm = ref({ available: 0 });
const stockRules = {
  available: [
    {
      validator: (_rule, value, callback) => {
        if (value == null || value === '') {
          callback(new Error('请输入可用库存'));
          return;
        }
        if (!Number.isInteger(Number(value)) || Number(value) < 0) {
          callback(new Error('可用库存必须是不小于 0 的整数'));
          return;
        }
        callback();
      },
      trigger: 'change',
    },
  ],
};
const keyword = ref('');
const categoryFilter = ref('');
const statusFilter = ref('');
const categoryLoading = ref(false);
const categoryOptions = ref([]);
const router = useRouter();

const statusMap = PRODUCT_STATUS_OPTIONS.reduce((map, item) => {
  map[item.value] = item;
  return map;
}, {});

const selectedSpuIds = computed(() => selectedRows.value.map((row) => row.spuId).filter(Boolean));
const selectedSubmitCount = computed(() => selectedRows.value.filter((row) => canSubmitAudit(row.status)).length);
const selectedOffShelfCount = computed(() => selectedRows.value.filter((row) => canOffShelf(row.status)).length);

const imageErrorMap = ref({});

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

function getRejectReason(row) {
  return row?.rejectReason || row?.auditReason || row?.reason || '';
}

function getSkus(row) {
  return Array.isArray(row?.skus) ? row.skus : [];
}

const SKU_SPEC_LABELS = {
  color: '颜色',
  size: '尺寸',
  version: '版本',
  capacity: '容量',
  switch: '轴体',
};

function formatSkuSpec(specJson) {
  const entries = Object.entries(specJson || {});
  if (!entries.length) return '默认规格';
  return entries.map(([key, value]) => `${SKU_SPEC_LABELS[key] || key}：${value}`).join(' / ');
}

function getSkuAvailable(sku) {
  return Number(sku?.stock?.available || 0);
}

function getSkuLocked(sku) {
  return Number(sku?.stock?.locked || 0);
}

function getCategoryLabel(row) {
  return row?.categoryName || (row?.categoryId != null ? String(row.categoryId) : '-');
}

function hasProductImage(row) {
  return Boolean(row?.mainImage) && !imageErrorMap.value[row.spuId];
}

function markImageError(row) {
  if (!row?.spuId) return;
  imageErrorMap.value = {
    ...imageErrorMap.value,
    [row.spuId]: true,
  };
}

function flattenCategoryOptions(nodes, prefix = '') {
  return (nodes || []).flatMap((node) => {
    const label = prefix ? `${prefix} / ${node.name}` : node.name;
    return [
      { value: node.id, label },
      ...flattenCategoryOptions(node.children || [], label),
    ];
  });
}

async function loadCategoryOptions() {
  categoryLoading.value = true;
  try {
    categoryOptions.value = flattenCategoryOptions(await fetchCategories());
  } catch (e) {
    categoryOptions.value = [];
    ElMessage.error(e.message || '加载商品分类失败');
  } finally {
    categoryLoading.value = false;
  }
}

async function loadProducts() {
  loading.value = true;
  try {
    const params = {
      page: page.value,
      pageSize: pageSize.value,
      keyword: keyword.value.trim() || undefined,
      status: statusFilter.value || undefined,
      categoryId: categoryFilter.value || undefined,
    };
    const data = await fetchMerchantProducts(params);
    const rows = Array.isArray(data?.items) ? data.items : Array.isArray(data?.list) ? data.list : [];
    const nextTotal = Number(data?.total) || 0;
    if (!rows.length && nextTotal > 0 && page.value > 1) {
      page.value = Math.max(1, Math.ceil(nextTotal / pageSize.value));
      await loadProducts();
      return;
    }
    products.value = rows;
    total.value = Number(data?.total) || 0;
    tableRef.value?.clearSelection?.();
    selectedRows.value = [];
  } catch (e) {
    ElMessage.error(e.message || '加载商品失败');
    products.value = [];
    total.value = 0;
    selectedRows.value = [];
  } finally {
    loading.value = false;
  }
}

function resetFilters() {
  keyword.value = '';
  categoryFilter.value = '';
  statusFilter.value = '';
  page.value = 1;
  loadProducts();
}

function handleFilterChange() {
  page.value = 1;
  loadProducts();
}

function handlePageChange(value) {
  page.value = value;
  loadProducts();
}

function handlePageSizeChange(value) {
  pageSize.value = value;
  page.value = 1;
  loadProducts();
}

function handleSelectionChange(rows) {
  selectedRows.value = rows;
}

function canSubmitAudit(status) {
  return status === 'DRAFT' || status === 'REJECTED' || status === 'OFF_SHELF';
}

function getSubmitAuditLabel(status) {
  if (status === 'REJECTED' || status === 'OFF_SHELF') return '重新提交审核';
  return '提交审核';
}

function canEdit(status) {
  return status === 'DRAFT' || status === 'REJECTED' || status === 'OFF_SHELF';
}

function canOffShelf(status) {
  return status === 'ON_SHELF';
}

function getProductReadonlyActionText(status) {
  if (status === 'PENDING_AUDIT') return '待平台审核';
  return '-';
}

function editProduct(row) {
  if (!row?.spuId || !canEdit(row.status)) return;
  router.push({ name: 'product-edit', params: { spuId: row.spuId } });
}

function openStockDialog(row, sku) {
  if (!sku?.skuId) return;
  stockTarget.value = {
    productTitle: row?.title || '-',
    skuId: sku.skuId,
    specText: formatSkuSpec(sku.specJson),
    locked: getSkuLocked(sku),
  };
  stockForm.value = { available: getSkuAvailable(sku) };
  stockDialogVisible.value = true;
}

function resetStockDialog() {
  stockTarget.value = null;
  stockForm.value = { available: 0 };
  stockFormRef.value?.clearValidate();
}

function applyStockUpdate(skuId, stock) {
  products.value = products.value.map((product) => ({
    ...product,
    skus: getSkus(product).map((sku) => (
      Number(sku.skuId) === Number(skuId)
        ? { ...sku, stock: { ...sku.stock, ...stock } }
        : sku
    )),
  }));
}

async function submitStockUpdate() {
  if (!stockTarget.value?.skuId || stockSubmitting.value) return;
  const valid = await stockFormRef.value?.validate().catch(() => false);
  if (!valid) return;
  const available = Number(stockForm.value.available);

  stockSubmitting.value = true;
  try {
    const data = await updateMerchantSkuStock(stockTarget.value.skuId, { available });
    applyStockUpdate(data.skuId, data.stock);
    ElMessage.success('库存已更新');
    stockDialogVisible.value = false;
  } catch (e) {
    ElMessage.error(e.message || '库存更新失败');
  } finally {
    stockSubmitting.value = false;
  }
}

async function confirmOffShelf(row) {
  if (!row?.spuId || offShelvingSpuId.value) return;
  if (!canOffShelf(row.status)) {
    ElMessage.warning('当前商品状态不允许下架');
    return;
  }

  try {
    await ElMessageBox.confirm('确认将该商品下架？下架后不会改变审核记录。', '商品下架确认', {
      confirmButtonText: '确认下架',
      cancelButtonText: '取消',
      type: 'warning',
    });
  } catch {
    return;
  }

  offShelvingSpuId.value = row.spuId;
  try {
    const data = await offShelfMerchantProduct(row.spuId);
    ElMessage.success(data?.message || '商品已下架');
    await loadProducts();
  } catch (e) {
    ElMessage.error(e.message || '商品下架失败');
  } finally {
    offShelvingSpuId.value = null;
  }
}

async function confirmSubmitAudit(row) {
  if (!row?.spuId || submittingSpuId.value) return;
  if (!canSubmitAudit(row.status)) {
    ElMessage.warning('当前商品状态不允许提交审核');
    return;
  }

  const isRejectedResubmit = row.status === 'REJECTED';
  const isOffShelfResubmit = row.status === 'OFF_SHELF';
  const reason = getRejectReason(row) || '未填写';
  let confirmMessage = '确认将该商品提交平台审核？提交后会进入待审核状态。';
  if (isRejectedResubmit) {
    confirmMessage = `平台驳回原因：${reason}\n\n确认修改后重新提交审核？`;
  } else if (isOffShelfResubmit) {
    confirmMessage = '下架商品重新上架需要平台重新审核，确认提交审核？';
  }
  const confirmTitle = isRejectedResubmit || isOffShelfResubmit ? '重新提交审核确认' : '提交审核确认';
  const confirmButtonText = isRejectedResubmit || isOffShelfResubmit ? '重新提交审核' : '提交审核';

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

function showBatchResult(data, successMessage) {
  const successCount = Number(data?.successCount) || 0;
  const failureCount = Number(data?.failureCount) || 0;
  if (failureCount > 0) {
    ElMessage.warning(`${successMessage} ${successCount} 个，失败 ${failureCount} 个`);
    return;
  }
  ElMessage.success(`${successMessage} ${successCount} 个`);
}

async function confirmBatchSubmitAudit() {
  if (!selectedSpuIds.value.length || batchSubmitLoading.value) return;
  try {
    await ElMessageBox.confirm(
      `确认提交选中的 ${selectedSpuIds.value.length} 个商品审核？其中 ${selectedSubmitCount.value} 个处于可提交状态，其余会返回失败原因。`,
      '批量提交审核',
      { confirmButtonText: '提交审核', cancelButtonText: '取消', type: 'warning' },
    );
  } catch {
    return;
  }

  batchSubmitLoading.value = true;
  try {
    const data = await batchSubmitMerchantProductAudit(selectedSpuIds.value);
    showBatchResult(data, '批量提交审核成功');
    await loadProducts();
  } catch (e) {
    ElMessage.error(e.message || '批量提交审核失败');
  } finally {
    batchSubmitLoading.value = false;
  }
}

async function confirmBatchOffShelf() {
  if (!selectedSpuIds.value.length || batchOffShelfLoading.value) return;
  try {
    await ElMessageBox.confirm(
      `确认下架选中的 ${selectedSpuIds.value.length} 个商品？其中 ${selectedOffShelfCount.value} 个处于可下架状态，其余会返回失败原因。`,
      '批量下架确认',
      { confirmButtonText: '确认下架', cancelButtonText: '取消', type: 'warning' },
    );
  } catch {
    return;
  }

  batchOffShelfLoading.value = true;
  try {
    const data = await batchOffShelfMerchantProducts(selectedSpuIds.value);
    showBatchResult(data, '批量下架成功');
    await loadProducts();
  } catch (e) {
    ElMessage.error(e.message || '批量下架失败');
  } finally {
    batchOffShelfLoading.value = false;
  }
}

onMounted(async () => {
  await loadCategoryOptions();
  await loadProducts();
});
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

    <div class="filter-bar">
      <el-input
        v-model="keyword"
        clearable
        class="keyword-input"
        placeholder="搜索商品标题 / 商品ID"
        @keyup.enter="handleFilterChange"
        @clear="handleFilterChange"
      />
      <el-select
        v-model="categoryFilter"
        clearable
        filterable
        :loading="categoryLoading"
        placeholder="商品分类"
        class="category-filter"
        @change="handleFilterChange"
        @clear="handleFilterChange"
      >
        <el-option
          v-for="item in categoryOptions"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
      <el-select
        v-model="statusFilter"
        clearable
        placeholder="全部状态"
        class="status-filter"
        @change="handleFilterChange"
        @clear="handleFilterChange"
      >
        <el-option label="全部" value="" />
        <el-option
          v-for="item in PRODUCT_STATUS_OPTIONS"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
      <el-button type="primary" :loading="loading" @click="handleFilterChange">搜索</el-button>
      <el-button @click="resetFilters">重置</el-button>
    </div>

    <div class="batch-bar">
      <span class="muted">已选择 {{ selectedRows.length }} 个商品</span>
      <el-button
        type="primary"
        :disabled="!selectedSpuIds.length || batchSubmitLoading || batchOffShelfLoading"
        :loading="batchSubmitLoading"
        @click="confirmBatchSubmitAudit"
      >
        批量提交审核
      </el-button>
      <el-button
        type="warning"
        :disabled="!selectedSpuIds.length || batchSubmitLoading || batchOffShelfLoading"
        :loading="batchOffShelfLoading"
        @click="confirmBatchOffShelf"
      >
        批量下架
      </el-button>
    </div>

    <el-table
      ref="tableRef"
      v-loading="loading"
      :data="products"
      stripe
      @selection-change="handleSelectionChange"
    >
      <template #empty>
        <el-empty description="暂无符合条件的商品。" />
      </template>
      <el-table-column type="selection" width="48" />
      <el-table-column prop="spuId" label="商品ID" width="100" />
      <el-table-column label="商品图片" width="96">
        <template #default="{ row }">
          <img
            v-if="hasProductImage(row)"
            :src="row.mainImage"
            :alt="row.title"
            class="product-thumb"
            @error="markImageError(row)"
          />
          <div v-else class="product-thumb placeholder">暂无图片</div>
        </template>
      </el-table-column>
      <el-table-column prop="title" label="商品标题" min-width="220" show-overflow-tooltip />
      <el-table-column label="商品分类" min-width="140" show-overflow-tooltip>
        <template #default="{ row }">{{ getCategoryLabel(row) }}</template>
      </el-table-column>
      <el-table-column label="商品状态" width="110">
        <template #default="{ row }">
          <el-tag :type="getStatusTagType(row.status)">{{ getStatusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="驳回原因" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          <span v-if="row.status === 'REJECTED' && getRejectReason(row)" class="reject-reason">
            {{ getRejectReason(row) }}
          </span>
          <span v-else class="muted">-</span>
        </template>
      </el-table-column>
      <el-table-column label="SKU数量" width="100">
        <template #default="{ row }">{{ getSkus(row).length }}</template>
      </el-table-column>
      <el-table-column label="SKU库存" min-width="280">
        <template #default="{ row }">
          <div v-if="getSkus(row).length" class="stock-list">
            <div v-for="sku in getSkus(row)" :key="sku.skuId" class="stock-line">
              <div class="stock-main">
                <span class="stock-spec">{{ formatSkuSpec(sku.specJson) }}</span>
                <span class="sku-id">SKU ID：{{ sku.skuId }}</span>
              </div>
              <div class="stock-values">
                <span>可用 {{ getSkuAvailable(sku) }}</span>
                <span class="muted">锁定 {{ getSkuLocked(sku) }}</span>
              </div>
              <el-button
                link
                type="primary"
                :disabled="stockSubmitting"
                @click="openStockDialog(row, sku)"
              >
                调整
              </el-button>
            </div>
          </div>
          <span v-else class="muted">-</span>
        </template>
      </el-table-column>
      <el-table-column label="提交审核时间" width="180">
        <template #default="{ row }">{{ formatTime(row.submittedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="canEdit(row.status)"
            link
            type="primary"
            @click="editProduct(row)"
          >
            编辑
          </el-button>
          <el-button
            v-if="canSubmitAudit(row.status)"
            link
            type="primary"
            :loading="submittingSpuId === row.spuId"
            @click="confirmSubmitAudit(row)"
          >
            {{ getSubmitAuditLabel(row.status) }}
          </el-button>
          <el-button
            v-if="canOffShelf(row.status)"
            link
            type="warning"
            :loading="offShelvingSpuId === row.spuId"
            @click="confirmOffShelf(row)"
          >
            下架
          </el-button>
          <span v-if="!canEdit(row.status) && !canSubmitAudit(row.status) && !canOffShelf(row.status)" class="muted">
            {{ getProductReadonlyActionText(row.status) }}
          </span>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-bar">
      <div class="summary">当前页 {{ products.length }} 个，共 {{ total }} 个商品</div>
      <el-pagination
        :current-page="page"
        :page-size="pageSize"
        :page-sizes="[10, 20, 50, 100]"
        :total="total"
        layout="sizes, prev, pager, next, jumper"
        @size-change="handlePageSizeChange"
        @current-change="handlePageChange"
      />
    </div>
  </el-card>

  <el-dialog
    v-model="stockDialogVisible"
    title="调整 SKU 可用库存"
    width="420px"
    @closed="resetStockDialog"
  >
    <el-descriptions :column="1" border class="stock-dialog-info">
      <el-descriptions-item label="商品">{{ stockTarget?.productTitle || '-' }}</el-descriptions-item>
      <el-descriptions-item label="SKU">{{ stockTarget?.skuId || '-' }}</el-descriptions-item>
      <el-descriptions-item label="规格">{{ stockTarget?.specText || '-' }}</el-descriptions-item>
      <el-descriptions-item label="锁定库存">{{ stockTarget?.locked ?? '-' }}</el-descriptions-item>
    </el-descriptions>
    <el-form ref="stockFormRef" :model="stockForm" :rules="stockRules" label-position="top">
      <el-form-item label="可用库存" prop="available">
        <el-input-number
          v-model="stockForm.available"
          :min="0"
          :precision="0"
          :disabled="stockSubmitting"
          controls-position="right"
          class="full-width"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button :disabled="stockSubmitting" @click="stockDialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="stockSubmitting" @click="submitStockUpdate">保存</el-button>
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
  width: 360px;
}
.category-filter {
  width: 180px;
}
.status-filter {
  width: 160px;
}
.batch-bar {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.product-thumb {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  object-fit: cover;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  background: #f7f8fa;
  color: #999;
  font-size: 12px;
  line-height: 16px;
  text-align: center;
}
.stock-list { display: flex; flex-direction: column; gap: 8px; }
.stock-line {
  display: grid;
  grid-template-columns: minmax(100px, 1fr) minmax(86px, auto) auto;
  align-items: center;
  gap: 10px;
}
.stock-main,
.stock-values { display: flex; flex-direction: column; gap: 3px; line-height: 1.4; }
.stock-spec { color: #333; }
.sku-id { color: #999; font-size: 12px; }
.stock-dialog-info { margin-bottom: 16px; }
.full-width { width: 100%; }
.muted { color: #999; }
.reject-reason { color: #f56c6c; }
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
