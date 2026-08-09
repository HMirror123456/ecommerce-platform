<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { fetchDashboardSummary } from '@/api/admin';
import { useAuthStore } from '@/stores/auth';

const router = useRouter();
const auth = useAuthStore();

const loading = ref(false);
const summary = ref({
  pendingProductCount: 0,
  escalatedAfterSaleCount: 0,
  pendingMerchantCount: 0,
  auditedProductCount: 0,
  onShelfProductCount: 0,
  rejectedProductCount: 0,
  totalOrderCount: 0,
  pendingPaymentOrderCount: 0,
  recentPendingProducts: [],
  recentPendingMerchants: [],
  recentEscalatedAfterSales: [],
});

const roleLabel = computed(() => (auth.role === 'OPERATOR' ? '运营管理员' : '客服管理员'));

const operatorStatCards = computed(() => [
  { key: 'pendingProductCount', label: '待审核商品', type: 'warning', icon: 'Goods' },
  { key: 'pendingMerchantCount', label: '待审核商家', type: 'info', icon: 'Shop' },
  { key: 'auditedProductCount', label: '累计审核次数', type: 'primary', icon: 'DocumentChecked' },
  { key: 'onShelfProductCount', label: '已上架商品', type: 'success', icon: 'CircleCheck' },
  { key: 'rejectedProductCount', label: '已驳回商品', type: 'danger', icon: 'CircleClose' },
  { key: 'totalOrderCount', label: '全平台订单', type: 'primary', icon: 'List' },
]);

const csStatCards = computed(() => [
  { key: 'escalatedAfterSaleCount', label: '待仲裁售后', type: 'danger', icon: 'Service' },
  { key: 'pendingPaymentOrderCount', label: '待支付订单', type: 'warning', icon: 'Wallet' },
  { key: 'totalOrderCount', label: '全平台订单', type: 'primary', icon: 'List' },
]);

const visibleStatCards = computed(() => (auth.isOperator ? operatorStatCards.value : csStatCards.value));

const quickLinks = computed(() => {
  const links = [];
  if (auth.isOperator) {
    links.push(
      { label: '商品审核', desc: '处理待审 SPU，查看审核历史', path: '/audit/products', icon: 'Goods' },
      { label: '商家审核', desc: '入驻申请通过或驳回', path: '/audit/merchants', icon: 'Shop' },
    );
  }
  if (auth.isCsAgent) {
    links.push({ label: '售后仲裁', desc: '处理 ESCALATED 工单', path: '/after-sales', icon: 'Service' });
  }
  links.push({ label: '订单查询', desc: '全平台订单筛选与详情', path: '/orders', icon: 'List' });
  return links;
});

const previewSections = computed(() => {
  if (auth.isOperator) {
    return [
      {
        key: 'products',
        title: '待审商品预览',
        path: '/audit/products',
        empty: '暂无待审核商品',
        rows: summary.value.recentPendingProducts || [],
        columns: [
          { prop: 'title', label: '商品标题' },
          { prop: 'shopName', label: '店铺', width: 140 },
          { prop: 'submittedAt', label: '提交时间', width: 170, time: true },
        ],
      },
      {
        key: 'merchants',
        title: '待审商家预览',
        path: '/audit/merchants',
        empty: '暂无待审核商家',
        rows: summary.value.recentPendingMerchants || [],
        columns: [
          { prop: 'shopName', label: '店铺名称' },
          { prop: 'contactName', label: '联系人', width: 100 },
          { prop: 'appliedAt', label: '申请时间', width: 170, time: true },
        ],
      },
    ];
  }
  return [
    {
      key: 'after-sales',
      title: '待仲裁售后预览',
      path: '/after-sales',
      empty: '暂无待仲裁售后',
      rows: summary.value.recentEscalatedAfterSales || [],
      columns: [
        { prop: 'orderNo', label: '订单号', width: 160 },
        { prop: 'shopName', label: '店铺', width: 120 },
        { prop: 'reason', label: '申请原因' },
        { prop: 'appliedAt', label: '申请时间', width: 170, time: true },
      ],
    },
  ];
});

function getCount(key) {
  return Number(summary.value[key]) || 0;
}

function formatTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN');
}

