<script setup>
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { fetchMerchantChatThreads } from '@/api/merchant';
import AfterSaleChatDrawer from '@/components/AfterSaleChatDrawer.vue';

const AFTER_SALE_STATUS_LABELS = {
  APPLIED: '待商家处理',
  APPROVED: '等待用户寄回',
  RETURNING: '用户已寄回',
  REFUNDED: '退款已完成',
  REJECTED: '售后已拒绝',
  ESCALATED: '平台仲裁中',
};

const loading = ref(false);
const threads = ref([]);
const statusFilter = ref('OPEN');
const chatVisible = ref(false);
const chatAfterSaleId = ref(null);
const chatThread = ref(null);

function formatTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN');
}

function afterSaleLabel(status) {
  return AFTER_SALE_STATUS_LABELS[status] || status || '-';
}

function scopeLabel(row) {
  if (row.afterSaleId) {
    const st = row.afterSaleStatus ? ` · ${afterSaleLabel(row.afterSaleStatus)}` : '';
    return `售后 #${row.afterSaleId}${st}`;
  }
  return '订单沟通';
}

async function loadThreads() {
  loading.value = true;
  try {
    const params = {};
    if (statusFilter.value === 'OPEN' || statusFilter.value === 'CLOSED') {
      params.status = statusFilter.value;
    }
    const data = await fetchMerchantChatThreads(params);
    threads.value = data.list || [];
  } catch (e) {
    ElMessage.error(e.message || '加载会话失败');
    threads.value = [];
  } finally {
    loading.value = false;
  }
}

function openChat(row) {
  if (!row?.id) return;
  if (row.afterSaleId) {
    chatAfterSaleId.value = row.afterSaleId;
    chatThread.value = null;
  } else {
    chatAfterSaleId.value = null;
    chatThread.value = row;
  }
  chatVisible.value = true;
}

onMounted(loadThreads);
</script>

<template>
  <div class="page">
    <div class="toolbar">
      <el-radio-group v-model="statusFilter" @change="loadThreads">
        <el-radio-button label="OPEN">进行中</el-radio-button>
        <el-radio-button label="CLOSED">已关闭</el-radio-button>
        <el-radio-button label="ALL">全部</el-radio-button>
      </el-radio-group>
      <el-button @click="loadThreads">刷新</el-button>
    </div>

    <el-table v-loading="loading" :data="threads" stripe empty-text="暂无用户沟通会话">
      <el-table-column prop="orderNo" label="订单号" min-width="140" />
      <el-table-column label="类型" min-width="200">
        <template #default="{ row }">{{ scopeLabel(row) }}</template>
      </el-table-column>
      <el-table-column label="会话状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.status === 'OPEN' ? 'success' : 'info'" size="small">
            {{ row.status === 'OPEN' ? '进行中' : '已关闭' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" min-width="170">
        <template #default="{ row }">{{ formatTime(row.updatedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openChat(row)">进入会话</el-button>
        </template>
      </el-table-column>
    </el-table>

    <AfterSaleChatDrawer
      v-model="chatVisible"
      :after-sale-id="chatAfterSaleId"
      :initial-thread="chatThread"
    />
  </div>
</template>

<style scoped>
.page { background: #fff; padding: 16px; border-radius: 8px; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; gap: 12px; }
</style>
