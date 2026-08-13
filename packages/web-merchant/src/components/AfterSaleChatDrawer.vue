<script setup>
import { nextTick, onUnmounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import {
  fetchMerchantChatMessages,
  openMerchantAfterSaleChat,
  sendMerchantChatMessage,
} from '@/api/merchant';

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  afterSaleId: { type: Number, default: null },
});
const emit = defineEmits(['update:modelValue']);

const loading = ref(false);
const thread = ref(null);
const messages = ref([]);
const draft = ref('');
const sending = ref(false);
let pollTimer = null;

const STATUS_LABELS = {
  APPLIED: '待商家处理',
  APPROVED: '等待用户寄回',
  RETURNING: '用户已寄回，待商家验收',
  REFUNDED: '退款已完成',
  REJECTED: '售后已拒绝',
  ESCALATED: '平台仲裁中',
};

const TYPE_LABELS = {
  REFUND_ONLY: '仅退款',
  RETURN_REFUND: '退货退款',
};

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
  return STATUS_LABELS[status] || status || '-';
}

function typeLabel(type) {
  return TYPE_LABELS[type] || type || '-';
}

function isReadOnlyThread() {
  return ['REFUNDED', 'ESCALATED'].includes(thread.value?.afterSaleStatus);
}

function readOnlyHint() {
  if (thread.value?.afterSaleStatus === 'ESCALATED') {
    return '该售后已进入平台仲裁，商家仅可查看历史沟通';
  }
  if (thread.value?.afterSaleStatus === 'REFUNDED') {
    return '售后已完成，仅查看沟通记录';
  }
  return '';
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
  if (!props.afterSaleId) return;
  loading.value = true;
  try {
    thread.value = await openMerchantAfterSaleChat(props.afterSaleId);
    await loadMessages(true);
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
  if (!content || !thread.value) return;
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
    title="回复用户"
    size="400px"
    @close="onClose"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-loading="loading" class="drawer-body">
      <div v-if="thread" class="thread-meta">
        订单 {{ thread.orderNo }} · 售后 #{{ thread.afterSaleId }} · {{ statusLabel(thread.afterSaleStatus) }}
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
              <div class="card-title">订单与售后摘要</div>
              <div>订单号：{{ message.payload && message.payload.orderNo }}</div>
              <div>售后状态：{{ statusLabel(message.payload && message.payload.status) }}</div>
              <div>售后类型：{{ typeLabel(message.payload && message.payload.type) }}</div>
              <div>退款金额：¥{{ Number(message.payload && message.payload.amount || 0).toFixed(2) }}</div>
              <div class="muted">申请原因：{{ message.payload && message.payload.reason }}</div>
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
          placeholder="回复用户的售后问题…"
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
.thread-meta { margin-bottom: 8px; color: #999; font-size: 12px; }
.msg-list { flex: 1; overflow: auto; padding: 12px; background: #f5f5f5; border-radius: 8px; }
.bubble-row { display: flex; margin-bottom: 10px; }
.bubble-row.mine { justify-content: flex-end; }
.bubble-row.system { justify-content: center; }
.bubble { max-width: 85%; padding: 8px 10px; background: #fff; border-radius: 8px; }
.bubble-row.mine .bubble { background: #e8f3ff; }
.bubble-row.system .bubble { background: #fff7e6; }
.who { margin-bottom: 4px; color: #999; font-size: 11px; }
.text { white-space: pre-wrap; font-size: 13px; line-height: 1.5; }
.card { padding: 8px; border: 1px solid #eee; border-radius: 6px; font-size: 12px; line-height: 1.7; }
.card-title { margin-bottom: 4px; font-weight: 600; }
.muted { color: #999; }
.read-only-hint { color: #909399; font-size: 12px; }
.composer { display: grid; gap: 8px; margin-top: 12px; }
</style>
