<script setup>
import { onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus } from '@element-plus/icons-vue';
import { fetchProfile, updateProfile } from '@/api/user';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();

const loading = ref(false);
const saving = ref(false);
const avatarSaving = ref(false);
const profile = ref({ userId: null, phone: '', nickname: '', avatarUrl: null });
const form = ref({
  nickname: '',
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
});

const AVATAR_MAX_BYTES = 200 * 1024;

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

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

async function onBeforeAvatarUpload(file) {
  const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowed.includes(file.type)) {
    ElMessage.warning('仅支持 JPG / PNG / GIF / WEBP 图片');
    return false;
  }
  if (file.size > AVATAR_MAX_BYTES) {
    ElMessage.warning('头像请控制在 200KB 以内');
    return false;
  }

  avatarSaving.value = true;
  try {
    const dataUrl = await readFileAsDataUrl(file);
    const data = await updateProfile({ avatarUrl: dataUrl });
    profile.value = data;
    auth.setProfile(data);
    ElMessage.success('头像已更新');
  } catch (e) {
    ElMessage.error(e.message || '上传头像失败');
  } finally {
    avatarSaving.value = false;
  }
  return false;
}

async function onClearAvatar() {
  avatarSaving.value = true;
  try {
    const data = await updateProfile({ avatarUrl: '' });
    profile.value = data;
    auth.setProfile(data);
    ElMessage.success('已恢复默认头像');
  } catch (e) {
    ElMessage.error(e.message || '清除头像失败');
  } finally {
    avatarSaving.value = false;
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
        <el-form-item label="头像">
          <div class="avatar-row">
            <el-upload
              class="avatar-uploader"
              :show-file-list="false"
              accept="image/jpeg,image/png,image/gif,image/webp"
              :disabled="avatarSaving"
              :before-upload="onBeforeAvatarUpload"
            >
              <div class="avatar-preview" :class="{ loading: avatarSaving }">
                <img v-if="profile.avatarUrl" :src="profile.avatarUrl" alt="头像" class="avatar-img" />
                <el-icon v-else class="avatar-plus"><Plus /></el-icon>
              </div>
            </el-upload>
            <div class="avatar-actions">
              <p class="avatar-tip">点击左侧头像更换</p>
              <el-button
                v-if="profile.avatarUrl"
                link
                type="danger"
                :loading="avatarSaving"
                @click="onClearAvatar"
              >
                恢复默认
              </el-button>
              <p class="hint">支持 JPG / PNG / GIF / WEBP，建议不超过 200KB</p>
            </div>
          </div>
        </el-form-item>
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
.avatar-row {
  display: flex;
  align-items: center;
  gap: 16px;
}
.avatar-preview {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  border: 1px dashed var(--border-color);
  background: #fff1f0;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.15s;
}
.avatar-preview:hover {
  border-color: var(--color-primary);
}
.avatar-preview.loading {
  opacity: 0.7;
  pointer-events: none;
}
.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.avatar-plus {
  font-size: 28px;
  color: var(--color-primary);
}
.avatar-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}
.avatar-tip {
  margin: 0;
  font-size: 14px;
  color: var(--text-body);
}
.avatar-uploader :deep(.el-upload) {
  border: none;
  background: transparent;
}
</style>
