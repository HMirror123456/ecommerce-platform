<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { fetchChatMessages, openAfterSaleChat, sendChatMessage } from '@/api/chat';

const AFTER_SALE_STATUS_LABELS = {
  APPLIED: '待商家处理',
  APPROVED: '商家已同意',
  REJECTED: '商家已拒绝',
  ESCALATED: '平台仲裁中',
  RETURNING: '退货中',
  REFUNDED: '已退款',
};

const AFTER_SALE_TYPE_LABELS = {
  REFUND_ONLY: '仅退款',
  RETURN_REFUND: '退货退款',
};

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  afterSaleId: { type: Number, default: null },
});
const emit = defineEmits(['update:modelValue']);

const router = useRouter();
const loading = ref(false);
const openError = ref('');
const thread = ref(null);
const messages = ref([]);
const draft = ref('');
const sending = ref(false);
let pollTimer = null;

const threadOpen = computed(() => thread.value?.status === 'OPEN');
const showEmpty = computed(() => !loading.value && !openError.value && thread.value && messages.value.length === 0);

const threadStatusLabel = computed(() => {
  const status = thread.value?.afterSaleStatus;
  if (!status) return '';
  return AFTER_SALE_STATUS_LABELS[status] || status;
});

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('zh-CN');
}

function formatPrice(value) {
  if (value == null || Number.isNaN(Number(value))) return '-';
  return `¥${Number(value).toFixed(2)}`;
}

function typeLabel(type) {
  return AFTER_SALE_TYPE_LABELS[type] || type || '-';
}

function statusLabel(status) {
  return AFTER_SALE_STATUS_LABELS[status] || status || '-';
}

function senderLabel(msg) {
  if (msg.senderType === 'USER') return '我';
  if (msg.senderType === 'CS_AGENT') return '客服';
  return '系统';
}

function isMine(msg) {
  return msg.senderType === 'USER';
}

async function scrollToBottom() {
  await nextTick();
  const box = document.getElementById('user-chat-scroll');
  if (box) box.scrollTop = box.scrollHeight;
}

async function loadMessages(reset) {
  if (!thread.value) return;
  try {
    const afterId = reset || !messages.value.length ? undefined : messages.value[messages.value.length - 1].id;
    const data = await fetchChatMessages(thread.value.id, afterId ? { afterId } : undefined);
    const list = data.list || [];
    if (reset || !afterId) messages.value = list;
    else if (list.length) messages.value = messages.value.concat(list);
    if (reset || list.length) await scrollToBottom();
  } catch (e) {
    if (reset) ElMessage.error(e.message || '加载消息失败，请稍后重试');
  }
}

async function openThread() {
  if (!props.afterSaleId) {
    openError.value = '缺少售后单信息，无法打开客服会话';
    return;
  }
  loading.value = true;
  openError.value = '';
  try {
    thread.value = await openAfterSaleChat(props.afterSaleId);
    await loadMessages(true);
    startPoll();
  } catch (e) {
    openError.value = e.message || '无法打开客服会话，请确认已申请平台介入后重试';
    thread.value = null;
    messages.value = [];
    ElMessage.error(openError.value);
  } finally {
    loading.value = false;
  }
}

async function onSend() {
  const text = draft.value.trim();
  if (!text || !thread.value || !threadOpen.value || sending.value) return;
  sending.value = true;
  try {
    const msg = await sendChatMessage(thread.value.id, { msgType: 'TEXT', content: text });
    messages.value.push(msg);
    draft.value = '';
    await scrollToBottom();
  } catch (e) {
    ElMessage.error(e.message || '发送失败，请稍后重试');
  } finally {
    sending.value = false;
  }
}

async function onSendCard() {
  if (!thread.value || !threadOpen.value || sending.value) return;
  sending.value = true;
  try {
    const msg = await sendChatMessage(thread.value.id, { msgType: 'CARD' });
    messages.value.push(msg);
    await scrollToBottom();
  } catch (e) {
    ElMessage.error(e.message || '发送订单卡片失败，请稍后重试');
  } finally {
    sending.value = false;
  }
}

function goOrderFromCard(payload) {
  const orderId = payload?.orderId;
  if (!orderId) {
    ElMessage.warning('卡片缺少订单信息');
    return;
  }
  emit('update:modelValue', false);
  router.push({ name: 'order-detail', params: { orderId } });
}

function startPoll() {
  stopPoll();
  pollTimer = setInterval(() => loadMessages(false), 4000);
}

function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function onClose() {
  emit('update:modelValue', false);
}

function retryOpen() {
  openThread();
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) openThread();
    else {
      stopPoll();
      thread.value = null;
      messages.value = [];
      draft.value = '';
      openError.value = '';
      sending.value = false;
    }
  },
);

