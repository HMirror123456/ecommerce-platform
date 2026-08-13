<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ChatDotRound, Shop } from '@element-plus/icons-vue';
import { fetchChatMessages, openAfterSaleChat, openMerchantChat, openOrderMerchantChat, sendChatMessage } from '@/api/chat';

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

const ORDER_STATUS_LABELS = {
  PENDING_PAYMENT: '待支付',
  PENDING_SHIPMENT: '待发货',
  SHIPPED: '已发货',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  REFUNDING: '退款中',
  REFUNDED: '已退款',
};

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  afterSaleId: { type: Number, default: null },
  /** 订单级联系商家时使用 */
  orderId: { type: Number, default: null },
  merchantId: { type: Number, default: null },
  /** USER_CS | USER_MERCHANT */
  threadType: { type: String, default: 'USER_CS' },
  /** 商家售后会话中展示「申请平台介入」 */
  canEscalate: { type: Boolean, default: false },
});
const emit = defineEmits(['update:modelValue', 'escalate']);

const router = useRouter();
const loading = ref(false);
const openError = ref('');
const thread = ref(null);
const messages = ref([]);
const draft = ref('');
const sending = ref(false);
let pollTimer = null;

const isMerchantChat = computed(() => props.threadType === 'USER_MERCHANT');
const isOrderMerchantChat = computed(
  () => isMerchantChat.value && !props.afterSaleId && props.orderId && props.merchantId,
);
const drawerTitle = computed(() => (isMerchantChat.value ? '联系商家' : '平台客服'));
const drawerSubtitle = computed(() =>
  isMerchantChat.value ? '与店铺协商售后 / 发货问题' : '平台客服协助处理纠纷',
);
const threadOpen = computed(() => thread.value?.status === 'OPEN');
const showEmpty = computed(() => !loading.value && !openError.value && thread.value && messages.value.length === 0);

const threadStatusLabel = computed(() => {
  if (thread.value?.afterSaleStatus) {
    return AFTER_SALE_STATUS_LABELS[thread.value.afterSaleStatus] || thread.value.afterSaleStatus;
  }
  return '';
});

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPrice(value) {
  if (value == null || Number.isNaN(Number(value))) return '-';
  return `¥${Number(value).toFixed(2)}`;
}

function typeLabel(type) {
  return AFTER_SALE_TYPE_LABELS[type] || type || '-';
}

function statusLabel(status) {
  return AFTER_SALE_STATUS_LABELS[status] || ORDER_STATUS_LABELS[status] || status || '-';
}

function senderLabel(msg) {
  if (msg.senderType === 'USER') return '我';
  if (msg.senderType === 'CS_AGENT') return '客服';
  if (msg.senderType === 'MERCHANT') return '商家';
  return '系统';
}

function avatarText(msg) {
  if (msg.senderType === 'USER') return '我';
  if (msg.senderType === 'CS_AGENT') return '客';
  if (msg.senderType === 'MERCHANT') return '商';
  return '系';
}

function isMine(msg) {
  return msg.senderType === 'USER';
}

