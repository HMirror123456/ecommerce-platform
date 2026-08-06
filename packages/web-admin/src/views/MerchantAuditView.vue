<script setup>
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { fetchPendingMerchants } from '@/api/admin';

const loading = ref(false);
const list = ref([]);

function formatTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN');
}

async function loadList() {
  loading.value = true;
  try {
    list.value = await fetchPendingMerchants();
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
        <span>商家入驻审核</span>
        <el-tag type="warning">待审核</el-tag>
      </div>
    </template>

    <el-table v-loading="loading" :data="list" stripe empty-text="暂无待审核商家">
      <el-table-column prop="merchantId" label="申请ID" width="100" />
      <el-table-column prop="shopName" label="店铺名称" min-width="160" />
      <el-table-column prop="contactName" label="联系人" width="120" />
      <el-table-column prop="contactPhone" label="联系电话" width="140" />
      <el-table-column label="申请时间" width="170">
        <template #default="{ row }">{{ formatTime(row.appliedAt) }}</template>
      </el-table-column>
    </el-table>

    <div class="summary">共 {{ list.length }} 条待审核</div>
  </el-card>
</template>

<style scoped>
.card-header { display: flex; align-items: center; justify-content: space-between; }
.summary { margin-top: 16px; text-align: right; color: #666; }
</style>
