<script setup>
import { computed, onMounted, ref } from 'vue';
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
const merchantChatTarget = ref(null);

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

/** 各子单剩余可售后商品（整件） */
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

/** 全部活跃子单均已发货时可整单确认 */
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

/** 整单确认：全部子单均为 SHIPPED */
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

/** 领域：子单 SHIPPED → COMPLETED */
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
    ElMessage.success('售后申请已提交');
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
    await ElMessageBox.confirm('确认申请平台介入？商家拒绝或超时后可升级为平台仲裁。', '申请平台介入', {
      type: 'warning',
    });
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

/** 领域规则：平台客服会话挂在售后升级后（USER_CS）；仅仲裁中展示入口 */
function canContactCs(afterSale) {
  return afterSale?.status === 'ESCALATED';
}

/** 领域规则：USER_MERCHANT 售后协商，售后待商家处理时可聊 */
function canContactMerchant(afterSale) {
  return afterSale?.status === 'APPLIED';
}

/** 履约前/履约中：按子单联系店铺（未发货改色等） */
function canContactShop(sub) {
  if (!order.value || !sub) return false;
  if (['CANCELLED', 'REFUNDED'].includes(order.value.status)) return false;
  return ['PENDING_SHIPMENT', 'PAID', 'SHIPPED', 'COMPLETED', 'REFUNDING'].includes(sub.status);
}

function openCsChat(afterSale) {
  chatThreadType.value = 'USER_CS';
  chatCanEscalate.value = false;
  merchantChatTarget.value = null;
  chatAfterSaleId.value = afterSale.afterSaleId;
  chatOrderId.value = null;
  chatMerchantId.value = null;
  chatVisible.value = true;
}

function openMerchantChatDrawer(afterSale) {
  chatThreadType.value = 'USER_MERCHANT';
  chatCanEscalate.value = canEscalate(afterSale);
  merchantChatTarget.value = afterSale;
  chatAfterSaleId.value = afterSale.afterSaleId;
  chatOrderId.value = null;
  chatMerchantId.value = null;
  chatVisible.value = true;
}

