<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  closeChatThread,
  fetchChatMessages,
  fetchChatThreads,
  runChatAction,
  sendChatMessage,
} from '@/api/chat';

const loading = ref(false);
const threads = ref([]);
const activeId = ref(null);
const messages = ref([]);
const draft = ref('');
const sending = ref(false);
const rejectVisible = ref(false);
const rejectReason = ref('');
let pollTimer = null;

const activeThread = computed(() => threads.value.find((t) => t.id === activeId.value) || null);
const canArbitrate = computed(() => {
  const t = activeThread.value;
  return t && t.afterSaleStatus === 'ESCALATED';
});

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('zh-CN');
}

function senderLabel(msg) {
  if (msg.senderType === 'USER') return '用户';
  if (msg.senderType === 'CS_AGENT') return '客服';
  return '系统';
}

function isMine(msg) {
  return msg.senderType === 'CS_AGENT';
}

async function loadThreads() {
  loading.value = true;
  try {
    const data = await fetchChatThreads({ status: 'OPEN' });
    threads.value = data.list || [];
    if (!activeId.value && threads.value.length) {
      activeId.value = threads.value[0].id;
    }
  } catch (e) {
    ElMessage.error(e.message || '加载会话失败');
  } finally {
    loading.value = false;
  }
}

async function loadMessages(reset) {
  if (!activeId.value) {
    messages.value = [];
    return;
  }
  try {
    const afterId = reset || !messages.value.length ? undefined : messages.value[messages.value.length - 1].id;
    const data = await fetchChatMessages(activeId.value, afterId ? { afterId } : undefined);
    const list = data.list || [];
    if (reset || !afterId) {
      messages.value = list;
    } else if (list.length) {
      messages.value = messages.value.concat(list);
    }
    await nextTick();
    const box = document.getElementById('cs-chat-scroll');
    if (box) box.scrollTop = box.scrollHeight;
  } catch (e) {
    ElMessage.error(e.message || '加载消息失败');
  }
}

function selectThread(row) {
  activeId.value = row.id;
}

async function onSend() {
  const text = draft.value.trim();
  if (!text || !activeId.value) return;
  sending.value = true;
  try {
    const msg = await sendChatMessage(activeId.value, { msgType: 'TEXT', content: text });
    messages.value.push(msg);
    draft.value = '';
    await loadThreads();
  } catch (e) {
    ElMessage.error(e.message || '发送失败');
  } finally {
    sending.value = false;
  }
}

async function insertCard() {
  if (!activeId.value) return;
  sending.value = true;
  try {
    const msg = await sendChatMessage(activeId.value, { msgType: 'CARD' });
    messages.value.push(msg);
  } catch (e) {
    ElMessage.error(e.message || '发送卡片失败');
  } finally {
    sending.value = false;
  }
}

async function onCloseThread() {
  if (!activeId.value) return;
  try {
    await ElMessageBox.confirm('确认结束该客服会话？结束后不可再发送消息。', '结束会话', {
      type: 'warning',
    });
    await closeChatThread(activeId.value);
    ElMessage.success('会话已关闭');
    activeId.value = null;
    messages.value = [];
    await loadThreads();
  } catch (e) {
    if (e !== 'cancel' && e?.message) ElMessage.error(e.message);
  }
}

async function onApprove() {
  try {
    await ElMessageBox.confirm('确认同意该售后？（将调用平台仲裁接口）', '同意售后', { type: 'success' });
    const data = await runChatAction(activeId.value, 'CS_APPROVE', {});
    if (data.message) messages.value.push(data.message);
    ElMessage.success('已裁定同意');
    await loadThreads();
  } catch (e) {
    if (e !== 'cancel' && e && e.message) ElMessage.error(e.message);
  }
}

function openReject() {
  rejectReason.value = '';
  rejectVisible.value = true;
}

async function onReject() {
  if (!rejectReason.value.trim()) {
    ElMessage.warning('请填写拒绝原因');
    return;
  }
  try {
    const data = await runChatAction(activeId.value, 'CS_REJECT', { reason: rejectReason.value.trim() });
    if (data.message) messages.value.push(data.message);
    rejectVisible.value = false;
    ElMessage.success('已裁定拒绝');
    await loadThreads();
  } catch (e) {
    ElMessage.error(e.message || '操作失败');
  }
}

async function onHintReturn() {
  try {
    const data = await runChatAction(activeId.value, 'HINT_RETURN', {});
    if (data.message) messages.value.push(data.message);
  } catch (e) {
    ElMessage.error(e.message || '操作失败');
  }
}

function startPoll() {
  stopPoll();
  pollTimer = setInterval(() => {
    if (activeId.value) loadMessages(false);
  }, 4000);
}

function stopPoll() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

watch(activeId, async (id) => {
  if (id) await loadMessages(true);
});

