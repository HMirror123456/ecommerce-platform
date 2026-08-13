<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  applyAfterSale,
  cancelOrder,
  confirmReceipt,
  confirmSubOrderReceipt,
  escalateAfterSale,
  fetchOrder,
  submitAfterSaleReturn,
} from '@/api/order';
import { addCartItem } from '@/api/cart';
import { getAfterSaleChatThread, getMerchantChatThread } from '@/api/chat';
import AfterSaleChatDrawer from '@/components/AfterSaleChatDrawer.vue';

const ORDER_STATUS_LABELS = {
  PENDING_PAYMENT: '待支付',
  PENDING_SHIPMENT: '待发货',
  SHIPPED: '已发货',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
  REFUNDING: '退款中',
  REFUNDED: '已退款',
};

const AFTER_SALE_STATUS_LABELS = {
  APPLIED: '待商家处理',
  APPROVED: '商家已同意',
  REJECTED: '商家已拒绝',
  ESCALATED: '平台仲裁中',
  RETURNING: '退货中',
  REFUNDED: '已退款',
};

const AFTER_SALE_TYPES = [
  { label: '仅退款', value: 'REFUND_ONLY' },
  { label: '退货退款', value: 'RETURN_REFUND' },
];

const route = useRoute();
const router = useRouter();
const orderId = computed(() => Number(route.params.orderId));

const loading = ref(false);
const submitting = ref(false);
const rebuying = ref(false);
const order = ref(null);
const dialogVisible = ref(false);
const form = ref({
  type: 'REFUND_ONLY',
  reason: '',
  subOrderId: null,
  selectedSkuIds: [],
});

const returnDialogVisible = ref(false);
const returnSubmitting = ref(false);
const returnTarget = ref(null);
const returnForm = ref({
  logisticsCompany: '',
  trackingNo: '',
});

const chatVisible = ref(false);
const chatAfterSaleId = ref(null);
const chatOrderId = ref(null);
const chatMerchantId = ref(null);
const chatThreadType = ref('USER_CS');
const chatCanEscalate = ref(false);
const chatInitialThread = ref(null);
const merchantChatTarget = ref(null);

/** 驱动支付倒计时刷新 */
const nowMs = ref(Date.now());
let tickTimer = null;

const OCCUPIED_AFTER_SALE = new Set(['APPLIED', 'ESCALATED', 'APPROVED', 'RETURNING', 'REFUNDED']);

const occupiedQtyBySku = computed(() => {
  const map = new Map();
  for (const as of order.value?.afterSales || []) {
    if (!OCCUPIED_AFTER_SALE.has(as.status)) continue;
    for (const line of as.items || []) {
      const skuId = Number(line.skuId);
      const qty = Number(line.quantity) || 0;
      map.set(skuId, (map.get(skuId) || 0) + qty);
    }
  }
  return map;
});

const shippableSubOrders = computed(() =>
  (order.value?.subOrders || []).filter((s) => ['SHIPPED', 'COMPLETED', 'REFUNDING'].includes(s.status)),
);

const remainingBySubOrderId = computed(() => {
  const result = new Map();
  for (const sub of shippableSubOrders.value) {
    const lines = (sub.items || [])
      .map((line) => {
        const skuId = Number(line.skuId);
        const ordered = Number(line.quantity) || 0;
        const remaining = Math.max(0, ordered - (occupiedQtyBySku.value.get(skuId) || 0));
        return {
          skuId,
          title: line.title,
          price: line.price,
          quantity: remaining,
          orderedQuantity: ordered,
        };
      })
      .filter((line) => line.quantity > 0);
    result.set(sub.subOrderId, lines);
  }
  return result;
});

const selectableItems = computed(() => {
  if (!form.value.subOrderId) return [];
  return remainingBySubOrderId.value.get(form.value.subOrderId) || [];
});

const canApplyAfterSale = computed(() => {
  if (!order.value) return false;
  if (!['SHIPPED', 'COMPLETED', 'REFUNDING'].includes(order.value.status)) return false;
  for (const lines of remainingBySubOrderId.value.values()) {
    if (lines.length) return true;
  }
  return false;
});

const canConfirmAllReceipt = computed(() => {
  const subs = (order.value?.subOrders || []).filter((s) => s.status !== 'CANCELLED');
  return (
    subs.length > 0 &&
    subs.every((s) => s.status === 'SHIPPED') &&
    order.value?.status === 'SHIPPED'
  );
});

const hasShippedSubToConfirm = computed(() =>
  (order.value?.subOrders || []).some((s) => s.status === 'SHIPPED'),
);

const hasPendingShipmentSub = computed(() =>
  (order.value?.subOrders || []).some((s) => s.status === 'PENDING_SHIPMENT' || s.status === 'PAID'),
);