async function loadSummary() {
  loading.value = true;
  try {
    summary.value = { ...summary.value, ...(await fetchDashboardSummary()) };
  } catch (e) {
    ElMessage.error(e.message || '加载工作台失败');
  } finally {
    loading.value = false;
  }
}

function goTo(path) {
  router.push(path);
}

onMounted(loadSummary);
</script>

<template>
  <div v-loading="loading" class="dashboard">
    <el-card shadow="never" class="welcome-card">
      <div class="welcome-header">
        <div>
          <h2 class="welcome-title">你好，{{ auth.username }}</h2>
          <p class="welcome-desc">{{ roleLabel }} · 今日待办概览</p>
        </div>
        <el-button @click="loadSummary">刷新</el-button>
      </div>
    </el-card>

    <el-row :gutter="16" class="stat-row">
      <el-col v-for="card in visibleStatCards" :key="card.key" :xs="24" :sm="12" :md="8">
        <div class="stat-card" :class="`stat-card--${card.type}`">
          <div class="stat-icon">
            <el-icon :size="22"><component :is="card.icon" /></el-icon>
          </div>
          <div class="stat-body">
            <div class="stat-label">{{ card.label }}</div>
            <div class="stat-value">{{ getCount(card.key) }}</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <el-card shadow="never" class="section-card">
      <template #header><span>快捷入口</span></template>
      <el-row :gutter="16">
        <el-col v-for="item in quickLinks" :key="item.path" :xs="24" :sm="12" :md="6">
          <div class="quick-link" @click="goTo(item.path)">
            <el-icon class="quick-icon"><component :is="item.icon" /></el-icon>
            <div class="quick-title">{{ item.label }}</div>
            <div class="quick-desc">{{ item.desc }}</div>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <el-row :gutter="16">
      <el-col v-for="section in previewSections" :key="section.key" :xs="24" :lg="auth.isOperator ? 12 : 24">
        <el-card shadow="never" class="section-card preview-card">
          <template #header>
            <div class="preview-header">
              <span>{{ section.title }}</span>
              <el-button link type="primary" @click="goTo(section.path)">查看全部</el-button>
            </div>
          </template>
          <el-table
            :data="section.rows"
            stripe
            size="small"
            :empty-text="section.empty"
            class="preview-table"
            @row-click="() => goTo(section.path)"
          >
            <el-table-column
              v-for="col in section.columns"
              :key="col.prop"
              :prop="col.prop"
              :label="col.label"
              :width="col.width"
              :min-width="col.width ? undefined : 120"
              show-overflow-tooltip
            >
              <template v-if="col.time" #default="{ row }">{{ formatTime(row[col.prop]) }}</template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.welcome-card :deep(.el-card__body) { padding: 20px 24px; }
.welcome-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.welcome-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: #333;
}
.welcome-desc {
  margin: 6px 0 0;
  color: #999;
  font-size: 13px;
}
.stat-row { margin-bottom: 0; }
.stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 96px;
  margin-bottom: 16px;
  padding: 18px 20px;
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e8e8e8;
  border-left-width: 4px;
}
.stat-card--warning { border-left-color: var(--el-color-warning); }
.stat-card--info { border-left-color: var(--el-color-info); }
.stat-card--success { border-left-color: var(--el-color-success); }
.stat-card--danger { border-left-color: var(--el-color-danger); }
.stat-card--primary { border-left-color: var(--el-color-primary); }
.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 8px;
  background: #f5f7fa;
  color: #606266;
}
.stat-label {
  color: #666;
  font-size: 13px;
}
.stat-value {
  margin-top: 6px;
  color: #333;
  font-size: 28px;
  font-weight: 600;
  line-height: 1.2;
}
.section-card { margin-bottom: 0; }
.quick-link {
  min-height: 96px;
  margin-bottom: 16px;
  padding: 16px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.quick-link:hover {
  border-color: var(--el-color-primary);
  box-shadow: 0 4px 12px rgba(64, 158, 255, 0.12);
}
.quick-icon {
  margin-bottom: 8px;
  color: var(--el-color-primary);
  font-size: 20px;
}
.quick-title {
  color: #333;
  font-weight: 600;
}
.quick-desc {
  margin-top: 6px;
  color: #999;
  font-size: 12px;
  line-height: 1.5;
}
.preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.preview-table { cursor: pointer; }
.preview-card :deep(.el-card__body) { padding-top: 0; }
</style>