function isSystem(msg) {
  return msg.senderType === 'SYSTEM';
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
  const needAfterSale = props.threadType === 'USER_CS' || (isMerchantChat.value && props.afterSaleId);
  if (needAfterSale && !props.afterSaleId) {
    openError.value = isMerchantChat.value
      ? '缺少售后单信息，无法联系商家'
      : '缺少售后单信息，无法打开客服会话';
    return;
  }
  if (isOrderMerchantChat.value && (!props.orderId || !props.merchantId)) {
    openError.value = '缺少订单或商家信息，无法联系商家';
    return;
  }

  loading.value = true;
  openError.value = '';
  try {
    if (props.threadType === 'USER_CS') {
      thread.value = await openAfterSaleChat(props.afterSaleId);
    } else if (props.afterSaleId) {
      thread.value = await openMerchantChat(props.afterSaleId);
    } else {
      thread.value = await openOrderMerchantChat(props.orderId, { merchantId: props.merchantId });
    }
    await loadMessages(true);
    startPoll();
  } catch (e) {
    openError.value =
      e.message ||
      (isMerchantChat.value
        ? '无法打开商家会话，请稍后重试'
        : '无法打开客服会话，请确认已申请平台介入后重试');
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
    :with-header="false"
    size="440px"
    class="chat-drawer"
    @close="onClose"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="chat-shell" :class="isMerchantChat ? 'theme-merchant' : 'theme-cs'">
      <header class="chat-header">
        <div class="header-left">
          <div class="header-avatar">
            <el-icon>
              <Shop v-if="isMerchantChat" />
              <ChatDotRound v-else />
            </el-icon>
          </div>
          <div class="header-text">
            <h3 class="header-title">{{ drawerTitle }}</h3>
            <p class="header-sub">{{ drawerSubtitle }}</p>
          </div>
        </div>
        <button type="button" class="close-btn" aria-label="关闭" @click="onClose">×</button>
      </header>

      <div v-loading="loading" class="drawer-body">
        <div v-if="openError" class="error-box">
          <div class="error-icon">!</div>
          <p class="error-text">{{ openError }}</p>
          <el-button type="primary" size="small" @click="retryOpen">重试</el-button>
        </div>

        <template v-else>
          <div v-if="thread" class="thread-meta">
            <div class="meta-main">
              <span class="meta-order">订单 {{ thread.orderNo }}</span>
              <span v-if="thread.afterSaleId" class="meta-chip">售后 #{{ thread.afterSaleId }}</span>
              <span v-if="thread.shopName" class="meta-chip shop">{{ thread.shopName }}</span>
              <span v-if="threadStatusLabel" class="meta-chip status">{{ threadStatusLabel }}</span>
            </div>
            <span class="meta-state" :class="threadOpen ? 'open' : 'closed'">
              {{ threadOpen ? '进行中' : '已关闭' }}
            </span>
          </div>

          <div id="user-chat-scroll" class="msg-list">
            <div v-if="showEmpty" class="empty-msg">
              <div class="empty-icon">
                <el-icon><ChatDotRound /></el-icon>
              </div>
              <p>暂无消息</p>
              <span>可先发送文字，或附上订单卡片说明问题</span>
            </div>

            <div
              v-for="m in messages"
              :key="m.id"
              class="bubble-row"
              :class="{
                mine: isMine(m),
                system: isSystem(m),
                peer: !isMine(m) && !isSystem(m),
              }"
            >
              <template v-if="isSystem(m)">
                <div class="system-chip">
                  <span>{{ m.content }}</span>
                  <time>{{ formatTime(m.createdAt) }}</time>
                </div>
              </template>

              <template v-else>
                <div
                  v-if="!isMine(m)"
                  class="msg-avatar"
                  :class="m.senderType === 'MERCHANT' ? 'merchant' : 'cs'"
                >
                  {{ avatarText(m) }}
                </div>

                <div class="bubble-wrap">
                  <div class="who">
                    <span>{{ senderLabel(m) }}</span>
                    <time>{{ formatTime(m.createdAt) }}</time>
                  </div>
                  <div class="bubble">
                    <button
                      v-if="m.msgType === 'CARD'"
                      type="button"
                      class="order-card"
                      @click="goOrderFromCard(m.payload)"
                    >
                      <div class="card-head">
                        <span class="card-title">订单卡片</span>
                        <span class="card-link">查看 ›</span>
                      </div>
                      <div class="card-body">
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
                          <span>{{ m.payload?.type ? typeLabel(m.payload.type) : '订单沟通' }}</span>
                        </div>
                        <div class="card-row">
                          <span class="label">状态</span>
                          <span>{{
                            statusLabel(m.payload?.status || m.payload?.orderStatus || m.payload?.subOrderStatus)
                          }}</span>
                        </div>
                        <div class="card-row">
                          <span class="label">金额</span>
                          <span class="amount">{{ formatPrice(m.payload?.amount) }}</span>
                        </div>
                        <div v-if="m.payload?.itemTitles?.length" class="card-reason">
                          商品：{{ m.payload.itemTitles.join('、') }}
                        </div>
                        <div v-if="m.payload?.reason" class="card-reason">原因：{{ m.payload.reason }}</div>
                      </div>
                    </button>
                    <div v-else class="text">{{ m.content }}</div>
                  </div>
                </div>

                <div v-if="isMine(m)" class="msg-avatar mine">我</div>
              </template>
            </div>
          </div>

          <div class="composer">
            <p v-if="thread && !threadOpen" class="closed-tip">会话已关闭，无法继续发送</p>
            <div v-if="isMerchantChat && canEscalate && afterSaleId" class="escalate-row">
              <el-button type="warning" plain size="small" @click="emit('escalate')">
                仍要申请平台介入
              </el-button>
            </div>
            <div class="composer-toolbar">
              <el-button
                size="small"
                :disabled="!threadOpen || sending"
                :loading="sending"
                @click="onSendCard"
              >
                发送订单卡片
              </el-button>
            </div>
            <div class="composer-input">
              <el-input
                v-model="draft"
                type="textarea"
                :rows="2"
                resize="none"
                :placeholder="isMerchantChat ? '与商家沟通…（Ctrl+Enter 发送）' : '描述您的问题…（Ctrl+Enter 发送）'"
                :disabled="!threadOpen || sending"
                @keydown.ctrl.enter="onSend"
              />
              <el-button
                type="primary"
                class="send-btn"
                :loading="sending"
                :disabled="!threadOpen || !draft.trim()"
                @click="onSend"
              >
                发送
              </el-button>
            </div>
          </div>
        </template>
      </div>
    </div>
  </el-drawer>
</template>

<style scoped>
.chat-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  margin: -20px;
  background: #f7f8fa;
  box-sizing: border-box;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 32px 28px 24px;
  color: #fff;
  flex-shrink: 0;
}