onUnmounted(stopPoll);
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    title="平台客服"
    size="420px"
    @close="onClose"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-loading="loading" class="drawer-body">
      <div v-if="openError" class="error-box">
        <p class="error-text">{{ openError }}</p>
        <el-button type="primary" size="small" @click="retryOpen">重试</el-button>
      </div>

      <template v-else>
        <div v-if="thread" class="thread-meta">
          订单 {{ thread.orderNo }} · 售后 #{{ thread.afterSaleId }}
          <template v-if="threadStatusLabel"> · {{ threadStatusLabel }}</template>
          <el-tag v-if="!threadOpen" size="small" type="info" class="status-tag">已关闭</el-tag>
        </div>

        <div id="user-chat-scroll" class="msg-list">
          <div v-if="showEmpty" class="empty-msg">
            暂无消息，可先发送文字或订单卡片说明问题
          </div>

          <div
            v-for="m in messages"
            :key="m.id"
            class="bubble-row"
            :class="{ mine: isMine(m), system: m.senderType === 'SYSTEM' }"
          >
            <div class="bubble">
              <div class="who">{{ senderLabel(m) }} · {{ formatTime(m.createdAt) }}</div>
              <button
                v-if="m.msgType === 'CARD'"
                type="button"
                class="order-card"
                @click="goOrderFromCard(m.payload)"
              >
                <div class="card-head">
                  <span class="card-title">订单卡片</span>
                  <span class="card-link">查看订单 ›</span>
                </div>
                <div class="card-row">
                  <span class="label">订单号</span>
                  <span>{{ m.payload?.orderNo || '-' }}</span>
                </div>
                <div class="card-row">
                  <span class="label">店铺</span>
                  <span>{{ m.payload?.shopName || '-' }}</span>
                </div>
                <div class="card-row">
                  <span class="label">类型</span>
                  <span>{{ typeLabel(m.payload?.type) }}</span>
                </div>
                <div class="card-row">
                  <span class="label">状态</span>
                  <span>{{ statusLabel(m.payload?.status) }}</span>
                </div>
                <div class="card-row">
                  <span class="label">金额</span>
                  <span class="amount">{{ formatPrice(m.payload?.amount) }}</span>
                </div>
                <div v-if="m.payload?.reason" class="card-reason">原因：{{ m.payload.reason }}</div>
              </button>
              <div v-else class="text">{{ m.content }}</div>
            </div>
          </div>
        </div>

        <div class="composer">
          <p v-if="thread && !threadOpen" class="closed-tip">会话已关闭，无法继续发送</p>
          <div class="composer-actions">
            <el-button :disabled="!threadOpen || sending" :loading="sending" @click="onSendCard">
              发送订单卡片
            </el-button>
          </div>
          <el-input
            v-model="draft"
            type="textarea"
            :rows="2"
            placeholder="描述您的问题…（Ctrl+Enter 发送）"
            :disabled="!threadOpen || sending"
            @keydown.ctrl.enter="onSend"
          />
          <el-button type="primary" :loading="sending" :disabled="!threadOpen || !draft.trim()" @click="onSend">
            发送
          </el-button>
        </div>
      </template>
    </div>
  </el-drawer>
</template>

<style scoped>
.drawer-body {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
}
.thread-meta {
  font-size: 12px;
  color: var(--text-muted, #999);
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.status-tag {
  margin-left: 2px;
}
.error-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  text-align: center;
}
.error-text {
  margin: 0;
  font-size: 14px;
  color: var(--text-muted, #999);
  line-height: 1.6;
}
.msg-list {
  flex: 1;
  overflow: auto;
  background: #f5f5f5;
  border-radius: 8px;
  padding: 12px;
}
.empty-msg {
  height: 100%;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: #999;
  text-align: center;
  padding: 16px;
}
.bubble-row {
  display: flex;
  margin-bottom: 10px;
}
.bubble-row.mine {
  justify-content: flex-end;
}
.bubble-row.system {
  justify-content: center;
}
.bubble {
  max-width: 88%;
  background: #fff;
  border-radius: 8px;
  padding: 8px 10px;
}
.bubble-row.mine .bubble {
  background: #ffe7e7;
}
.bubble-row.system .bubble {
  background: #fff7e6;
}
.who {
  font-size: 11px;
  color: #999;
  margin-bottom: 4px;
}
.text {
  white-space: pre-wrap;
  line-height: 1.5;
  font-size: 13px;
}
.order-card {
  display: block;
  width: 100%;
  text-align: left;
  border: 1px solid var(--border-color, #eee);
  border-radius: 8px;
  padding: 10px;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
  line-height: 1.5;
  color: inherit;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.order-card:hover {
  border-color: var(--color-primary, #e2231a);
  box-shadow: 0 2px 8px rgba(226, 35, 26, 0.12);
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.card-title {
  font-weight: 600;
  font-size: 13px;
}
.card-link {
  color: var(--color-primary, #e2231a);
  font-size: 12px;
}
.card-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 4px;
}
.card-row .label {
  color: #999;
  flex-shrink: 0;
}
.amount {
  color: var(--color-primary, #e2231a);
  font-weight: 600;
}
.card-reason {
  margin-top: 6px;
  color: #999;
  word-break: break-all;
}
.composer {
  margin-top: 12px;
  display: grid;
  gap: 8px;
}
.composer-actions {
  display: flex;
  gap: 8px;
}
.closed-tip {
  margin: 0;
  font-size: 12px;
  color: #e6a23c;
}
</style>