const paymentCountdown = computed(() => {
  void nowMs.value;
  if (order.value?.status !== 'PENDING_PAYMENT' || !order.value?.paymentDeadline) {
    return { text: '', expired: false };
  }
  const remaining = new Date(order.value.paymentDeadline).getTime() - Date.now();
  if (remaining <= 0) return { text: '支付已超时，订单将自动取消', expired: true };
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return {
    text: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
    expired: false,
  };
});

const PROGRESS_STEPS = [
  { key: 'PENDING_PAYMENT', label: '待支付' },
  { key: 'PENDING_SHIPMENT', label: '待发货' },
  { key: 'SHIPPED', label: '已发货' },
  { key: 'COMPLETED', label: '已完成' },
];

/** 主流程进度（取消/退款不展示步进） */
const progressState = computed(() => {
  const s = order.value?.status;
  if (!s) return { visible: false, active: -1 };
  if (['CANCELLED', 'REFUNDED', 'REFUNDING'].includes(s)) {
    return { visible: false, active: -1 };
  }
  const active = PROGRESS_STEPS.findIndex((p) => p.key === s);
  return { visible: true, active: active < 0 ? 0 : active };
});

function thumbText(title) {
  return String(title || '商').trim().slice(0, 1);
}

/** 顶部「下一步」指引（对齐订单/售后状态机） */
const statusGuide = computed(() => {
  const o = order.value;
  if (!o) return null;
  const status = o.status;
  const label = ORDER_STATUS_LABELS[status] || status;

  if (status === 'PENDING_PAYMENT') {
    return {
      label,
      tone: paymentCountdown.value.expired ? 'danger' : 'warning',
      title: paymentCountdown.value.expired ? '支付已超时' : '等待支付',
      desc: paymentCountdown.value.expired
        ? '超时未支付将自动取消并释放库存，请返回列表刷新状态。'
        : `请在 ${formatTime(o.paymentDeadline)} 前完成支付（剩余 ${paymentCountdown.value.text}），超时自动取消。`,
      primary: paymentCountdown.value.expired ? null : { text: '去支付', action: 'pay' },
      secondary: paymentCountdown.value.expired ? null : { text: '取消订单', action: 'cancel' },
    };
  }
  if (status === 'PENDING_SHIPMENT') {
    return {
      label,
      tone: 'info',
      title: '等待商家发货',
      desc: '支付成功，商家备货中。发货后可在「履约信息」查看物流并确认收货。',
      primary: null,
      secondary: null,
    };
  }
  if (status === 'SHIPPED') {
    if (hasPendingShipmentSub.value && hasShippedSubToConfirm.value) {
      return {
        label: '部分发货',
        tone: 'warning',
        title: '部分商品已发货',
        desc: '请对已发货店铺分别确认收货；未发货店铺请继续等待。整单完成需全部店铺确认或自动确认。',
        primary: null,
        secondary: canApplyAfterSale.value ? { text: '申请售后', action: 'afterSale' } : null,
      };
    }
    if (canConfirmAllReceipt.value) {
      return {
        label,
        tone: 'success',
        title: '商品已全部发货',
        desc: '收货无误后可确认全部收货；也可按店铺分别确认，或等待约 7 天自动确认。',
        primary: { text: '确认全部收货', action: 'confirmAll' },
        secondary: canApplyAfterSale.value ? { text: '申请售后', action: 'afterSale' } : null,
      };
    }
    return {
      label,
      tone: 'success',
      title: '配送中',
      desc: hasShippedSubToConfirm.value
        ? '请在「履约信息」对已发货店铺确认收货。'
        : '订单配送中，请留意物流信息。',
      primary: null,
      secondary: canApplyAfterSale.value ? { text: '申请售后', action: 'afterSale' } : null,
    };
  }
  if (status === 'COMPLETED') {
    return {
      label,
      tone: 'success',
      title: '订单已完成',
      desc: canApplyAfterSale.value
        ? '如需退款/退货，可对剩余可售后商品申请售后（仅退款或退货退款）。'
        : '本单商品已全部完成售后或无可申请售后商品。',
      primary: canApplyAfterSale.value ? { text: '申请售后', action: 'afterSale' } : null,
      secondary: null,
    };
  }
  if (status === 'REFUNDING') {
    return {
      label,
      tone: 'warning',
      title: '售后处理中',
      desc: '请查看下方售后记录。商家 48 小时内未处理或已拒绝时，可申请平台介入。',
      primary: canApplyAfterSale.value ? { text: '继续申请售后', action: 'afterSale' } : null,
      secondary: null,
    };
  }
  if (status === 'REFUNDED') {
    return {
      label,
      tone: 'info',
      title: '已退款',
      desc: '售后退款已完成。',
      primary: null,
      secondary: null,
    };
  }
  if (status === 'CANCELLED') {
    return {
      label,
      tone: 'info',
      title: '订单已取消',
      desc: '该订单已取消，库存已释放（如曾锁定）。',
      primary: null,
      secondary: null,
    };
  }
  return { label, tone: 'info', title: label, desc: '', primary: null, secondary: null };
});

