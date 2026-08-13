<script setup>
import { nextTick, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { ChatDotRound, Shop } from '@element-plus/icons-vue';
import { fetchChatThreads } from '@/api/chat';
import { escalateAfterSale } from '@/api/order';
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
const chatMerchantId = ref(null);
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
  if (row.type === 'USER_CS' && !row.afterSaleId) {
    ElMessage.warning('该会话缺少售后信息');
    return;
  }
  if (row.type === 'USER_MERCHANT' && !row.afterSaleId && (!row.orderId || !row.merchantId)) {
    ElMessage.warning('该会话缺少订单或商家信息');
    return;
  }
  chatThreadType.value = row.type === 'USER_MERCHANT' ? 'USER_MERCHANT' : 'USER_CS';
  chatCanEscalate.value =
    row.type === 'USER_MERCHANT' &&
    Boolean(row.afterSaleId) &&
    (row.afterSaleStatus === 'APPLIED' || row.afterSaleStatus === 'REJECTED');
  chatAfterSaleId.value = row.afterSaleId || null;
  chatOrderId.value = row.orderId || null;
  chatMerchantId.value = row.afterSaleId ? null : row.merchantId || null;
  chatVisible.value = true;
}

async function onEscalateFromList() {
  const afterSaleId = chatAfterSaleId.value;
  const orderId = chatOrderId.value;
  if (!afterSaleId || !orderId) {
    ElMessage.warning('缺少售后或订单信息，无法申请平台介入');
    return;
  }
  try {
    await ElMessageBox.confirm(
      '建议先与商家协商。商家超时未处理或协商不成时，再申请平台介入，由客服仲裁。',
      '申请平台介入',
      { type: 'warning' },
    );
    await escalateAfterSale(orderId, afterSaleId);
    ElMessage.success('已申请平台介入，已为您打开平台客服会话');
    chatVisible.value = false;
    chatCanEscalate.value = false;
    chatThreadType.value = 'USER_CS';
    chatMerchantId.value = null;
    chatAfterSaleId.value = afterSaleId;
    chatOrderId.value = orderId;
    await nextTick();
    chatVisible.value = true;
    await loadThreads();
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e.message || '升级失败');
  }
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
    </div>

    <div class="filters">
      <div class="filter-group">
        <button
          v-for="opt in [
            { label: '全部类型', value: 'ALL' },
            { label: '平台客服', value: 'USER_CS' },
            { label: '商家', value: 'USER_MERCHANT' },
          ]"
          :key="`type-${opt.value}`"
          type="button"
          class="filter-chip"
          :class="{ active: typeFilter === opt.value }"
          @click="typeFilter = opt.value; loadThreads()"
        >
          {{ opt.label }}
        </button>
      </div>
      <div class="filter-group">
        <button
          v-for="opt in [
            { label: '进行中', value: 'OPEN' },
            { label: '已关闭', value: 'CLOSED' },
            { label: '全部状态', value: 'ALL' },
          ]"
          :key="`status-${opt.value}`"
          type="button"
          class="filter-chip"
          :class="{ active: statusFilter === opt.value }"
          @click="statusFilter = opt.value; loadThreads()"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <el-empty
      v-if="!loading && threads.length === 0"
      description="暂无会话。待发货订单可在详情「联系商家」；售后也可联系商家或申请平台介入"
    >
      <el-button type="primary" @click="router.push({ name: 'user-orders' })">去我的订单</el-button>
    </el-empty>

    <div v-else class="thread-list">
      <article
        v-for="row in threads"
        :key="row.id"
        class="thread-card"
        :class="{ open: row.status === 'OPEN' }"
        @click="openChat(row)"
      >
        <div
          class="avatar"
          :class="row.type === 'USER_MERCHANT' ? 'merchant' : 'cs'"
        >
          <el-icon>
            <Shop v-if="row.type === 'USER_MERCHANT'" />
            <ChatDotRound v-else />
          </el-icon>
          <span v-if="row.status === 'OPEN'" class="alive-dot" title="进行中" />
        </div>
        <div class="thread-main">
          <div class="title-row">
            <h3 class="title">订单 {{ row.orderNo || '-' }}</h3>
            <span class="type-pill" :class="row.type === 'USER_MERCHANT' ? 'merchant' : 'cs'">
              {{ threadTypeLabel(row.type) }}
            </span>
            <span class="status-pill" :class="row.status === 'OPEN' ? 'open' : 'closed'">
              {{ threadStatusLabel(row.status) }}
            </span>
          </div>
          <p class="meta">
            <template v-if="row.afterSaleId">
              售后 #{{ row.afterSaleId }}
              <template v-if="row.afterSaleStatus"> · {{ afterSaleLabel(row.afterSaleStatus) }}</template>
            </template>
            <template v-else>订单沟通</template>
            <template v-if="row.shopName"> · {{ row.shopName }}</template>
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
      :order-id="chatAfterSaleId ? null : chatOrderId"
      :merchant-id="chatMerchantId"
      :thread-type="chatThreadType"
      :can-escalate="chatCanEscalate"
      @escalate="onEscalateFromList"
    />
  </div>
</template>

<style scoped>
.page-header {
  margin-bottom: 12px;
}

.page-title {
  margin: 0 0 4px;
  font-size: 22px;
}

.page-subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  margin-bottom: 16px;
}

.filter-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.filter-chip {
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--border-color);
  background: #fafafa;
  color: var(--text-body);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.filter-chip:hover {
  border-color: #ffb4b4;
  color: var(--color-primary);
}

.filter-chip.active {
  background: #fff1f0;
  border-color: var(--color-primary);
  color: var(--color-primary);
  font-weight: 600;
}

.thread-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.thread-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  background: #fff;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
}

.thread-card:hover {
  border-color: #ffb4b4;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.06);
  transform: translateY(-1px);
}

.thread-card.open {
  border-left: 3px solid var(--color-primary);
}

.avatar {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  color: #fff;
  flex-shrink: 0;
}

.avatar.cs {
  background: linear-gradient(135deg, #e4393c, #ff7875);
}

.avatar.merchant {
  background: linear-gradient(135deg, #fa8c16, #ffc069);
}

.alive-dot {
  position: absolute;
  right: -2px;
  top: -2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #52c41a;
  border: 2px solid #fff;
  box-shadow: 0 0 0 0 rgba(82, 196, 26, 0.45);
  animation: pulse 1.6s ease-out infinite;
}

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(82, 196, 26, 0.45); }
  70% { box-shadow: 0 0 0 6px rgba(82, 196, 26, 0); }
  100% { box-shadow: 0 0 0 0 rgba(82, 196, 26, 0); }
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
  font-weight: 700;
}

.type-pill,
.status-pill {
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.type-pill.cs {
  background: #fff1f0;
  color: var(--color-primary);
}

.type-pill.merchant {
  background: #fff7e6;
  color: #d48806;
}

.status-pill.open {
  background: #f6ffed;
  color: #389e0d;
}

.status-pill.closed {
  background: #f5f5f5;
  color: var(--text-muted);
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
    flex-wrap: wrap;
  }

  .thread-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style>
