<script setup>
import { nextTick, onUnmounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { fetchChatMessages, openAfterSaleChat, sendChatMessage } from '@/api/chat';

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

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('zh-CN');
}

function senderLabel(msg) {
  if (msg.senderType === 'USER') return '我';
  if (msg.senderType === 'CS_AGENT') return '客服';
  return '系统';
}

function isMine(msg) {
  return msg.senderType === 'USER';
}

async function loadMessages(reset) {
  if (!thread.value) return;
  try {
    const afterId = reset || !messages.value.length ? undefined : messages.value[messages.value.length - 1].id;
    const data = await fetchChatMessages(thread.value.id, afterId ? { afterId } : undefined);
    const list = data.list || [];
    if (reset || !afterId) messages.value = list;
    else if (list.length) messages.value = messages.value.concat(list);
    await nextTick();
    const box = document.getElementById('user-chat-scroll');
    if (box) box.scrollTop = box.scrollHeight;
  } catch (e) {
    ElMessage.error(e.message || '加载消息失败');
  }
}

async function openThread() {
  if (!props.afterSaleId) return;
  loading.value = true;
  try {
    thread.value = await openAfterSaleChat(props.afterSaleId);
    await loadMessages(true);
    startPoll();
  } catch (e) {
    ElMessage.error(e.message || '无法打开客服会话');
    emit('update:modelValue', false);
  } finally {
    loading.value = false;
  }
}

async function onSend() {
  const text = draft.value.trim();
  if (!text || !thread.value) return;
  sending.value = true;
  try {
    const msg = await sendChatMessage(thread.value.id, { msgType: 'TEXT', content: text });
    messages.value.push(msg);
    draft.value = '';
  } catch (e) {
    ElMessage.error(e.message || '发送失败');
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
    title="平台客服"
    size="400px"
    @close="onClose"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div v-loading="loading" class="drawer-body">
      <div v-if="thread" class="thread-meta">
        订单 {{ thread.orderNo }} · 售后 #{{ thread.afterSaleId }} · {{ thread.afterSaleStatus }}
      </div>
      <div id="user-chat-scroll" class="msg-list">
        <div
          v-for="m in messages"
          :key="m.id"
          class="bubble-row"
          :class="{ mine: isMine(m), system: m.senderType === 'SYSTEM' }"
        >
          <div class="bubble">
            <div class="who">{{ senderLabel(m) }} · {{ formatTime(m.createdAt) }}</div>
            <div v-if="m.msgType === 'CARD'" class="card">
              <div class="card-title">订单卡片</div>
              <div>订单号：{{ m.payload && m.payload.orderNo }}</div>
              <div>售后状态：{{ m.payload && m.payload.status }}</div>
              <div>类型：{{ m.payload && m.payload.type }}</div>
              <div class="muted">原因：{{ m.payload && m.payload.reason }}</div>
            </div>
            <div v-else class="text">{{ m.content }}</div>
          </div>
        </div>
      </div>
      <div class="composer">
        <el-input
          v-model="draft"
          type="textarea"
          :rows="2"
          placeholder="描述您的问题…"
          @keydown.ctrl.enter="onSend"
        />
        <el-button type="primary" :loading="sending" @click="onSend">发送</el-button>
      </div>
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
  color: #999;
  margin-bottom: 8px;
}
.msg-list {
  flex: 1;
  overflow: auto;
  background: #f5f5f5;
  border-radius: 8px;
  padding: 12px;
}
.bubble-row {
  display: flex;
  margin-bottom: 10px;
}
.bubble-row.mine { justify-content: flex-end; }
.bubble-row.system { justify-content: center; }
.bubble {
  max-width: 85%;
  background: #fff;
  border-radius: 8px;
  padding: 8px 10px;
}
.bubble-row.mine .bubble { background: #ffe7e7; }
.bubble-row.system .bubble { background: #fff7e6; }
.who { font-size: 11px; color: #999; margin-bottom: 4px; }
.text { white-space: pre-wrap; line-height: 1.5; font-size: 13px; }
.card {
  border: 1px solid #eee;
  border-radius: 6px;
  padding: 8px;
  font-size: 12px;
  line-height: 1.5;
}
.card-title { font-weight: 600; margin-bottom: 4px; }
.muted { color: #999; }
.composer {
  margin-top: 12px;
  display: grid;
  gap: 8px;
}
</style>