const afterSaleEmptyHint = computed(() => {
  if (canApplyAfterSale.value) {
    return '暂无售后记录。已发货/已完成后可申请仅退款或退货退款（按商品整件）。';
  }
  if (['PENDING_PAYMENT', 'PENDING_SHIPMENT', 'CANCELLED'].includes(order.value?.status)) {
    return '订单需发货或完成后才可申请售后。';
  }
  return '暂无售后记录，且当前没有可申请售后的商品。';
});

function formatPrice(value) {
  return `¥${Number(value || 0).toFixed(2)}`;
}

function formatTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN');
}

function formatAfterSaleItems(as) {
  const list = as?.items || [];
  if (!list.length) return '全部商品';
  return list.map((it) => `${it.title || `SKU${it.skuId}`}×${it.quantity}`).join('、');
}

function escalateButtonLabel(afterSale) {
  if (afterSale.status === 'REJECTED') return '商家已拒绝，申请平台介入';
  return '申请平台介入';
}

function escalateHint(afterSale) {
  if (afterSale.status === 'REJECTED') {
    return '建议先联系商家协商；仍无法解决可申请平台介入。';
  }
  if (afterSale.status === 'APPLIED') {
    return '建议先联系商家协商。商家需在 48 小时内处理；超时或协商不成可申请平台介入。';
  }
  if (afterSale.status === 'APPROVED' || afterSale.status === 'RETURNING') {
    return '寄回相关问题可联系商家确认地址或物流进度。';
  }
  return '';
}

function onGuideAction(action) {
  if (action === 'pay') {
    router.push({ name: 'payment', params: { orderId: order.value.orderId } });
  } else if (action === 'cancel') {
    onCancel();
  } else if (action === 'confirmAll') {
    onConfirmReceipt();
  } else if (action === 'afterSale') {
    openAfterSale();
  }
}

async function loadOrder() {
  loading.value = true;
  try {
    order.value = await fetchOrder(orderId.value);
    const first = shippableSubOrders.value[0];
    form.value.subOrderId = first?.subOrderId ?? null;
  } catch (e) {
    ElMessage.error(e.message || '加载订单失败');
    order.value = null;
  } finally {
    loading.value = false;
  }
}

async function onCancel() {
  try {
    await ElMessageBox.confirm('确认取消该订单？', '提示', { type: 'warning' });
    await cancelOrder(orderId.value);
    ElMessage.success('订单已取消');
    await loadOrder();
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e.message || '取消失败');
  }
}

async function onConfirmReceipt() {
  try {
    await ElMessageBox.confirm('确认已收到全部店铺商品？确认后订单将完成。', '确认收货', {
      type: 'info',
    });
    await confirmReceipt(orderId.value);
    ElMessage.success('确认收货成功，订单已完成');
    await loadOrder();
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e.message || '确认收货失败');
  }
}

async function onConfirmSubReceipt(sub) {
  try {
    await ElMessageBox.confirm(
      `确认已收到「${sub.shopName}」的商品？确认后该店铺包裹将完成。`,
      '确认收货',
      { type: 'info' },
    );
    const data = await confirmSubOrderReceipt(orderId.value, sub.subOrderId);
    const done = data?.order?.status === 'COMPLETED';
    ElMessage.success(done ? '确认收货成功，订单已完成' : '已确认该店铺收货');
    await loadOrder();
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e.message || '确认收货失败');
  }
}

/** 再买一单：按订单快照 SKU 重新加购 */
async function onBuyAgain() {
  const lines = (order.value?.items || []).filter((it) => Number(it.skuId) > 0);
  if (!lines.length) {
    ElMessage.warning('订单没有可加购的商品');
    return;
  }
  rebuying.value = true;
  let ok = 0;
  let fail = 0;
  try {
    for (const line of lines) {
      try {
        await addCartItem(Number(line.skuId), Math.max(1, Number(line.quantity) || 1));
        ok += 1;
      } catch {
        fail += 1;
      }
    }
    if (ok > 0 && fail === 0) {
      ElMessage.success(`已将 ${ok} 种商品加入购物车`);
      router.push({ name: 'cart' });
    } else if (ok > 0) {
      ElMessage.warning(`成功 ${ok} 种，失败 ${fail} 种（可能已下架或库存不足）`);
      router.push({ name: 'cart' });
    } else {
      ElMessage.error('加购失败，商品可能已下架或库存不足');
    }
  } finally {
    rebuying.value = false;
  }
}

