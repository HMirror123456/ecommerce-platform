<script setup>
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { fetchChatThreads } from '@/api/chat';
import AfterSaleChatDrawer from '@/components/AfterSaleChatDrawer.vue';

const AFTER_SALE_STATUS_LABELS = {
  APPLIED: '待商家处理',
  APPROVED: '商家已同意',
  REJECTED: '商家已拒绝',
  ESCALATED: '平台仲裁中',
  RETURNING: '退货中',
  REFUNDED: '已退款',
};

const THREAD_STATUS_LABELS = {
  OPEN: '进行中',
  CLOSED: '已关闭',
};

const router = useRouter();
const loading = ref(false);
const threads = ref([]);
const statusFilter = ref('OPEN');
const chatVisible = ref(false);
const chatAfterSaleId = ref(null);

function formatTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN');
}

function afterSaleLabel(status) {
  return AFTER_SALE_STATUS_LABELS[status] || status || '-';
}

function threadStatusLabel(status) {
  return THREAD_STATUS_LABELS[status] || status || '-';
}

async function loadThreads() {
  loading.value = true;
  try {
    const params = {};
    if (statusFilter.value === 'OPEN' || statusFilter.value === 'CLOSED') {
      params.status = statusFilter.value;
    }
    const data = await fetchChatThreads(params);
    threads.value = data.list || [];
  } catch (e) {
    ElMessage.error(e.message || '加载客服会话失败');
    threads.value = [];
  } finally {
    loading.value = false;
  }
}

function openChat(row) {
  if (!row?.afterSaleId) {
    ElMessage.warning('该会话缺少售后信息');
    return;
  }
  chatAfterSaleId.value = row.afterSaleId;
  chatVisible.value = true;
}

function goOrder(row) {
  if (!row?.orderId) return;
  router.push({ name: 'order-detail', params: { orderId: row.orderId } });
}

onMounted(loadThreads);
</script>

<template>
  <div class="chat-list-page" v-loading="loading">
    <div class="page-header">
      <div>
        <h2 class="page-title">我的客服会话</h2>
        <p class="page-subtitle">查看与平台客服的售后沟通记录</p>
      </div>
      <el-radio-group v-model="statusFilter" size="small" @change="loadThreads">
        <el-radio-button label="OPEN">进行中</el-radio-button>
        <el-radio-button label="CLOSED">已关闭</el-radio-button>
        <el-radio-button label="ALL">全部</el-radio-button>
      </el-radio-group>
    </div>

    <el-empty
      v-if="!loading && threads.length === 0"
      description="暂无客服会话，可在订单详情申请平台介入后联系客服"
    >
      <el-button type="primary" @click="router.push({ name: 'user-orders' })">去我的订单</el-button>
    </el-empty>

    <div v-else class="thread-list">
      <article
        v-for="row in threads"
        :key="row.id"
        class="thread-card"
        @click="openChat(row)"
      >
        <div class="thread-main">
          <div class="title-row">
            <h3 class="title">订单 {{ row.orderNo || '-' }}</h3>
            <el-tag size="small" :type="row.status === 'OPEN' ? 'success' : 'info'">
              {{ threadStatusLabel(row.status) }}
            </el-tag>
          </div>
          <p class="meta">
            售后 #{{ row.afterSaleId }}
            · {{ afterSaleLabel(row.afterSaleStatus) }}
          </p>
          <p class="time">更新于 {{ formatTime(row.updatedAt) }}</p>
        </div>
        <div class="thread-actions" @click.stop>
          <el-button link type="primary" @click="goOrder(row)">查看订单</el-button>
          <el-button type="primary" plain size="small" @click="openChat(row)">进入会话</el-button>
        </div>
      </article>
    </div>

    <AfterSaleChatDrawer v-model="chatVisible" :after-sale-id="chatAfterSaleId" />
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.page-title {
  margin: 0 0 6px;
  font-size: 20px;
}
.page-subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}
.thread-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.thread-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
  background: #fff;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.thread-card:hover {
  border-color: var(--color-primary);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06);
}
.thread-main {
  min-width: 0;
  flex: 1;
}
.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}
.meta,
.time {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}
.time {
  margin-top: 4px;
  font-size: 12px;
}
.thread-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
@media (max-width: 640px) {
  .thread-card {
    flex-direction: column;
    align-items: stretch;
  }
  .thread-actions {
    justify-content: flex-end;
  }
}
</style>
