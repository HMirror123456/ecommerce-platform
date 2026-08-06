<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { auditProduct, fetchPendingProducts, fetchProductDetail } from '@/api/admin';

const loading = ref(false);
const list = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);

const drawerVisible = ref(false);
const detailLoading = ref(false);
const detail = ref(null);

const rejectVisible = ref(false);
const rejectReason = ref('');
const rejectTargetId = ref(null);
const actionLoading = ref(false);

function formatTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN');
}

function formatSpec(specJson) {
  if (!specJson) return '-';
  return Object.entries(specJson).map(([k, v]) => `${k}: ${v}`).join(' / ');
}

async function loadList() {
  loading.value = true;
  try {
    const data = await fetchPendingProducts({ page: page.value, pageSize: pageSize.value });
    list.value = data.list || [];
    total.value = data.total || 0;
  } catch (e) {
    ElMessage.error(e.message || '加载失败');
  } finally {
    loading.value = false;
  }
}

async function openDetail(row) {
  drawerVisible.value = true;
  detailLoading.value = true;
  detail.value = null;
  try {
    detail.value = await fetchProductDetail(row.spuId);
  } catch (e) {
    ElMessage.error(e.message || '加载详情失败');
    drawerVisible.value = false;
  } finally {
    detailLoading.value = false;
  }
}

async function handleApprove(row) {
  try {
    await ElMessageBox.confirm(`确认通过「${row.title}」？通过后 C 端可见（ON_SHELF）`, '审核通过', {
      type: 'success',
      confirmButtonText: '通过',
    });
    actionLoading.value = true;
    await auditProduct(row.spuId, true);
    ElMessage.success('审核通过');
    await loadList();
  } catch (e) {
    if (e !== 'cancel' && e?.message) ElMessage.error(e.message);
  } finally {
    actionLoading.value = false;
  }
}

function openReject(row) {
  rejectTargetId.value = row.spuId;
  rejectReason.value = '';
  rejectVisible.value = true;
}

async function submitReject() {
  if (!rejectReason.value.trim()) {
    ElMessage.warning('请填写驳回原因');
    return;
  }
  actionLoading.value = true;
  try {
    await auditProduct(rejectTargetId.value, false, rejectReason.value.trim());
    ElMessage.success('已驳回');
    rejectVisible.value = false;
    await loadList();
  } catch (e) {
    ElMessage.error(e.message || '操作失败');
  } finally {
    actionLoading.value = false;
  }
}

function onPageChange(p) {
  page.value = p;
  loadList();
}

onMounted(loadList);
</script>

<template>
  <el-card shadow="never">
    <template #header>
      <div class="card-header">
        <span>待审核商品</span>
        <el-tag type="warning">PENDING_AUDIT → ON_SHELF / REJECTED</el-tag>
      </div>
    </template>

    <el-table v-loading="loading" :data="list" stripe empty-text="暂无待审核商品">
      <el-table-column label="主图" width="80">
        <template #default="{ row }">
          <el-image :src="row.mainImage" fit="cover" class="thumb" />
        </template>
      </el-table-column>
      <el-table-column prop="title" label="商品标题" min-width="180" show-overflow-tooltip />
      <el-table-column prop="shopName" label="店铺" width="140" />
      <el-table-column prop="merchantId" label="商家ID" width="90" />
      <el-table-column label="提交时间" width="170">
        <template #default="{ row }">{{ formatTime(row.submittedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)">详情</el-button>
          <el-button link type="success" :disabled="actionLoading" @click="handleApprove(row)">通过</el-button>
          <el-button link type="danger" :disabled="actionLoading" @click="openReject(row)">驳回</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pager">
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="onPageChange"
      />
    </div>
  </el-card>

  <el-drawer v-model="drawerVisible" title="商品详情" size="480px">
    <div v-loading="detailLoading">
      <template v-if="detail">
        <el-image :src="detail.mainImage" fit="contain" class="detail-img" />
        <el-descriptions :column="1" border class="desc">
          <el-descriptions-item label="SPU ID">{{ detail.spuId }}</el-descriptions-item>
          <el-descriptions-item label="类目ID">{{ detail.categoryId ?? '-' }}</el-descriptions-item>
          <el-descriptions-item label="标题">{{ detail.title }}</el-descriptions-item>
          <el-descriptions-item label="店铺">{{ detail.shopName }}</el-descriptions-item>
          <el-descriptions-item label="描述">{{ detail.description }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ detail.status }}</el-descriptions-item>
          <el-descriptions-item v-if="detail.rejectReason" label="驳回原因">
            <el-text type="danger">{{ detail.rejectReason }}</el-text>
          </el-descriptions-item>
        </el-descriptions>
        <h4>SKU 列表</h4>
        <el-table :data="detail.skus" size="small" border>
          <el-table-column prop="skuId" label="SKU ID" width="80" />
          <el-table-column label="规格">
            <template #default="{ row }">{{ formatSpec(row.specJson) }}</template>
          </el-table-column>
          <el-table-column label="价格" width="100">
            <template #default="{ row }">¥{{ row.price }}</template>
          </el-table-column>
          <el-table-column label="可用库存" width="100">
            <template #default="{ row }">{{ row.stock?.available ?? row.stock ?? '-' }}</template>
          </el-table-column>
          <el-table-column label="锁定库存" width="100">
            <template #default="{ row }">{{ row.stock?.locked ?? '-' }}</template>
          </el-table-column>
        </el-table>
      </template>
    </div>
  </el-drawer>

  <el-dialog v-model="rejectVisible" title="驳回商品" width="420px">
    <el-form label-position="top">
      <el-form-item label="驳回原因" required>
        <el-input v-model="rejectReason" type="textarea" :rows="4" placeholder="请说明驳回原因，商家将收到通知" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="rejectVisible = false">取消</el-button>
      <el-button type="danger" :loading="actionLoading" @click="submitReject">确认驳回</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.card-header { display: flex; align-items: center; justify-content: space-between; }
.thumb { width: 48px; height: 48px; border-radius: 4px; }
.pager { margin-top: 16px; display: flex; justify-content: flex-end; }
.detail-img { width: 100%; max-height: 200px; margin-bottom: 16px; }
.desc { margin-bottom: 16px; }
h4 { margin: 0 0 8px; color: #666; }
</style>