function openAfterSale() {
  const firstSub =
    shippableSubOrders.value.find((s) => (remainingBySubOrderId.value.get(s.subOrderId) || []).length) ||
    shippableSubOrders.value[0];
  const remain = firstSub ? remainingBySubOrderId.value.get(firstSub.subOrderId) || [] : [];
  form.value = {
    type: 'REFUND_ONLY',
    reason: '',
    subOrderId: firstSub?.subOrderId ?? null,
    selectedSkuIds: remain.map((r) => r.skuId),
  };
  dialogVisible.value = true;
}

function onSubOrderChange() {
  const remain = selectableItems.value;
  form.value.selectedSkuIds = remain.map((r) => r.skuId);
}

async function onSubmitAfterSale() {
  if (!form.value.reason?.trim()) {
    ElMessage.warning('请填写售后原因');
    return;
  }
  if (!form.value.selectedSkuIds?.length) {
    ElMessage.warning('请选择要售后的商品');
    return;
  }
  const remainMap = new Map(selectableItems.value.map((r) => [r.skuId, r]));
  const items = form.value.selectedSkuIds
    .map((skuId) => remainMap.get(skuId))
    .filter(Boolean)
    .map((r) => ({ skuId: r.skuId, quantity: r.quantity }));
  if (!items.length) {
    ElMessage.warning('所选商品已无可售后数量');
    return;
  }

  submitting.value = true;
  try {
    await applyAfterSale(orderId.value, {
      type: form.value.type,
      reason: form.value.reason.trim(),
      subOrderId: form.value.subOrderId || undefined,
      items,
    });
    ElMessage.success('售后申请已提交，请等待商家在 48 小时内处理');
    dialogVisible.value = false;
    await loadOrder();
  } catch (e) {
    ElMessage.error(e.message || '申请失败');
  } finally {
    submitting.value = false;
  }
}

async function onEscalate(afterSale) {
  try {
    await ElMessageBox.confirm(
      afterSale.status === 'REJECTED'
        ? '商家已拒绝售后。建议先通过「联系商家协商」沟通；仍无法解决再申请平台介入，由客服仲裁。'
        : '建议先通过「联系商家协商」沟通。商家超时未处理或协商不成时，再申请平台介入。',
      '申请平台介入',
      { type: 'warning' },
    );
    await escalateAfterSale(orderId.value, afterSale.afterSaleId);
    ElMessage.success('已申请平台介入');
    await loadOrder();
    openCsChat(afterSale);
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e.message || '升级失败');
  }
}

function canEscalate(afterSale) {
  return afterSale.status === 'APPLIED' || afterSale.status === 'REJECTED';
}

function canContactCs(afterSale) {
  return afterSale?.status === 'ESCALATED';
}

function canContactMerchant(afterSale) {
  return ['APPLIED', 'REJECTED', 'APPROVED', 'RETURNING'].includes(afterSale?.status);
}

function merchantChatButtonLabel(afterSale) {
  if (afterSale?.status === 'APPROVED' || afterSale?.status === 'RETURNING') {
    return '联系商家';
  }
  return '联系商家协商';
}

/** 已拒绝/已退款：回看历史（拒绝后仍可另开「联系商家协商」） */
function canViewChatHistory(afterSale) {
  return afterSale?.status === 'REFUNDED' || afterSale?.status === 'REJECTED';
}

function canContactShop(sub) {
  if (!order.value || !sub) return false;
  if (['CANCELLED', 'REFUNDED'].includes(order.value.status)) return false;
  return ['PENDING_SHIPMENT', 'PAID', 'SHIPPED', 'COMPLETED', 'REFUNDING'].includes(sub.status);
}

function openCsChat(afterSale) {
  chatThreadType.value = 'USER_CS';
  chatCanEscalate.value = false;
  merchantChatTarget.value = null;
  chatInitialThread.value = null;
  chatAfterSaleId.value = afterSale.afterSaleId;
  chatOrderId.value = null;
  chatMerchantId.value = null;
  chatVisible.value = true;
}

function openMerchantChatDrawer(afterSale) {
  chatThreadType.value = 'USER_MERCHANT';
  chatCanEscalate.value = canEscalate(afterSale);
  merchantChatTarget.value = afterSale;
  chatInitialThread.value = null;
  chatAfterSaleId.value = afterSale.afterSaleId;
  chatOrderId.value = null;
  chatMerchantId.value = null;
  chatVisible.value = true;
}

function openShopChat(sub) {
  chatThreadType.value = 'USER_MERCHANT';
  chatCanEscalate.value = false;
  merchantChatTarget.value = null;
  chatInitialThread.value = null;
  chatAfterSaleId.value = null;
  chatOrderId.value = order.value.orderId;
  chatMerchantId.value = sub.merchantId;
  chatVisible.value = true;
}