.theme-cs .chat-header {
  background:
    radial-gradient(circle at 90% 10%, rgba(255, 255, 255, 0.18), transparent 40%),
    linear-gradient(135deg, #e4393c 0%, #c81623 100%);
}

.theme-merchant .chat-header {
  background:
    radial-gradient(circle at 90% 10%, rgba(255, 255, 255, 0.18), transparent 40%),
    linear-gradient(135deg, #fa8c16 0%, #d46b08 100%);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
  min-width: 0;
  padding-left: 4px;
}

.header-avatar {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  background: rgba(255, 255, 255, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.4);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  flex-shrink: 0;
}

.header-text {
  padding-top: 1px;
}

.header-title {
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 0.02em;
  line-height: 1.25;
}

.header-sub {
  margin: 0;
  font-size: 12px;
  opacity: 0.9;
  line-height: 1.4;
}

.close-btn {
  width: 36px;
  height: 36px;
  margin-top: 2px;
  margin-right: 4px;
  border: none;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  flex-shrink: 0;
  align-self: flex-start;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.28);
}

.drawer-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  padding: 14px 16px 16px;
}

.thread-meta {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
  padding: 10px 12px;
  background: #fff;
  border: 1px solid var(--border-color, #e8e8e8);
  border-radius: 10px;
}

.meta-main {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  min-width: 0;
}

.meta-order {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-title, #333);
}

.meta-chip {
  display: inline-flex;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 11px;
  background: #f5f5f5;
  color: var(--text-muted, #999);
}

.meta-chip.shop {
  background: #fff7e6;
  color: #d48806;
}

.meta-chip.status {
  background: #fff1f0;
  color: var(--color-primary, #e4393c);
}

.meta-state {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
}

.meta-state.open {
  background: #f6ffed;
  color: #389e0d;
}

.meta-state.closed {
  background: #f5f5f5;
  color: #999;
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

.error-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 800;
  color: #fff;
  background: #faad14;
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
  background:
    radial-gradient(circle at 12% 8%, rgba(228, 57, 60, 0.04), transparent 28%),
    #eef0f3;
  border-radius: 12px;
  padding: 18px 16px 20px;
  min-height: 280px;
}

.theme-merchant .msg-list {
  background:
    radial-gradient(circle at 12% 8%, rgba(250, 140, 22, 0.06), transparent 28%),
    #eef0f3;
}

.empty-msg {
  height: 100%;
  min-height: 180px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #999;
  text-align: center;
  padding: 16px;
}

.empty-icon {
  width: 56px;
  height: 56px;
  margin-bottom: 6px;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  color: #fff;
  background: linear-gradient(135deg, #e4393c, #ff7875);
}

.theme-merchant .empty-icon {
  background: linear-gradient(135deg, #fa8c16, #ffc069);
}

.empty-msg p {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-body, #666);
}

.empty-msg span {
  font-size: 12px;
}

.bubble-row {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  margin-bottom: 16px;
  padding: 0 4px;
}

.bubble-row.mine {
  justify-content: flex-end;
}

.bubble-row.peer {
  padding-left: 2px;
}

.bubble-row.system {
  justify-content: center;
  padding: 0 12px;
}

.msg-avatar {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
  margin-bottom: 2px;
}

.msg-avatar.cs {
  background: linear-gradient(135deg, #e4393c, #ff7875);
}

.msg-avatar.merchant {
  background: linear-gradient(135deg, #fa8c16, #ffc069);
}

.msg-avatar.mine {
  background: linear-gradient(135deg, #595959, #8c8c8c);
}

.bubble-wrap {
  max-width: calc(100% - 84px);
  min-width: 0;
}

.who {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 11px;
  color: #999;
}

.bubble-row.mine .who {
  justify-content: flex-end;
}

.bubble {
  background: #fff;
  border-radius: 14px 14px 14px 4px;
  padding: 10px 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.bubble-row.mine .bubble {
  background: linear-gradient(135deg, #fff1f0, #ffe4e4);
  border-radius: 14px 14px 4px 14px;
  border: 1px solid #ffccc7;
}

.theme-merchant .bubble-row.mine .bubble {
  background: linear-gradient(135deg, #fff7e6, #ffe7ba);
  border-color: #ffd591;
}

.system-chip {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  max-width: 90%;
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.04);
  color: #888;
  font-size: 12px;
  text-align: center;
}

.system-chip time {
  font-size: 10px;
  opacity: 0.8;
}

.text {
  white-space: pre-wrap;
  line-height: 1.55;
  font-size: 14px;
  color: var(--text-title, #333);
}

.order-card {
  display: block;
  width: 100%;
  min-width: 220px;
  text-align: left;
  border: 1px solid #f0f0f0;
  border-radius: 10px;
  padding: 0;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
  line-height: 1.5;
  color: inherit;
  overflow: hidden;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.order-card:hover {
  border-color: var(--color-primary, #e4393c);
  box-shadow: 0 4px 12px rgba(228, 57, 60, 0.12);
}

.theme-merchant .order-card:hover {
  border-color: #fa8c16;
  box-shadow: 0 4px 12px rgba(250, 140, 22, 0.14);
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: linear-gradient(90deg, #fff1f0, #fff);
  border-bottom: 1px solid #f5f5f5;
}

.theme-merchant .card-head {
  background: linear-gradient(90deg, #fff7e6, #fff);
}

.card-title {
  font-weight: 700;
  font-size: 13px;
}

.card-link {
  color: var(--color-primary, #e4393c);
  font-size: 12px;
  font-weight: 600;
}

.theme-merchant .card-link {
  color: #d46b08;
}

.card-body {
  padding: 8px 10px 10px;
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
  color: var(--color-primary, #e4393c);
  font-weight: 700;
}

.card-reason {
  margin-top: 6px;
  color: #999;
  word-break: break-all;
}

.composer {
  margin-top: 10px;
  padding: 12px;
  background: #fff;
  border: 1px solid var(--border-color, #e8e8e8);
  border-radius: 12px;
  display: grid;
  gap: 8px;
  flex-shrink: 0;
}

.composer-toolbar {
  display: flex;
  gap: 8px;
}

.composer-input {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
  align-items: end;
}

.send-btn {
  height: 54px;
  min-width: 72px;
}

.closed-tip {
  margin: 0;
  font-size: 12px;
  color: #d48806;
  background: #fffbe6;
  border: 1px solid #ffe58f;
  border-radius: 8px;
  padding: 8px 10px;
}

.escalate-row {
  margin-bottom: 0;
}
</style>

<style>
/* 抽屉本体去默认内边距，交给 chat-shell 铺满 */
.chat-drawer .el-drawer__body {
  padding: 0 !important;
  height: 100%;
  overflow: hidden;
}
</style>