function openShopChat(sub) {
  chatThreadType.value = 'USER_MERCHANT';
  chatCanEscalate.value = false;
  merchantChatTarget.value = null;
  chatAfterSaleId.value = null;
  chatOrderId.value = order.value.orderId;
  chatMerchantId.value = sub.merchantId;
  chatVisible.value = true;
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

onMounted(loadOrder);
</script>

<template>
  <div class="order-detail-page" v-loading="loading">
    <el-empty v-if="!loading && !order" description="订单不存在">
      <el-button type="primary" @click="router.push({ name: 'user-orders' })">返回订单列表</el-button>
    </el-empty>

    <template v-else-if="order">
      <div class="page-header">
        <h2 class="page-title">订单详情</h2>
        <el-button link type="primary" @click="router.push({ name: 'user-orders' })">返回列表</el-button>
      </div>

      <el-card shadow="never" class="section-card">
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
            v-if="hasShippedSubToConfirm && order.autoConfirmDeadline"
            label="自动确认"
            :span="2"
          >
            最早将于 {{ formatTime(order.autoConfirmDeadline) }} 自动确认已发货包裹（各店铺发货后约 10 分钟）
          </el-descriptions-item>
        </el-descriptions>
      </el-card>

      <el-card shadow="never" class="section-card">
        <template #header><span>商品信息</span></template>
        <div v-for="item in order.items" :key="item.skuId" class="product-row">
          <span class="product-title">{{ item.title }}</span>
          <span class="product-qty">x{{ item.quantity }}</span>
          <span class="product-price">{{ formatPrice(item.price * item.quantity) }}</span>
        </div>
      </el-card>

      <el-card v-if="order.addressSnapshot" shadow="never" class="section-card">
        <template #header><span>收货信息</span></template>
        <p class="line">{{ order.addressSnapshot.receiverName }} {{ order.addressSnapshot.phone }}</p>
        <p class="line">{{ order.addressSnapshot.fullAddress }}</p>
      </el-card>

      <el-card v-if="order.subOrders?.length" shadow="never" class="section-card">
        <template #header><span>履约信息</span></template>
        <div v-for="sub in order.subOrders" :key="sub.subOrderId" class="sub-block">
          <div class="sub-row">
            <p class="line">
              <strong>{{ sub.shopName }}</strong>
              · {{ ORDER_STATUS_LABELS[sub.status] || sub.status }}
            </p>
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
          <p v-if="sub.shipment" class="line muted">
            {{ sub.shipment.logisticsCompany }} {{ sub.shipment.trackingNo }}
            · 发货于 {{ formatTime(sub.shipment.shippedAt) }}
          </p>
          <p v-if="sub.status === 'SHIPPED' && sub.autoConfirmDeadline" class="line muted">
            将于 {{ formatTime(sub.autoConfirmDeadline) }} 自动确认收货
          </p>
        </div>
      </el-card>

      <el-card shadow="never" class="section-card">
        <template #header>
          <div class="card-header">
            <span>售后记录</span>
            <el-button v-if="canApplyAfterSale" type="primary" size="small" @click="openAfterSale">
              申请售后
            </el-button>
          </div>
        </template>
        <el-empty
          v-if="!order.afterSales?.length"
          description="暂无售后"
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
            <p
              v-if="as.returnShipment"
              class="line muted"
            >
              寄回物流：{{ as.returnShipment.logisticsCompany }} {{ as.returnShipment.trackingNo }}
              · {{ formatTime(as.returnShipment.shippedAt) }}
            </p>
            <p class="line muted">申请时间：{{ formatTime(as.appliedAt) }}</p>
          </div>
          <div class="as-actions">
            <el-button
              v-if="canContactMerchant(as)"
              plain
              size="small"
              @click="openMerchantChatDrawer(as)"
            >
              联系商家
            </el-button>
            <el-button
              v-if="canEscalate(as)"
              type="warning"
              plain
              size="small"
              @click="onEscalate(as)"
            >
              申请平台介入
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
          </div>
        </div>
      </el-card>

      <div class="actions">
        <el-button
          v-if="order.status === 'PENDING_PAYMENT'"
          @click="onCancel"
        >
          取消订单
        </el-button>
        <el-button
          v-if="order.status === 'PENDING_PAYMENT'"
          type="primary"
          @click="router.push({ name: 'payment', params: { orderId: order.orderId } })"
        >
          去支付
        </el-button>
        <el-button
          v-if="canConfirmAllReceipt"
          type="primary"
          @click="onConfirmReceipt"
        >
          确认全部收货
        </el-button>
      </div>
    </template>

    <el-dialog v-model="dialogVisible" title="申请售后" width="520px">
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
      @escalate="onEscalateFromChat"
    />
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.page-title { margin: 0; font-size: 20px; }
.section-card { margin-bottom: 16px; }
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  font-weight: 600;
}
.amount { font-size: 18px; font-weight: 700; color: var(--color-primary); }
.product-row {
  display: flex;
  gap: 16px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-color);
}
.product-row:last-child { border-bottom: none; }
.product-title { flex: 1; }
.product-qty { color: var(--text-muted); }
.product-price { font-weight: 600; color: var(--color-primary); }
.line { margin: 0 0 6px; }
.muted { color: var(--text-muted); font-size: 13px; }
.sub-block { padding: 8px 0; border-bottom: 1px solid var(--border-color); }
.sub-block:last-child { border-bottom: none; }
.sub-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.sub-row .line { margin-bottom: 0; }
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
  padding: 12px 0;
  border-bottom: 1px solid var(--border-color);
}
.after-sale-row:last-child { border-bottom: none; }
.as-type { margin-left: 8px; font-weight: 600; }
.as-actions { display: flex; flex-direction: column; gap: 8px; align-items: flex-end; }
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
.sku-title { display: block; font-weight: 500; }
.sku-meta { display: block; font-size: 12px; color: var(--text-muted); }
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 8px 0 24px;
}
</style>
