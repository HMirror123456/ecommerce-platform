<script setup>
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useRoute, useRouter } from 'vue-router';
import {
  fetchMerchantChatUnreadCount,
  fetchMerchantChatThreads,
  notifyMerchantChatUnreadChanged,
} from '@/api/merchant';
import AfterSaleChatDrawer from '@/components/AfterSaleChatDrawer.vue';
import { getAfterSaleCommunicationMode } from '@/utils/afterSaleCommunication';

const route = useRoute();
const router = useRouter();

const loading = ref(false);
const threads = ref([]);
const unreadCount = ref(0);
const statusFilter = ref('OPEN');
const sortMode = ref('UPDATED_DESC');
const chatVisible = ref(false);
const chatAfterSaleId = ref(null);
const chatThread = ref(null);

const sortedThreads = computed(() => [...threads.value].sort((a, b) => {
  if (sortMode.value === 'AFTER_SALE_DESC') {
    return Number(b.afterSaleId || 0) - Number(a.afterSaleId || 0) || new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
  }
  if (sortMode.value === 'AFTER_SALE_ASC') {
    return Number(a.afterSaleId || Number.MAX_SAFE_INTEGER) - Number(b.afterSaleId || Number.MAX_SAFE_INTEGER)
      || new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
  }
  return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
}));

const selectedAfterSaleId = computed(() => Number(route.query.afterSaleId) || null);
const displayedThreads = computed(() => selectedAfterSaleId.value
  ? sortedThreads.value.filter((thread) => Number(thread.afterSaleId) === selectedAfterSaleId.value)
  : sortedThreads.value);

const emptyText = computed(() => ({
  OPEN: '暂无进行中的会话',
  CLOSED: '暂无已关闭的会话',
  ALL: '暂无会话记录',
}[statusFilter.value] || '暂无会话记录'));

function formatTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN');
}

function scopeLabel(row) {
  if (row.afterSaleId) {
    return `售后沟通 · 售后单 #${row.afterSaleId}`;
  }
  return `订单沟通 · ${row.orderNo || '-'}`;
}

function getCommunicationMode(row) {
  return getAfterSaleCommunicationMode(row.afterSaleStatus);
}

function getAfterSaleStatusTagType(row) {
  const mode = getCommunicationMode(row);
  if (mode.isReadOnly) return 'info';
  if (row.afterSaleStatus === 'REJECTED') return 'danger';
  if (mode.needsMerchantAction) return 'warning';
  return 'success';
}

function getThreadActionLabel(row) {
  return row.status === 'CLOSED' ? '查看会话' : '进入会话';
}

function viewAfterSale(row) {
  if (!row?.afterSaleId) return;
  router.push({ path: '/after-sales', query: { afterSaleId: row.afterSaleId } });
}

function clearAfterSaleFilter() {
  router.replace({ path: '/chats' });
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
    try {
      const unread = await fetchMerchantChatUnreadCount();
      unreadCount.value = Number(unread?.unreadCount) || 0;
    } catch {
      unreadCount.value = 0;
    }
  } catch (e) {
    ElMessage.error(e.message || '加载会话失败');
    threads.value = [];
    unreadCount.value = 0;
  } finally {
    loading.value = false;
  }
}

function openChat(row) {
  if (!row?.id) return;
  chatAfterSaleId.value = null;
  chatThread.value = row;
  chatVisible.value = true;
}

async function handleThreadRead() {
  notifyMerchantChatUnreadChanged();
  await loadThreads();
}

onMounted(loadThreads);
</script>

<template>
  <div class="page chat-page">
    <div class="toolbar">
      <el-radio-group v-model="statusFilter" class="thread-tabs" @change="loadThreads">
        <el-radio-button label="OPEN">进行中</el-radio-button>
        <el-radio-button label="CLOSED">已关闭</el-radio-button>
        <el-radio-button label="ALL">全部</el-radio-button>
      </el-radio-group>
      <div class="toolbar-actions">
        <el-select v-model="sortMode" class="sort-select">
          <el-option label="最新沟通优先" value="UPDATED_DESC" />
          <el-option label="售后单号从大到小" value="AFTER_SALE_DESC" />
          <el-option label="售后单号从小到大" value="AFTER_SALE_ASC" />
        </el-select>
        <el-tag type="danger" effect="light" class="unread-summary">当前未读消息 {{ unreadCount }} 条</el-tag>
        <el-button @click="loadThreads">刷新</el-button>
      </div>
    </div>

    <div v-if="selectedAfterSaleId" class="after-sale-filter">
      <el-tag closable @close="clearAfterSaleFilter">仅显示售后单 #{{ selectedAfterSaleId }} 的沟通</el-tag>
    </div>

    <el-table v-loading="loading" :data="displayedThreads" stripe :empty-text="emptyText">
      <el-table-column label="订单号" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">
          <span class="order-no" :title="row.orderNo || '-'">{{ row.orderNo || '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="类型" min-width="220">
        <template #default="{ row }">
          <div>{{ scopeLabel(row) }}</div>
          <el-tag v-if="row.afterSaleId" :type="getAfterSaleStatusTagType(row)" size="small" class="after-sale-status-tag">
            {{ getCommunicationMode(row).displayText }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="未读" width="90" align="center">
        <template #default="{ row }">
          <el-badge v-if="row.unreadCount > 0" :value="row.unreadCount > 99 ? '99+' : row.unreadCount" class="unread-badge" />
          <span v-else class="muted">-</span>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" min-width="170">
        <template #default="{ row }">{{ formatTime(row.updatedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <div class="thread-actions">
            <el-button link type="primary" @click="openChat(row)">{{ getThreadActionLabel(row) }}</el-button>
            <el-button v-if="row.afterSaleId" link @click="viewAfterSale(row)">查看售后</el-button>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <AfterSaleChatDrawer
      v-model="chatVisible"
      :after-sale-id="chatAfterSaleId"
      :initial-thread="chatThread"
      @closed="loadThreads"
      @read="handleThreadRead"
    />
  </div>
</template>

<style scoped>
.page { background: #fff; padding: 20px; border: 1px solid #e7ebf1; border-radius: 10px; box-shadow: 0 2px 8px rgba(15, 29, 54, .035); }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; gap: 12px; flex-wrap: wrap; }
.toolbar-actions { display: flex; align-items: center; gap: 10px 12px; flex-wrap: wrap; }
.thread-tabs :deep(.el-radio-button__inner) { min-width: 76px; border-color: #e2e8f0; box-shadow: none; }
.thread-tabs :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) { box-shadow: -1px 0 0 0 #409eff; }
.sort-select { width: 180px; }
.unread-summary { font-weight: 600; }
.after-sale-filter { margin: -2px 0 14px; }
.after-sale-status-tag { margin-top: 6px; }
.order-no { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-variant-numeric: tabular-nums; }
.unread-badge { min-width: 20px; }
.thread-actions { display: flex; align-items: center; gap: 4px; min-height: 30px; white-space: nowrap; }
.muted { color: #94a3b8; }
@media (max-width: 720px) {
  .page { padding: 16px; }
  .toolbar-actions { width: 100%; }
}
</style>
