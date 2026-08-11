<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { fetchOnboardingStatus, submitOnboardingApplication } from '@/api/merchant';

const router = useRouter();
const mode = ref('apply');
const formRef = ref(null);
const loading = ref(false);
const form = ref({
  shopName: '',
  contactName: '',
  contactPhone: '',
});
const rules = {
  shopName: [{ required: true, message: '请输入店铺名称', trigger: 'blur' }],
  contactName: [{ required: true, message: '请输入联系人', trigger: 'blur' }],
  contactPhone: [
    { required: true, message: '请输入联系电话', trigger: 'blur' },
    { pattern: /^1\d{10}$/, message: '请输入有效手机号', trigger: 'blur' },
  ],
};

const statusPhone = ref('');
const statusList = ref([]);
const statusLoading = ref(false);

const statusMap = {
  PENDING: { label: '待审核', type: 'warning' },
  APPROVED: { label: '已通过', type: 'success' },
  REJECTED: { label: '已驳回', type: 'danger' },
};

const hasApproved = computed(() => statusList.value.some((item) => item.status === 'APPROVED'));
const hasRejected = computed(() => statusList.value.some((item) => item.status === 'REJECTED'));
const hasPending = computed(() => statusList.value.some((item) => item.status === 'PENDING'));

function formatTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN');
}

async function onSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  loading.value = true;
  try {
    const data = await submitOnboardingApplication(form.value);
    ElMessage.success(data.message || '提交成功');
    statusPhone.value = form.value.contactPhone;
    mode.value = 'status';
    await loadStatus();
  } catch (e) {
    ElMessage.error(e.message || '提交失败');
  } finally {
    loading.value = false;
  }
}

async function loadStatus() {
  const phone = statusPhone.value.trim();
  if (!/^1\d{10}$/.test(phone)) {
    ElMessage.warning('请输入有效手机号');
    return;
  }
  statusLoading.value = true;
  try {
    const data = await fetchOnboardingStatus(phone);
    statusList.value = data.list || [];
  } catch (e) {
    statusList.value = [];
    ElMessage.error(e.message || '查询失败');
  } finally {
    statusLoading.value = false;
  }
}
</script>

<template>
  <div class="page">
    <div class="card">
      <div class="header">
        <h1>商家入驻</h1>
        <el-button link type="primary" @click="router.push('/login')">已有账号？去登录</el-button>
      </div>

      <el-tabs v-model="mode">
        <el-tab-pane label="提交申请" name="apply">
          <p class="hint">填写店铺信息提交入驻申请，平台审核通过后将为您创建商家账号（初始密码 123456）。</p>
          <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="onSubmit">
            <el-form-item label="店铺名称" prop="shopName">
              <el-input v-model="form.shopName" placeholder="如：新锐数码店" />
            </el-form-item>
            <el-form-item label="联系人" prop="contactName">
              <el-input v-model="form.contactName" placeholder="负责人姓名" />
            </el-form-item>
            <el-form-item label="联系电话" prop="contactPhone">
              <el-input v-model="form.contactPhone" placeholder="用于接收审核结果通知" maxlength="11" />
            </el-form-item>
            <el-button type="primary" class="submit" :loading="loading" :disabled="loading" @click="onSubmit">提交入驻申请</el-button>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="查询进度" name="status">
          <div class="status-query">
            <el-input v-model="statusPhone" placeholder="请输入申请时填写的手机号" maxlength="11" />
            <el-button type="primary" :loading="statusLoading" :disabled="statusLoading" @click="loadStatus">查询</el-button>
          </div>
          <el-table v-loading="statusLoading" :data="statusList" stripe empty-text="暂无申请记录">
            <el-table-column prop="shopName" label="店铺名称" min-width="140" />
            <el-table-column prop="contactName" label="联系人" width="110" />
            <el-table-column prop="contactPhone" label="联系电话" width="130" />
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="statusMap[row.status]?.type" size="small">
                  {{ statusMap[row.status]?.label || row.status }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="申请时间" width="170">
              <template #default="{ row }">{{ formatTime(row.appliedAt) }}</template>
            </el-table-column>
            <el-table-column label="审核时间" width="170">
              <template #default="{ row }">{{ formatTime(row.auditedAt) }}</template>
            </el-table-column>
            <el-table-column label="商家账号" width="120">
              <template #default="{ row }">
                <span v-if="row.merchantUsername">{{ row.merchantUsername }}</span>
                <span v-else>-</span>
              </template>
            </el-table-column>
            <el-table-column prop="rejectReason" label="驳回原因" min-width="160" show-overflow-tooltip />
          </el-table>
          <p v-if="hasPending" class="status-tip pending-tip">
            申请待平台审核，请等待运营处理；商家端不会伪造审核结果。
          </p>
          <p v-if="hasRejected" class="status-tip reject-tip">
            如申请被驳回，请根据驳回原因调整资料后重新提交。
          </p>
          <p v-if="hasApproved" class="status-tip success-tip">
            审核已通过，请使用上方商家账号登录（初始密码 123456）。
          </p>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #001529 0%, #304156 100%);
  padding: 24px;
}
.card {
  width: 720px;
  max-width: 100%;
  padding: 32px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
h1 { margin: 0; font-size: 22px; }
.hint { margin: 0 0 20px; color: #999; font-size: 13px; line-height: 1.6; }
.submit { width: 100%; margin-top: 8px; }
.status-query { display: flex; gap: 12px; margin-bottom: 16px; }
.status-tip { margin: 16px 0 0; font-size: 13px; line-height: 1.6; }
.pending-tip { color: #e6a23c; }
.reject-tip { color: #f56c6c; }
.success-tip { color: #67c23a; }
</style>
