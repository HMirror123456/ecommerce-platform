<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { fetchOrderDetail, fetchOrders } from '@/api/admin';

const ORDER_STATUS_OPTIONS = [
  { label: '待支付', value: 'PENDING_PAYMENT' },
  { label: '待发货', value: 'PENDING_SHIPMENT' },
  { label: '已发货', value: 'SHIPPED' },
  { label: '已完成', value: 'COMPLETED' },
  { label: '已取消', value: 'CANCELLED' },
  { label: '退款中', value: 'REFUNDING' },
  { label: '已退款', value: 'REFUNDED' },
];

const STATUS_LABEL = Object.fromEntries(ORDER_STATUS_OPTIONS.map((o) => [o.value, o.label]));

const loading = ref(false);
const list = ref([]);
const total = ref(0);
const page = ref(1);
const pageSize = ref(10);

const filters = ref({
  orderNo: '',
  userId: '',
  merchantId: '',
  status: '',
});

const drawerVisible = ref(false);
const detailLoading = ref(false);
const detail = ref(null);

function formatTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN');
}

function formatPrice(value) {
  const n = Number(value);
  return Number.isFinite(n) ? `¥${n.toFixed(2)}` : '-';
}

function statusLabel(status) {
  return STATUS_LABEL[status] || status || '-';
}

function statusTagType(status) {
  const map = {
    PENDING_PAYMENT: 'warning',
    PENDING_SHIPMENT: 'warning',
    SHIPPED: 'primary',
    COMPLETED: 'success',
    CANCELLED: 'info',
    REFUNDING: 'danger',
    REFUNDED: 'success',
  };
  return map[status] || 'info';
}

function buildParams() {
  const params = { page: page.value, pageSize: pageSize.value };
  if (filters.value.orderNo.trim()) params.orderNo = filters.value.orderNo.trim();
  if (filters.value.userId !== '') params.userId = filters.value.userId;
  if (filters.value.merchantId !== '') params.merchantId = filters.value.merchantId;
  if (filters.value.status) params.status = filters.value.status;
  return params;
}

async function loadList() {
  loading.value = true;
  try {
    const data = await fetchOrders(buildParams());
    list.value = data.list || [];
    total.value = data.total || 0;
  } catch (e) {
    ElMessage.error(e.message || '加载失败');
  } finally {
    loading.value = false;
  }
}

function onSearch() {
  page.value = 1;
  loadList();
}

function onReset() {
  filters.value = { orderNo: '', userId: '', merchantId: '', status: '' };
  page.value = 1;
  loadList();
}

function onPageChange(p) {
  page.value = p;
  loadList();
}

async function openDetail(row) {
  drawerVisible.value = true;
  detailLoading.value = true;
  detail.value = null;
  try {
    detail.value = await fetchOrderDetail(row.orderId);
  } catch (e) {
    ElMessage.error(e.message || '加载详情失败');
    drawerVisible.value = false;
  } finally {
    detailLoading.value = false;
  }
}

onMounted(loadList);
</script>

<template>
  <el-card shadow="never">
    <template #header>
      <div class="card-header">
        <span>全平台订单</span>
        <el-tag>OPERATOR / CS_AGENT 可查</el-tag>
      </div>
    </template>

    <el-form :inline="true" class="filters" @submit.prevent="onSearch">
      <el-form-item label="订单号">
        <el-input v-model="filters.orderNo" placeholder="模糊匹配" clearable style="width: 160px" />
      </el-form-item>
      <el-form-item label="用户ID">
        <el-input v-model="filters.userId" placeholder="userId" clearable style="width: 100px" />
      </el-form-item>
      <el-form-item label="商家ID">
        <el-input v-model="filters.merchantId" placeholder="merchantId" clearable style="width: 100px" />
      </el-form-item>
      <el-form-item label="状态">
        <el-select v-model="filters.status" placeholder="全部" clearable style="width: 130px">
          <el-option v-for="o in ORDER_STATUS_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="onSearch">查询</el-button>
        <el-button @click="onReset">重置</el-button>
      </el-form-item>
    </el-form>

    <el-table v-loading="loading" :data="list" stripe empty-text="暂无订单">
      <el-table-column prop="orderNo" label="订单号" min-width="180" show-overflow-tooltip />
      <el-table-column prop="userId" label="用户ID" width="90" />
      <el-table-column label="状态" width="110">
        <template #default="{ row }">
          <el-tag :type="statusTagType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="金额" width="100">
        <template #default="{ row }">{{ formatPrice(row.totalAmount) }}</template>
      </el-table-column>
      <el-table-column label="商品数" width="80">
        <template #default="{ row }">{{ row.items?.length || 0 }}</template>
      </el-table-column>
      <el-table-column label="下单时间" width="170">
        <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="90" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pager">
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="onPageChange"
      />
    </div>
  </el-card>

  <el-drawer v-model="drawerVisible" title="订单详情" size="560px">
    <div v-loading="detailLoading">
      <template v-if="detail">
        <el-descriptions :column="1" border class="desc">
          <el-descriptions-item label="订单号">{{ detail.orderNo }}</el-descriptions-item>
          <el-descriptions-item label="用户ID">{{ detail.userId }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ statusLabel(detail.status) }}</el-descriptions-item>
          <el-descriptions-item label="总金额">{{ formatPrice(detail.totalAmount) }}</el-descriptions-item>
          <el-descriptions-item label="下单时间">{{ formatTime(detail.createdAt) }}</el-descriptions-item>
          <el-descriptions-item v-if="detail.paymentDeadline" label="支付截止">
            {{ formatTime(detail.paymentDeadline) }}
          </el-descriptions-item>
        </el-descriptions>

        <h4>收货地址</h4>
        <el-descriptions v-if="detail.addressSnapshot" :column="1" border class="desc">
          <el-descriptions-item label="收件人">{{ detail.addressSnapshot.receiverName }}</el-descriptions-item>
          <el-descriptions-item label="电话">{{ detail.addressSnapshot.phone }}</el-descriptions-item>
          <el-descriptions-item label="地址">{{ detail.addressSnapshot.fullAddress }}</el-descriptions-item>
        </el-descriptions>

        <h4>订单商品</h4>
        <el-table :data="detail.items" size="small" border class="desc">
          <el-table-column prop="skuId" label="SKU" width="80" />
          <el-table-column prop="title" label="商品" min-width="140" show-overflow-tooltip />
          <el-table-column label="单价" width="90">
            <template #default="{ row }">{{ formatPrice(row.price) }}</template>
          </el-table-column>
          <el-table-column prop="quantity" label="数量" width="70" />
        </el-table>

        <h4>子订单（按商家拆分）</h4>
        <el-table :data="detail.subOrders || []" size="small" border>
          <el-table-column prop="subOrderId" label="子单ID" width="80" />
          <el-table-column prop="shopName" label="店铺" min-width="120" />
          <el-table-column label="状态" width="100">
            <template #default="{ row }">{{ statusLabel(row.status) }}</template>
          </el-table-column>
          <el-table-column label="物流" min-width="160">
            <template #default="{ row }">
              <template v-if="row.shipment">
                {{ row.shipment.logisticsCompany }} / {{ row.shipment.trackingNo }}
              </template>
              <span v-else>-</span>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </div>
  </el-drawer>
</template>

<style scoped>
.card-header { display: flex; align-items: center; justify-content: space-between; }
.filters { margin-bottom: 12px; }
.pager { margin-top: 16px; display: flex; justify-content: flex-end; }
.desc { margin-bottom: 16px; }
h4 { margin: 0 0 8px; color: #666; }
</style>
