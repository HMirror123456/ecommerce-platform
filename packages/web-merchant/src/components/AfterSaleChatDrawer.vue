<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import {
  closeMerchantChatThread,
  fetchMerchantChatMessages,
  openMerchantAfterSaleChat,
  sendMerchantChatMessage,
} from '@/api/merchant';
import { getAfterSaleCommunicationMode } from '@/utils/afterSaleCommunication';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  afterSaleId: { type: Number, default: null },
  /** 订单级等无售后会话：直接传入列表中的 thread */
  initialThread: { type: Object, default: null },
});
const emit = defineEmits(['update:modelValue', 'closed', 'read']);

const loading = ref(false);
const thread = ref(null);
const messages = ref([]);
const draft = ref('');
const sending = ref(false);
const closing = ref(false);
let pollTimer = null;

const TYPE_LABELS = {
  REFUND_ONLY: '仅退款',
  RETURN_REFUND: '退货退款',
};

const isOrderThread = computed(() => Boolean(thread.value && !thread.value.afterSaleId));

const drawerTitle = computed(() => {
  const currentThread = thread.value || props.initialThread;
  if (!currentThread) return '回复用户';
  if (!currentThread.afterSaleId) return currentThread.status === 'CLOSED' ? '查看会话' : '订单沟通';
  const mode = getAfterSaleCommunicationMode(currentThread.afterSaleStatus);
  return currentThread.status !== 'OPEN' || mode.isReadOnly ? '查看沟通' : '回复用户';
});

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('zh-CN');
}

function senderLabel(message) {
  if (message.senderType === 'MERCHANT') return '我';
  if (message.senderType === 'USER') return '用户';
  return '系统';
}

function isMine(message) {
  return message.senderType === 'MERCHANT';
}

function statusLabel(status) {
  return getAfterSaleCommunicationMode(status).displayText;
}

function typeLabel(type) {
  return TYPE_LABELS[type] || type || '-';
}

const threadOpen = computed(() => thread.value?.status === 'OPEN');

function isReadOnlyThread() {
  if (!threadOpen.value) return true;
  return getAfterSaleCommunicationMode(thread.value?.afterSaleStatus).isReadOnly;
}

function readOnlyHint() {
  if (!threadOpen.value) return '会话已关闭，无法继续发送';
  const communicationMode = getAfterSaleCommunicationMode(thread.value?.afterSaleStatus);
  if (communicationMode.isReadOnly) return `${communicationMode.displayText}，商家仅可查看历史沟通`;
  return '';
}

function metaLine() {
  if (!thread.value) return '';
  if (thread.value.afterSaleId) {
    return `售后沟通 · 售后单 #${thread.value.afterSaleId} · ${statusLabel(thread.value.afterSaleStatus)}`;
  }
  return `订单 ${thread.value.orderNo} · 订单沟通`;
}

async function loadMessages(reset) {
  if (!thread.value) return;
  try {
    const afterId = reset || !messages.value.length ? undefined : messages.value[messages.value.length - 1].id;
    const data = await fetchMerchantChatMessages(thread.value.id, afterId ? { afterId } : undefined);
    const list = data.list || [];
    if (reset || !afterId) messages.value = list;
    else if (list.length) messages.value = messages.value.concat(list);
    await nextTick();
    const box = document.getElementById('merchant-chat-scroll');
    if (box) box.scrollTop = box.scrollHeight;
  } catch (e) {
    ElMessage.error(e.message || '加载沟通消息失败');
  }
}

async function openThread() {
  loading.value = true;
  try {
    if (props.initialThread?.id) {
      thread.value = props.initialThread;
    } else if (props.afterSaleId) {
      thread.value = await openMerchantAfterSaleChat(props.afterSaleId);
    } else {
      ElMessage.warning('缺少会话信息');
      emit('update:modelValue', false);
      return;
    }
    await loadMessages(true);
    emit('read');
    startPoll();
  } catch (e) {
    ElMessage.error(e.message || '无法打开用户沟通会话');
    emit('update:modelValue', false);
  } finally {
    loading.value = false;
  }
}

async function onSend() {
  const content = draft.value.trim();
  if (!content || !thread.value || isReadOnlyThread()) return;
  sending.value = true;
  try {
    const message = await sendMerchantChatMessage(thread.value.id, { msgType: 'TEXT', content });
    messages.value.push(message);
    draft.value = '';
  } catch (e) {
    ElMessage.error(e.message || '发送失败，请稍后重试');
  } finally {
    sending.value = false;
  }
}