async function openChatHistory(afterSale) {
  try {
    let thread = null;
    let type = 'USER_MERCHANT';
    try {
      thread = await getMerchantChatThread(afterSale.afterSaleId);
      type = 'USER_MERCHANT';
    } catch {
      thread = await getAfterSaleChatThread(afterSale.afterSaleId);
      type = 'USER_CS';
    }
    chatThreadType.value = type;
    chatCanEscalate.value = false;
    merchantChatTarget.value = null;
    chatInitialThread.value = thread;
    chatAfterSaleId.value = afterSale.afterSaleId;
    chatOrderId.value = null;
    chatMerchantId.value = null;
    chatVisible.value = true;
  } catch (e) {
    ElMessage.warning(e.message || '暂无沟通记录');
  }
}

async function onEscalateFromChat() {
  if (!merchantChatTarget.value) return;
  chatVisible.value = false;
  await onEscalate(merchantChatTarget.value);
}

function canSubmitReturn(afterSale) {
  return afterSale.type === 'RETURN_REFUND' && afterSale.status === 'APPROVED';
}

function openReturnDialog(afterSale) {
  returnTarget.value = afterSale;
  returnForm.value = { logisticsCompany: '', trackingNo: '' };
  returnDialogVisible.value = true;
}

async function onSubmitReturn() {
  if (!returnForm.value.logisticsCompany?.trim() || !returnForm.value.trackingNo?.trim()) {
    ElMessage.warning('请填写物流公司与运单号');
    return;
  }
  if (!returnTarget.value) return;
  returnSubmitting.value = true;
  try {
    await submitAfterSaleReturn(orderId.value, returnTarget.value.afterSaleId, {
      logisticsCompany: returnForm.value.logisticsCompany.trim(),
      trackingNo: returnForm.value.trackingNo.trim(),
    });
    ElMessage.success('寄回物流已提交，等待商家验收');
    returnDialogVisible.value = false;
    await loadOrder();
  } catch (e) {
    ElMessage.error(e.message || '提交失败');
  } finally {
    returnSubmitting.value = false;
  }
}

