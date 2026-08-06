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
});

const operatorCards = computed(() => [
  {
    key: 'products',
    title: '待审核商品',
    count: summary.value.pendingProductCount,
    type: 'warning',
    path: '/audit/products',
    roles: ['OPERATOR'],
  },
  {
    key: 'merchants',
    title: '待审核商家',
    count: summary.value.pendingMerchantCount,
    type: 'info',
    path: '/audit/merchants',
    roles: ['OPERATOR'],
  },
]);

const csCards = computed(() => [
  {
    key: 'after-sales',
    title: '待仲裁售后',
    count: summary.value.escalatedAfterSaleCount,
    type: 'danger',
    path: '/after-sales',
    roles: ['CS_AGENT'],
  },
  {
    key: 'orders',
    title: '全平台订单',
    count: null,
    type: 'primary',
    path: '/orders',
    roles: ['CS_AGENT', 'OPERATOR'],
    linkLabel: '进入查询',
  },
]);

const visibleCards = computed(() => {
  const cards = auth.isOperator ? operatorCards.value : csCards.value;
  if (auth.isOperator) {
    return [...cards, ...csCards.value.filter((c) => c.key === 'orders')];
  }
  return cards;
});

async function loadSummary() {
  loading.value = true;
  try {
    summary.value = await fetchDashboardSummary();
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
    <el-row :gutter="16">
      <el-col v-for="card in visibleCards" :key="card.key" :xs="24" :sm="12" :lg="8">
        <el-card shadow="hover" class="stat-card" @click="goTo(card.path)">
          <div class="stat-title">{{ card.title }}</div>
          <div v-if="card.count != null" class="stat-count">
            <el-tag :type="card.type" size="large">{{ card.count }}</el-tag>
          </div>
          <div v-else class="stat-link">{{ card.linkLabel || '查看' }}</div>
          <div class="stat-hint">点击进入</div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<style scoped>
.dashboard { min-height: 200px; }
.stat-card {
  margin-bottom: 16px;
  cursor: pointer;
  transition: transform 0.15s ease;
}
.stat-card:hover { transform: translateY(-2px); }
.stat-title {
  color: #666;
  font-size: 14px;
  margin-bottom: 12px;
}
.stat-count :deep(.el-tag) {
  font-size: 28px;
  padding: 8px 16px;
  height: auto;
}
.stat-link {
  color: var(--el-color-primary);
  font-size: 18px;
  font-weight: 600;
}
.stat-hint {
  margin-top: 12px;
  color: #999;
  font-size: 12px;
}
</style>
