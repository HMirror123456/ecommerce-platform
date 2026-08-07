<script setup>
import { onMounted, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { auditMerchant, fetchMerchantApplications, fetchPendingMerchants } from '@/api/admin';

const activeTab = ref('pending');
const loading = ref(false);
const list = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);
const actionLoading = ref(false);

const rejectVisible = ref(false);
const rejectReason = ref('');
const rejectTargetId = ref(null);

const statusMap = {
  PENDING: { label: '待审核', type: 'warning' },
  APPROVED: { label: '已通过', type: 'success' },
  REJECTED: { label: '已驳回', type: 'danger' },
};

function formatTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN');
}

async function loadList() {
  loading.value = true;
  try {
    if (activeTab.value === 'pending') {
      list.value = await fetchPendingMerchants();
      total.value = list.value.length;
    } else {
      const status = activeTab.value === 'completed' ? 'APPROVED,REJECTED' : 'ALL';
      const data = await fetchMerchantApplications({
        status,
        page: page.value,
        pageSize: pageSize.value,
      });
      list.value = data.list || [];
      total.value = data.total || 0;
    }
  } catch (e) {
    ElMessage.error(e.message || '加载失败');
  } finally {
    loading.value = false;
  }
}

async function handleApprove(row) {
  try {
    await ElMessageBox.confirm(
      `确认通过「${row.shopName}」入驻？通过后将创建商家登录账号（初始密码 123456）`,
      '审核通过',
      { type: 'success', confirmButtonText: '通过' },
    );
    actionLoading.value = true;
    const data = await auditMerchant(row.merchantId, true);
    ElMessage.success(data.message || '审核通过');
    await loadList();
  } catch (e) {
    if (e !== 'cancel' && e?.message) ElMessage.error(e.message);
  } finally {
    actionLoading.value = false;
  }
}

function openReject(row) {
  rejectTargetId.value = row.merchantId;
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
    await auditMerchant(rejectTargetId.value, false, rejectReason.value.trim());
    ElMessage.success('已驳回');
    rejectVisible.value = false;
    await loadList();
  } catch (e) {
    ElMessage.error(e.message || '操作失败');
  } finally {
    actionLoading.value = false;
  }
}

function onTabChange() {
  page.value = 1;
  loadList();
}

watch(page, () => {
  if (activeTab.value !== 'pending') loadList();
});

onMounted(loadList);
</script>

<template>
  <el-card shadow="never">
    <template #header>
      <div class="card-header">
        <span>商家入驻审核</span>
        <el-tag type="info">PENDING → APPROVED / REJECTED</el-tag>
      </div>
    </template>

    <el-tabs v-model="activeTab" @tab-change="onTabChange">
      <el-tab-pane label="待审核" name="pending" />
      <el-tab-pane label="已审核" name="completed" />
      <el-tab-pane label="全部" name="all" />
    </el-tabs>

    <el-table
      v-loading="loading"
      :data="list"
      stripe
      :empty-text="activeTab === 'pending' ? '暂无待审核商家' : '暂无记录'"
    >
      <el-table-column prop="merchantId" label="申请ID" width="100" />
      <el-table-column prop="shopName" label="店铺名称" min-width="140" />
      <el-table-column prop="contactName" label="联系人" width="100" />
      <el-table-column prop="contactPhone" label="联系电话" width="130" />
      <el-table-column v-if="activeTab !== 'pending'" label="状态" width="100">
        <template #default="{ row }">
          <el-tag v-if="row.status" :type="statusMap[row.status]?.type" size="small">
            {{ statusMap[row.status]?.label || row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="申请时间" width="170">
        <template #default="{ row }">{{ formatTime(row.appliedAt) }}</template>
      </el-table-column>
      <el-table-column v-if="activeTab !== 'pending'" label="审核时间" width="170">
        <template #default="{ row }">{{ formatTime(row.auditedAt) }}</template>
      </el-table-column>
      <el-table-column v-if="activeTab !== 'pending'" label="商家账号" width="120">
        <template #default="{ row }">{{ row.merchantUsername || '-' }}</template>
      </el-table-column>
      <el-table-column v-if="activeTab !== 'pending'" label="驳回原因" min-width="160" show-overflow-tooltip>
        <template #default="{ row }">{{ row.rejectReason || '-' }}</template>
      </el-table-column>
      <el-table-column v-if="activeTab === 'pending'" label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button link type="success" :disabled="actionLoading" @click="handleApprove(row)">通过</el-button>
          <el-button link type="danger" :disabled="actionLoading" @click="openReject(row)">驳回</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="activeTab === 'pending'" class="summary">共 {{ list.length }} 条待审核</div>
    <el-pagination
      v-else
      v-model:current-page="page"
      class="pager"
      layout="total, prev, pager, next"
      :total="total"
      :page-size="pageSize"
    />
  </el-card>

  <el-dialog v-model="rejectVisible" title="驳回入驻申请" width="420px">
    <el-form label-position="top">
      <el-form-item label="驳回原因" required>
        <el-input v-model="rejectReason" type="textarea" :rows="4" placeholder="请说明驳回原因" />
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
.summary { margin-top: 16px; text-align: right; color: #666; }
.pager { margin-top: 16px; justify-content: flex-end; }
</style>