async function scrollToAfterSalesIfNeeded() {
  if (route.hash !== '#after-sales') return;
  await nextTick();
  document.getElementById('after-sales')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

onMounted(async () => {
  await loadOrder();
  await scrollToAfterSalesIfNeeded();
  tickTimer = setInterval(() => {
    nowMs.value = Date.now();
  }, 1000);
});

onUnmounted(() => {
  if (tickTimer) clearInterval(tickTimer);
});
</script>

<template>
  <div class="order-detail-page" v-loading="loading">
    <el-empty v-if="!loading && !order" description="订单不存在">
      <el-button type="primary" @click="router.push({ name: 'user-orders' })">返回订单列表</el-button>
    </el-empty>

    <template v-else-if="order">
      <div class="page-header">
        <div>
          <h2 class="page-title">订单详情</h2>
          <p class="page-sub">订单号 {{ order.orderNo }}</p>
        </div>
        <el-button link type="primary" @click="router.push({ name: 'user-orders' })">返回列表</el-button>
      </div>

      <ol v-if="progressState.visible" class="progress-track">
        <li
          v-for="(step, index) in PROGRESS_STEPS"
          :key="step.key"
          class="progress-step"
          :class="{
            done: index < progressState.active,
            active: index === progressState.active,
          }"
        >
          <span class="step-dot">{{ index < progressState.active ? '✓' : index + 1 }}</span>
          <span class="step-label">{{ step.label }}</span>
        </li>
      </ol>

      <div v-if="statusGuide" class="status-guide" :class="`tone-${statusGuide.tone}`">
        <div class="guide-main">
          <el-tag size="small" effect="dark">{{ statusGuide.label }}</el-tag>
          <h3 class="guide-title">{{ statusGuide.title }}</h3>
          <p class="guide-desc">{{ statusGuide.desc }}</p>
        </div>
        <div v-if="statusGuide.primary || statusGuide.secondary" class="guide-actions">
          <el-button
            v-if="statusGuide.secondary"
            @click="onGuideAction(statusGuide.secondary.action)"
          >
            {{ statusGuide.secondary.text }}
          </el-button>
          <el-button
            v-if="statusGuide.primary"
            type="primary"
            @click="onGuideAction(statusGuide.primary.action)"
          >
            {{ statusGuide.primary.text }}
          </el-button>
        </div>
      </div>

      <el-card shadow="never" class="section-card">
        <template #header><span class="card-title">订单概要</span></template>
        <el-descriptions :column="2" border>
          <el-descriptions-item label="订单号">{{ order.orderNo }}</el-descriptions-item>
          <el-descriptions-item label="订单状态">
            {{ ORDER_STATUS_LABELS[order.status] || order.status }}
          </el-descriptions-item>
          <el-descriptions-item label="下单时间">{{ formatTime(order.createdAt) }}</el-descriptions-item>
          <el-descriptions-item label="应付金额">
            <span class="amount">{{ formatPrice(order.totalAmount) }}</span>
          </el-descriptions-item>
          <el-descriptions-item
            v-if="order.status === 'PENDING_PAYMENT' && order.paymentDeadline"
            label="支付截止"
            :span="2"
          >
            {{ formatTime(order.paymentDeadline) }}
            <span v-if="paymentCountdown.text" class="countdown-inline">
              · {{ paymentCountdown.expired ? paymentCountdown.text : `剩余 ${paymentCountdown.text}` }}
            </span>
          </el-descriptions-item>
          <el-descriptions-item
            v-if="hasShippedSubToConfirm && order.autoConfirmDeadline"
            label="自动确认"
            :span="2"
          >
            最早将于 {{ formatTime(order.autoConfirmDeadline) }} 自动确认已发货包裹（各店铺发货后约 7 天）
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card shadow="never" class="section-card">
        <template #header><span class="card-title">商品信息</span></template>
        <div v-for="item in order.items" :key="item.skuId" class="product-row">
          <div class="product-thumb">{{ thumbText(item.title) }}</div>
          <span class="product-title">{{ item.title }}</span>
          <span class="product-qty">x{{ item.quantity }}</span>
          <span class="product-price">{{ formatPrice(item.price * item.quantity) }}</span>
        </div>
      </el-card>

      <el-card v-if="order.addressSnapshot" shadow="never" class="section-card">
        <template #header><span class="card-title">收货信息</span></template>
        <div class="address-box">
          <p class="line strong">{{ order.addressSnapshot.receiverName }} {{ order.addressSnapshot.phone }}</p>
          <p class="line">{{ order.addressSnapshot.fullAddress }}</p>
        </div>
      </el-card>

      <el-card v-if="order.subOrders?.length" shadow="never" class="section-card">
        <template #header><span class="card-title">履约信息</span></template>
        <div v-for="sub in order.subOrders" :key="sub.subOrderId" class="sub-block">
          <div class="sub-row">
            <div>
              <p class="line strong">{{ sub.shopName }}</p>
              <p class="line muted status-line">
                {{ ORDER_STATUS_LABELS[sub.status] || sub.status }}
              </p>
            </div>
            <div class="sub-actions">
              <el-button
                v-if="sub.status === 'SHIPPED'"
                type="primary"
                size="small"
                @click="onConfirmSubReceipt(sub)"
              >
                确认收货
              </el-button>
              <el-button
                v-if="canContactShop(sub)"
                type="primary"
                plain
                size="small"
                @click="openShopChat(sub)"
              >
                联系商家
              </el-button>
            </div>
          </div>
          <p v-if="sub.shipment" class="line logistics">
            {{ sub.shipment.logisticsCompany }} {{ sub.shipment.trackingNo }}
            · 发货于 {{ formatTime(sub.shipment.shippedAt) }}
          </p>
          <p v-if="sub.status === 'SHIPPED' && sub.autoConfirmDeadline" class="line muted">
            将于 {{ formatTime(sub.autoConfirmDeadline) }} 自动确认收货
          </p>
        </div>
      </el-card>

      <el-card id="after-sales" shadow="never" class="section-card">
        <template #header>
          <div class="card-header">
            <span class="card-title">售后记录</span>
            <el-button v-if="canApplyAfterSale" type="primary" size="small" @click="openAfterSale">
              申请售后
            </el-button>
          </div>
        </template>
        <p class="after-sale-policy muted">
          已发货/已完成后可申请；商家 48 小时内处理，超时或拒绝后可申请平台介入。
        </p>
        <el-empty
          v-if="!order.afterSales?.length"
          :description="afterSaleEmptyHint"
          :image-size="64"
        />
        <div v-for="as in order.afterSales || []" :key="as.afterSaleId" class="after-sale-row">
          <div>
            <p class="line">
              <el-tag size="small">{{ AFTER_SALE_STATUS_LABELS[as.status] || as.status }}</el-tag>
              <span class="as-type">{{ as.type === 'RETURN_REFUND' ? '退货退款' : '仅退款' }}</span>
            </p>
            <p class="line muted">原因：{{ as.reason }}</p>
            <p class="line muted">商品：{{ formatAfterSaleItems(as) }}</p>
            <p v-if="as.auditReason" class="line muted">处理说明：{{ as.auditReason }}</p>
            <p v-if="as.returnShipment" class="line muted">
              寄回物流：{{ as.returnShipment.logisticsCompany }} {{ as.returnShipment.trackingNo }}
              · {{ formatTime(as.returnShipment.shippedAt) }}
            </p>
            <p class="line muted">申请时间：{{ formatTime(as.appliedAt) }}</p>
            <p v-if="escalateHint(as)" class="line hint-text">{{ escalateHint(as) }}</p>
          </div>
          <div class="as-actions">
            <el-button
              v-if="canContactMerchant(as)"
              plain
              size="small"
              @click="openMerchantChatDrawer(as)"
            >
              {{ merchantChatButtonLabel(as) }}
            </el-button>
            <el-button
              v-if="canEscalate(as)"
              type="warning"
              plain
              size="small"
              @click="onEscalate(as)"
            >
              {{ escalateButtonLabel(as) }}
            </el-button>
            <el-button
              v-if="canContactCs(as)"
              type="primary"
              plain
              size="small"
              @click="openCsChat(as)"
            >
              联系平台客服
            </el-button>
            <el-button
              v-if="canSubmitReturn(as)"
              type="primary"
              size="small"
              @click="openReturnDialog(as)"
            >
              填写寄回物流
            </el-button>
            <el-button
              v-if="canViewChatHistory(as)"
              link
              type="primary"
              size="small"
              @click="openChatHistory(as)"
            >
              查看沟通记录
            </el-button>
          </div>
        </div>
      </el-card>

      <div class="actions">
        <el-button v-if="order.status === 'PENDING_PAYMENT' && !paymentCountdown.expired" @click="onCancel">
          取消订单
        </el-button>
        <el-button
          v-if="order.status === 'PENDING_PAYMENT' && !paymentCountdown.expired"
          type="primary"
          @click="router.push({ name: 'payment', params: { orderId: order.orderId } })"
        >
          去支付
        </el-button>
        <el-button v-if="canConfirmAllReceipt" type="primary" @click="onConfirmReceipt">
          确认全部收货
        </el-button>
        <el-button
          v-if="order.items?.length && order.status !== 'PENDING_PAYMENT'"
          :loading="rebuying"
          @click="onBuyAgain"
        >
          再买一单
        </el-button>
      </div>
    </template>

    <el-dialog v-model="dialogVisible" title="申请售后" width="520px">
      <p class="dialog-hint muted">
        仅已发货/已完成（或退款中仍有剩余）订单可申请；本迭代按 SKU 整件售后。商家 48 小时内处理。
      </p>
      <el-form label-position="top">
        <el-form-item label="售后类型" required>
          <el-radio-group v-model="form.type">
            <el-radio v-for="t in AFTER_SALE_TYPES" :key="t.value" :label="t.value">{{ t.label }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="shippableSubOrders.length > 1" label="子订单 / 店铺" required>
          <el-select v-model="form.subOrderId" style="width: 100%" @change="onSubOrderChange">
            <el-option
              v-for="sub in shippableSubOrders"
              :key="sub.subOrderId"
              :label="`${sub.shopName}（可售后 ${(remainingBySubOrderId.get(sub.subOrderId) || []).length} 种）`"
              :value="sub.subOrderId"
              :disabled="!(remainingBySubOrderId.get(sub.subOrderId) || []).length"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="选择商品（整件售后）" required>
          <el-checkbox-group v-if="selectableItems.length" v-model="form.selectedSkuIds" class="sku-check-group">
            <el-checkbox
              v-for="item in selectableItems"
              :key="item.skuId"
              :label="item.skuId"
              class="sku-check"
            >
              <span class="sku-title">{{ item.title }}</span>
              <span class="sku-meta">×{{ item.quantity }} · {{ formatPrice(item.price) }}</span>
            </el-checkbox>
          </el-checkbox-group>
          <p v-else class="muted">该子单暂无可申请售后的商品</p>
        </el-form-item>
        <el-form-item label="申请原因" required>
          <el-input v-model="form.reason" type="textarea" :rows="3" maxlength="200" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="onSubmitAfterSale">提交</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="returnDialogVisible" title="填写寄回物流" width="480px">
      <el-form label-position="top">
        <el-form-item label="物流公司" required>
          <el-input v-model="returnForm.logisticsCompany" placeholder="如：顺丰速运" maxlength="64" />
        </el-form-item>
        <el-form-item label="运单号" required>
          <el-input v-model="returnForm.trackingNo" placeholder="请输入运单号" maxlength="64" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="returnDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="returnSubmitting" @click="onSubmitReturn">提交寄回</el-button>
      </template>
    </el-dialog>

    <AfterSaleChatDrawer
      v-model="chatVisible"
      :after-sale-id="chatAfterSaleId"
      :order-id="chatOrderId"
      :merchant-id="chatMerchantId"
      :thread-type="chatThreadType"
      :can-escalate="chatCanEscalate"
      :initial-thread="chatInitialThread"
      @escalate="onEscalateFromChat"
    />
  </div>
</template>

<style scoped>
.order-detail-page {
  max-width: 960px;
  margin: 0 auto;
  padding-bottom: 24px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 12px;
}

.page-title {
  margin: 0 0 4px;
  font-size: 22px;
}

.page-sub {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}

.progress-track {
  list-style: none;
  margin: 0 0 16px;
  padding: 18px 12px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  background: #fff;
  border: 1px solid var(--border-color);
  border-radius: 10px;
}

.progress-step {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}

.progress-step:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 13px;
  left: calc(50% + 16px);
  width: calc(100% - 32px);
  height: 2px;
  background: #e8e8e8;
}

