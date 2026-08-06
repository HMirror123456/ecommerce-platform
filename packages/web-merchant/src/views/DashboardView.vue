<script setup>
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';
import { getDashboardSummary } from '@/api/merchant';

const router = useRouter();
const loading = ref(false);
const summary = ref({
  merchantId: null,
  shopId: null,
  shopName: '',
  productTotal: 0,
  draftProductCount: 0,
  pendingAuditProductCount: 0,
  onShelfProductCount: 0,
  rejectedProductCount: 0,
  offShelfProductCount: 0,
  pendingShipmentOrderCount: 0,
  shippedOrderCount: 0,
});

const statCards = [
  { label: '商品总数', key: 'productTotal', type: 'primary' },
  { label: '草稿商品', key: 'draftProductCount', type: 'info' },
  { label: '待审核商品', key: 'pendingAuditProductCount', type: 'warning' },
  { label: '已上架商品', key: 'onShelfProductCount', type: 'success' },
  { label: '已驳回商品', key: 'rejectedProductCount', type: 'danger' },
  { label: '待发货订单', key: 'pendingShipmentOrderCount', type: 'warning' },
];

const quickLinks = [
  { label: '去商品管理', description: '查看商品状态并提交审核', path: '/products' },
  { label: '去发布商品', description: '创建 SPU/SKU 草稿', path: '/products/create' },
  { label: '去订单管理', description: '查看待发货订单并填写物流', path: '/orders' },
];

function getNumber(key) {
  return Number(summary.value?.[key]) || 0;
}

async function loadSummary() {
  loading.value = true;
  try {
    const data = await getDashboardSummary();
    summary.value = { ...summary.value, ...(data || {}) };
  } catch (e) {
    ElMessage.error(e.message || '加载工作台统计失败');
  } finally {
    loading.value = false;
  }
}

onMounted(loadSummary);
</script>

<template>
  <div v-loading="loading" class="dashboard">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div>
            <div class="title">商家工作台</div>
            <div class="description">
              {{ summary.shopName || '当前店铺' }} 的商品审核与订单履约概览
            </div>
          </div>
          <el-button @click="loadSummary">刷新</el-button>
        </div>
      </template>

      <el-row :gutter="16">
        <el-col v-for="item in statCards" :key="item.key" :xs="24" :sm="12" :md="8">
          <div class="stat-card">
            <div class="stat-label">{{ item.label }}</div>
            <div class="stat-value">{{ getNumber(item.key) }}</div>
            <el-tag size="small" :type="item.type">实时统计</el-tag>
          </div>
        </el-col>
      </el-row>
    </el-card>

    <el-card shadow="never" class="quick-card">
      <template #header>
        <span>快捷入口</span>
      </template>
      <el-row :gutter="16">
        <el-col v-for="item in quickLinks" :key="item.path" :xs="24" :sm="8">
          <div class="quick-link" @click="router.push(item.path)">
            <div class="quick-title">{{ item.label }}</div>
            <div class="quick-desc">{{ item.description }}</div>
          </div>
        </el-col>
      </el-row>
    </el-card>
  </div>
</template>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.title {
  color: #333;
  font-weight: 600;
  line-height: 24px;
}
.description {
  margin-top: 4px;
  color: #999;
  font-size: 13px;
}
.stat-card {
  min-height: 116px;
  margin-bottom: 16px;
  padding: 18px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  background: #fff;
}
.stat-label {
  color: #666;
  font-size: 13px;
}
.stat-value {
  margin: 10px 0;
  color: #333;
  font-size: 30px;
  font-weight: 600;
}
.quick-card {
  margin-top: 0;
}
.quick-link {
  min-height: 88px;
  padding: 16px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  background: #fff;
  cursor: pointer;
  transition: border-color .2s, box-shadow .2s;
}
.quick-link:hover {
  border-color: #409eff;
  box-shadow: 0 4px 12px rgba(64, 158, 255, .12);
}
.quick-title {
  color: #333;
  font-weight: 600;
}
.quick-desc {
  margin-top: 8px;
  color: #999;
  font-size: 13px;
}
</style>
