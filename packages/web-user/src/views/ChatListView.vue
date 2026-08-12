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

const THREAD_TYPE_LABELS = {
  USER_CS: '平台客服',
  USER_MERCHANT: '商家沟通',
};

const router = useRouter();
const loading = ref(false);
const threads = ref([]);
const statusFilter = ref('OPEN');
const typeFilter = ref('ALL');
const chatVisible = ref(false);
const chatAfterSaleId = ref(null);
const chatOrderId = ref(null);
const chatThreadType = ref('USER_CS');
const chatCanEscalate = ref(false);

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

function threadTypeLabel(type) {
  return THREAD_TYPE_LABELS[type] || type || '-';
}

async function loadThreads() {
  loading.value = true;
  try {
    const params = {};
    if (statusFilter.value === 'OPEN' || statusFilter.value === 'CLOSED') {
      params.status = statusFilter.value;
    }
    if (typeFilter.value === 'USER_CS' || typeFilter.value === 'USER_MERCHANT') {
      params.type = typeFilter.value;
    }
    const data = await fetchChatThreads(params);
    threads.value = data.list || [];
  } catch (e) {
    ElMessage.error(e.message || '加载会话失败');
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
  chatThreadType.value = row.type === 'USER_MERCHANT' ? 'USER_MERCHANT' : 'USER_CS';
  chatCanEscalate.value =
    row.type === 'USER_MERCHANT' &&
    (row.afterSaleStatus === 'APPLIED' || row.afterSaleStatus === 'REJECTED');
  chatAfterSaleId.value = row.afterSaleId;
  chatOrderId.value = row.orderId || null;
  chatVisible.value = true;
}

function onEscalateFromList() {
  chatVisible.value = false;
  if (chatOrderId.value) {
    router.push({ name: 'order-detail', params: { orderId: chatOrderId.value } });
    ElMessage.info('请在订单详情中点击「申请平台介入」');
    return;
  }
  router.push({ name: 'user-orders' });
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
        <h2 class="page-title">我的售后会话</h2>
        <p class="page-subtitle">与平台客服、商家的售后沟通记录</p>
      </div>
      <div class="filters">
        <el-radio-group v-model="typeFilter" size="small" @change="loadThreads">
          <el-radio-button label="ALL">全部类型</el-radio-button>
          <el-radio-button label="USER_CS">平台客服</el-radio-button>
          <el-radio-button label="USER_MERCHANT">商家</el-radio-button>
        </el-radio-group>
        <el-radio-group v-model="statusFilter" size="small" @change="loadThreads">
          <el-radio-button label="OPEN">进行中</el-radio-button>
          <el-radio-button label="CLOSED">已关闭</el-radio-button>
          <el-radio-button label="ALL">全部状态</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <el-empty
      v-if="!loading && threads.length === 0"
      description="暂无会话。可在订单详情「联系商家」或申请平台介入后联系客服"
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
            <el-tag size="small" :type="row.type === 'USER_MERCHANT' ? 'warning' : ''">
              {{ threadTypeLabel(row.type) }}
            </el-tag>
            <el-tag size="small" :type="row.status === 'OPEN' ? 'success' : 'info'">
              {{ threadStatusLabel(row.status) }}
            </el-tag>
          </div>
          <p class="meta">
            售后 #{{ row.afterSaleId }}
            <template v-if="row.shopName"> · {{ row.shopName }}</template>
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

    <AfterSaleChatDrawer
      v-model="chatVisible"
      :after-sale-id="chatAfterSaleId"
      :thread-type="chatThreadType"
      :can-escalate="chatCanEscalate"
      @escalate="onEscalateFromList"
    />
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
.filters {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
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
  flex-wrap: wrap;
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
  .filters {
    align-items: stretch;
  }
}
</style>