.progress-step.done:not(:last-child)::after,
.progress-step.active:not(:last-child)::after {
  background: #ffccc7;
}

.step-dot {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-muted);
  background: #f5f5f5;
  border: 2px solid #e8e8e8;
  z-index: 1;
}

.progress-step.done .step-dot {
  color: #fff;
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.progress-step.active .step-dot {
  color: #fff;
  background: var(--color-primary);
  border-color: var(--color-primary);
  box-shadow: 0 0 0 4px #fff1f0;
}

.step-label {
  font-size: 12px;
  color: var(--text-muted);
}

.progress-step.done .step-label,
.progress-step.active .step-label {
  color: var(--color-primary);
  font-weight: 600;
}

.status-guide {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 16px;
  padding: 18px 20px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
  background: #fff;
}

.status-guide.tone-warning {
  border-color: #ffe58f;
  background: #fffbe6;
}

.status-guide.tone-danger {
  border-color: #ffccc7;
  background: #fff2f0;
}

.status-guide.tone-success {
  border-color: #b7eb8f;
  background: #f6ffed;
}

.status-guide.tone-info {
  border-color: #91d5ff;
  background: #e6f7ff;
}

.guide-title {
  margin: 8px 0 6px;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-title);
}

.guide-desc {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-body);
  max-width: 720px;
}

