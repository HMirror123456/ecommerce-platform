<script setup>
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { fetchProfile, updateProfile } from '@/api/user';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();

const loading = ref(false);
const saving = ref(false);
const profile = ref({ userId: null, phone: '', nickname: '' });
const form = ref({
  nickname: '',
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
});

async function loadProfile() {
  loading.value = true;
  try {
    const data = await fetchProfile();
    profile.value = data;
    form.value.nickname = data.nickname || '';
    auth.setProfile(data);
  } catch (e) {
    ElMessage.error(e.message || '加载资料失败');
  } finally {
    loading.value = false;
  }
}

async function onSaveBasic() {
  if (!form.value.nickname?.trim()) {
    ElMessage.warning('请填写昵称');
    return;
  }
  saving.value = true;
  try {
    const data = await updateProfile({ nickname: form.value.nickname.trim() });
    profile.value = data;
    auth.setProfile(data);
    ElMessage.success('昵称已更新');
  } catch (e) {
    ElMessage.error(e.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function onSavePassword() {
  if (!form.value.currentPassword || !form.value.newPassword) {
    ElMessage.warning('请填写当前密码与新密码');
    return;
  }
  if (form.value.newPassword.length < 6) {
    ElMessage.warning('新密码至少 6 位');
    return;
  }
  if (form.value.newPassword !== form.value.confirmPassword) {
    ElMessage.warning('两次输入的新密码不一致');
    return;
  }
  saving.value = true;
  try {
    await updateProfile({
      currentPassword: form.value.currentPassword,
      newPassword: form.value.newPassword,
    });
    form.value.currentPassword = '';
    form.value.newPassword = '';
    form.value.confirmPassword = '';
    ElMessage.success('密码已更新');
  } catch (e) {
    ElMessage.error(e.message || '修改密码失败');
  } finally {
    saving.value = false;
  }
}

onMounted(loadProfile);
</script>

<template>
  <div class="profile-page" v-loading="loading">
    <h2 class="page-title">个人信息</h2>

    <el-card shadow="never" class="section-card">
      <template #header><span>基本资料</span></template>
      <el-form label-width="96px" style="max-width: 480px">
        <el-form-item label="用户 ID">
          <el-input :model-value="profile.userId" disabled />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input :model-value="profile.phone" disabled />
          <p class="hint">手机号作为登录账号，不可修改</p>
        </el-form-item>
        <el-form-item label="昵称" required>
          <el-input v-model="form.nickname" maxlength="64" show-word-limit placeholder="请输入昵称" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="onSaveBasic">保存资料</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never" class="section-card">
      <template #header><span>修改密码</span></template>
      <el-form label-width="96px" style="max-width: 480px">
        <el-form-item label="当前密码">
          <el-input v-model="form.currentPassword" type="password" show-password autocomplete="current-password" />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="form.newPassword" type="password" show-password autocomplete="new-password" />
        </el-form-item>
        <el-form-item label="确认密码">
          <el-input v-model="form.confirmPassword" type="password" show-password autocomplete="new-password" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :loading="saving" @click="onSavePassword">更新密码</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.page-title {
  margin: 0 0 16px;
  font-size: 20px;
}
.section-card {
  margin-bottom: 16px;
}
.hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.4;
}
</style>
