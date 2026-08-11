<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  applyAfterSale,
  cancelOrder,
  escalateAfterSale,
  fetchOrder,
  submitAfterSaleReturn,
} from '@/api/order';

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
});

const returnDialogVisible = ref(false);
const returnSubmitting = ref(false);
const returnTarget = ref(null);
const returnForm = ref({
  logisticsCompany: '',
  trackingNo: '',
});

const canApplyAfterSale = computed(() => {
  if (!order.value) return false;
  if (!['SHIPPED', 'COMPLETED'].includes(order.value.status)) return false;
  const list = order.value.afterSales || [];
  return !list.some((a) => ['APPLIED', 'ESCALATED', 'APPROVED', 'RETURNING'].includes(a.status));
});

const shippableSubOrders = computed(() =>
  (order.value?.subOrders || []).filter((s) => ['SHIPPED', 'COMPLETED', 'REFUNDING'].includes(s.status)),
);

function formatPrice(value) {
  return `¥${Number(value || 0).toFixed(2)}`;
}

function formatTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN');
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

function openAfterSale() {
  form.value = {
    type: 'REFUND_ONLY',
    reason: '',
    subOrderId: shippableSubOrders.value[0]?.subOrderId ?? null,
  };
  dialogVisible.value = true;
}

async function onSubmitAfterSale() {
  if (!form.value.reason?.trim()) {
    ElMessage.warning('请填写售后原因');
    return;
  }
  submitting.value = true;
  try {
    await applyAfterSale(orderId.value, {
      type: form.value.type,
      reason: form.value.reason.trim(),
      subOrderId: form.value.subOrderId || undefined,
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
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e.message || '升级失败');
  }
}

function canEscalate(afterSale) {
  return afterSale.status === 'APPLIED' || afterSale.status === 'REJECTED';
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
          <p class="line">
            <strong>{{ sub.shopName }}</strong>
            · {{ ORDER_STATUS_LABELS[sub.status] || sub.status }}
          </p>
          <p v-if="sub.shipment" class="line muted">
            {{ sub.shipment.logisticsCompany }} {{ sub.shipment.trackingNo }}
            · 发货于 {{ formatTime(sub.shipment.shippedAt) }}
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
              v-if="canEscalate(as)"
              type="warning"
              plain
              size="small"
              @click="onEscalate(as)"
            >
              申请平台介入
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
      </div>
    </template>

    <el-dialog v-model="dialogVisible" title="申请售后" width="480px">
      <el-form label-position="top">
        <el-form-item label="售后类型" required>
          <el-radio-group v-model="form.type">
            <el-radio v-for="t in AFTER_SALE_TYPES" :key="t.value" :label="t.value">{{ t.label }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="shippableSubOrders.length > 1" label="子订单">
          <el-select v-model="form.subOrderId" style="width: 100%">
            <el-option
              v-for="sub in shippableSubOrders"
              :key="sub.subOrderId"
              :label="`${sub.shopName}（#${sub.subOrderId}）`"
              :value="sub.subOrderId"
            />
          </el-select>
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
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 8px 0 24px;
}
</style>