onMounted(async () => {
  await loadThreads();
  startPoll();
});

onUnmounted(stopPoll);
</script>

<template>
  <div class="chat-page" v-loading="loading">
    <aside class="thread-pane">
      <div class="pane-title">售后会话</div>
      <div v-if="!threads.length" class="empty-hint">暂无进行中的用户客服会话</div>
      <div
        v-for="t in threads"
        :key="t.id"
        class="thread-item"
        :class="{ active: t.id === activeId }"
        @click="selectThread(t)"
      >
        <div class="t-no">{{ t.orderNo }}</div>
        <div class="t-meta">售后 #{{ t.afterSaleId }} · {{ t.afterSaleStatus || '-' }}</div>
      </div>
    </aside>

    <section class="msg-pane">
      <template v-if="activeThread">
        <div class="msg-header">
          <div>
            <strong>{{ activeThread.orderNo }}</strong>
            <span class="muted"> · 售后 #{{ activeThread.afterSaleId }} · {{ activeThread.afterSaleStatus }}</span>
          </div>
          <div class="quick" v-if="canArbitrate">
            <el-button size="small" type="success" @click="onApprove">同意售后</el-button>
            <el-button size="small" type="danger" @click="openReject">拒绝售后</el-button>
            <el-button size="small" @click="onHintReturn">引导寄回</el-button>
          </div>
          <div class="quick" v-else>
            <el-button size="small" @click="onHintReturn">引导寄回</el-button>
          </div>
          <el-button size="small" type="info" plain @click="onCloseThread">结束会话</el-button>
        </div>

        <div id="cs-chat-scroll" class="msg-list">
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
                <div v-if="m.payload && m.payload.amount != null">金额：¥{{ m.payload.amount }}</div>
                <div class="muted">原因：{{ m.payload && m.payload.reason }}</div>
              </div>
              <div v-else class="text">{{ m.content }}</div>
            </div>
          </div>
        </div>

        <div class="composer">
          <el-button @click="insertCard">插入订单卡片</el-button>
          <el-input
            v-model="draft"
            type="textarea"
            :rows="2"
            placeholder="输入回复…"
            @keydown.ctrl.enter="onSend"
          />
          <el-button type="primary" :loading="sending" @click="onSend">发送</el-button>
        </div>
      </template>
      <el-empty v-else description="请选择左侧会话" />
    </section>

    <el-dialog v-model="rejectVisible" title="拒绝售后" width="420px">
      <el-input v-model="rejectReason" type="textarea" :rows="3" placeholder="拒绝原因（必填）" />
      <template #footer>
        <el-button @click="rejectVisible = false">取消</el-button>
        <el-button type="danger" @click="onReject">确认拒绝</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.chat-page {
  display: flex;
  height: calc(100vh - 120px);
  min-height: 480px;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  overflow: hidden;
}
.thread-pane {
  width: 280px;
  border-right: 1px solid #e8e8e8;
  overflow: auto;
  background: #fafafa;
}
.pane-title {
  padding: 14px 16px;
  font-weight: 600;
  border-bottom: 1px solid #e8e8e8;
}
.empty-hint {
  padding: 24px 16px;
  color: #999;
  font-size: 13px;
}
.thread-item {
  padding: 12px 16px;
  cursor: pointer;
  border-bottom: 1px solid #f0f0f0;
}
.thread-item:hover,
.thread-item.active {
  background: #e6f4ff;
}
.t-no { font-weight: 600; color: #333; }
.t-meta { font-size: 12px; color: #999; margin-top: 4px; }
.msg-pane {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.msg-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #e8e8e8;
  flex-wrap: wrap;
}
.muted { color: #999; font-size: 13px; }
.quick { display: flex; gap: 8px; flex-wrap: wrap; }
.msg-list {
  flex: 1;
  overflow: auto;
  padding: 16px;
  background: #f5f5f5;
}
.bubble-row {
  display: flex;
  margin-bottom: 12px;
}
.bubble-row.mine { justify-content: flex-end; }
.bubble-row.system { justify-content: center; }
.bubble {
  max-width: 72%;
  background: #fff;
  border-radius: 8px;
  padding: 10px 12px;
  box-shadow: 0 1px 2px rgba(0,0,0,.04);
}
.bubble-row.mine .bubble { background: #d6eaff; }
.bubble-row.system .bubble { background: #fff7e6; max-width: 90%; }
.who { font-size: 12px; color: #999; margin-bottom: 4px; }
.text { white-space: pre-wrap; line-height: 1.5; color: #333; }
.card {
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  padding: 10px;
  font-size: 13px;
  line-height: 1.6;
  background: #fff;
}
.card-title { font-weight: 600; margin-bottom: 4px; }
.composer {
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #e8e8e8;
  align-items: end;
}
</style>