.guide-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  align-items: center;
}

.section-card {
  margin-bottom: 16px;
  border-radius: 10px;
  border: 1px solid var(--border-color);
}

.card-title {
  font-weight: 700;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.amount {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-primary);
}

.countdown-inline {
  margin-left: 8px;
  color: var(--color-primary);
  font-weight: 600;
}

.product-row {
  display: grid;
  grid-template-columns: 44px 1fr 48px 100px;
  gap: 12px;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-color);
}

.product-row:last-child {
  border-bottom: none;
}

.product-thumb {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  color: var(--color-primary);
  background: linear-gradient(135deg, #fff1f0, #ffe7e6);
  border: 1px solid #ffccc7;
}

.product-title {
  min-width: 0;
}

.product-qty {
  color: var(--text-muted);
  text-align: right;
}

.product-price {
  font-weight: 700;
  color: var(--color-primary);
  text-align: right;
}

.address-box {
  padding: 12px 14px;
  background: #fafafa;
  border-radius: 8px;
}

.line {
  margin: 0 0 6px;
}

.line.strong {
  font-weight: 700;
  color: var(--text-title);
}

.muted {
  color: var(--text-muted);
  font-size: 13px;
}

.hint-text {
  color: #d48806;
  font-size: 12px;
}

.after-sale-policy {
  margin: 0 0 12px;
}

.dialog-hint {
  margin: 0 0 12px;
  line-height: 1.5;
}

.sub-block {
  padding: 14px;
  margin-bottom: 10px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: #fafafa;
}

.sub-block:last-child {
  margin-bottom: 0;
}

.sub-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.status-line {
  margin-top: 2px;
}

.logistics {
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  background: #fff;
  border: 1px dashed var(--border-color);
  font-size: 13px;
  color: var(--text-body);
}

.sub-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.after-sale-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;
  margin-bottom: 10px;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: #fafafa;
}

.after-sale-row:last-child {
  margin-bottom: 0;
}

.as-type {
  margin-left: 8px;
  font-weight: 600;
}

.as-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-end;
}

.sku-check-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.sku-check {
  margin-right: 0;
  height: auto;
  white-space: normal;
}

.sku-title {
  display: block;
  font-weight: 500;
}

.sku-meta {
  display: block;
  font-size: 12px;
  color: var(--text-muted);
}

.actions {
  position: sticky;
  bottom: 12px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 16px;
  background: #fff;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
}

@media (max-width: 640px) {
  .progress-track {
    grid-template-columns: repeat(2, 1fr);
    row-gap: 16px;
  }

  .progress-step:not(:last-child)::after {
    display: none;
  }

  .product-row {
    grid-template-columns: 44px 1fr;
  }

  .product-qty,
  .product-price {
    grid-column: 2;
    text-align: left;
  }
}
</style>
