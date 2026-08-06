<script setup>
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { fetchEscalatedAfterSales } from '@/api/admin';

const loading = ref(false);
const list = ref([]);
const total = ref(0);

function formatTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN');
}

async function loadList() {
  loading.value = true;
  try {
    const data = await fetchEscalatedAfterSales({ page: 1, pageSize: 50 });
    list.value = data.list || [];
    total.value = data.total || 0;
  } catch (e) {
    ElMessage.error(e.message || '加载失败');
  } finally {
    loading.value = false;
  }
}

onMounted(loadList);
</script>

<template>
  <el-card shadow="never">
    <template #header>
      <div class="card-header">
        <span>售后仲裁</span>
        <el-tag type="danger">ESCALATED</el-tag>
      </div>
    </template>

    <el-table v-loading="loading" :data="list" stripe empty-text="暂无待仲裁售后">
      <el-table-column prop="afterSaleId" label="工单ID" width="90" />
      <el-table-column prop="orderId" label="订单ID" width="90" />
      <el-table-column prop="type" label="类型" width="120" />
      <el-table-column prop="reason" label="申请原因" min-width="200" show-overflow-tooltip />
      <el-table-column label="申请时间" width="170">
        <template #default="{ row }">{{ formatTime(row.appliedAt) }}</template>
      </el-table-column>
      <el-table-column label="商家处理截止" width="170">
        <template #default="{ row }">{{ formatTime(row.merchantDeadline) }}</template>
      </el-table-column>
    </el-table>

    <div class="summary">共 {{ total }} 条待仲裁</div>
  </el-card>
</template>

<style scoped>
.card-header { display: flex; align-items: center; justify-content: space-between; }
.summary { margin-top: 16px; text-align: right; color: #666; }
</style>