async function onCloseThread() {
  if (!thread.value?.id || !threadOpen.value || closing.value) return;
  closing.value = true;
  try {
    thread.value = await closeMerchantChatThread(thread.value.id);
    ElMessage.success('会话已关闭');
    emit('closed', thread.value);
  } catch (e) {
    ElMessage.error(e.message || '关闭会话失败');
  } finally {
    closing.value = false;
  }
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

watch(
  () => props.modelValue,
  (open) => {
    if (open) openThread();
    else {
      stopPoll();
      thread.value = null;
      messages.value = [];
      draft.value = '';
    }
  },
);

onUnmounted(stopPoll);
</script>

<template>
  <el-drawer
    :model-value="modelValue"
    :title="drawerTitle"
    size="400px"
    class="merchant-chat-drawer"
    @close="onClose"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-loading="loading" class="drawer-body">
      <div v-if="thread" class="thread-meta">
        <span>{{ metaLine() }}</span>
        <el-button
          v-if="threadOpen"
          link
          type="info"
          size="small"
          :loading="closing"
          @click="onCloseThread"
        >
          结束会话
        </el-button>
      </div>
      <div id="merchant-chat-scroll" class="msg-list">
        <el-empty v-if="!loading && !messages.length" description="暂无沟通消息" :image-size="72" />
        <div
          v-for="message in messages"
          :key="message.id"
          class="bubble-row"
          :class="{ mine: isMine(message), system: message.senderType === 'SYSTEM' }"
        >
          <div class="bubble">
            <div class="who">{{ senderLabel(message) }} · {{ formatTime(message.createdAt) }}</div>
            <div v-if="message.msgType === 'CARD'" class="card">
              <div class="card-title">{{ isOrderThread ? '订单摘要' : '订单与售后摘要' }}</div>
              <div>订单号：{{ message.payload && message.payload.orderNo }}</div>
              <template v-if="message.payload && message.payload.afterSaleId">
                <div>售后状态：{{ statusLabel(message.payload && message.payload.status) }}</div>
                <div>售后类型：{{ typeLabel(message.payload && message.payload.type) }}</div>
                <div>退款金额：¥{{ Number(message.payload && message.payload.amount || 0).toFixed(2) }}</div>
                <div class="muted">申请原因：{{ message.payload && message.payload.reason }}</div>
              </template>
              <template v-else>
                <div v-if="message.payload && message.payload.shopName">店铺：{{ message.payload.shopName }}</div>
                <div v-if="message.payload && message.payload.status">子单状态：{{ message.payload.status }}</div>
              </template>
            </div>
            <div v-else class="text">{{ message.content }}</div>
          </div>
        </div>
      </div>
      <div class="composer">
        <div v-if="isReadOnlyThread()" class="read-only-hint">{{ readOnlyHint() }}</div>
        <el-input
          v-model="draft"
          type="textarea"
          :rows="2"
          :placeholder="isOrderThread ? '回复用户的订单咨询…' : '回复用户的售后问题…'"
          :disabled="isReadOnlyThread()"
          @keydown.ctrl.enter="onSend"
        />
        <el-button type="primary" :disabled="isReadOnlyThread() || !draft.trim()" :loading="sending" @click="onSend">发送</el-button>
      </div>
    </div>
  </el-drawer>
</template>

<style scoped>
.drawer-body { display: flex; flex-direction: column; height: calc(100vh - 120px); }
.thread-meta {
  margin-bottom: 12px;
  padding: 10px 12px;
  color: #64748b;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border: 1px solid #edf0f5;
  border-radius: 8px;
  background: #fafbfd;
}
.msg-list { flex: 1; overflow: auto; padding: 14px; background: #f7f9fc; border: 1px solid #edf0f5; border-radius: 10px; }
.bubble-row { display: flex; margin-bottom: 12px; }
.bubble-row.mine { justify-content: flex-end; }
.bubble-row.system { justify-content: center; }
.bubble { max-width: 85%; padding: 9px 11px; background: #fff; border: 1px solid #edf0f5; border-radius: 10px; box-shadow: 0 1px 2px rgba(15, 23, 42, .03); }
.bubble-row.mine .bubble { background: #eaf3ff; border-color: #cfe4ff; }
.bubble-row.system .bubble { max-width: 92%; background: #fff8eb; border-color: #f8dfaa; }
.who { margin-bottom: 5px; color: #94a3b8; font-size: 11px; }
.text { white-space: pre-wrap; color: #334155; font-size: 13px; line-height: 1.6; }
.card { padding: 9px; border: 1px solid #e8edf5; border-radius: 7px; background: rgba(255,255,255,.72); font-size: 12px; line-height: 1.75; }
.card-title { margin-bottom: 5px; color: #1f2937; font-weight: 700; }
.muted { color: #94a3b8; }
.read-only-hint { padding: 8px 10px; color: #64748b; font-size: 12px; line-height: 18px; border-radius: 6px; background: #f4f6f8; }
.composer { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; margin-top: 14px; align-items: end; }
.composer .read-only-hint { grid-column: 1 / -1; }
.composer :deep(.el-button) { min-width: 72px; height: 32px; }
.merchant-chat-drawer :deep(.el-drawer__header) { margin-bottom: 16px; color: #1f2937; font-weight: 700; }
@media (max-width: 520px) {
  .composer { grid-template-columns: 1fr; }
  .composer :deep(.el-button) { width: 100%; }
}
</style>
