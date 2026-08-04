<script setup>
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { login } from '@/api/admin';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const form = ref({ username: 'operator', password: 'operator123' });
const loading = ref(false);

onMounted(() => {
  if (route.query.reason === 'forbidden') {
    ElMessage.warning('当前账号无商品审核权限，请使用运营管理员登录');
  }
});

async function onSubmit() {
  if (!form.value.username || !form.value.password) {
    ElMessage.warning('请输入账号和密码');
    return;
  }
  loading.value = true;
  try {
    const data = await login(form.value.username, form.value.password);
    auth.setSession(data, form.value.username);
    if (data.role !== 'OPERATOR') {
      ElMessage.warning('该账号为客服角色，暂无商品审核权限');
      auth.logout();
      return;
    }
    ElMessage.success('登录成功');
    router.replace((route.query.redirect) || '/audit/products');
  } catch (e) {
    ElMessage.error(e.message || '登录失败');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <h1>平台管理后台</h1>
      <p class="subtitle">运营管理员登录 · 商品审核</p>
      <el-form label-position="top" @submit.prevent="onSubmit">
        <el-form-item label="账号">
          <el-input v-model="form.username" placeholder="operator" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" show-password placeholder="operator123" @keyup.enter="onSubmit" />
        </el-form-item>
        <el-button type="primary" class="submit" :loading="loading" @click="onSubmit">登录</el-button>
      </el-form>
      <p class="hint">演示账号：operator / operator123</p>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #001529 0%, #304156 100%);
}
.login-card {
  width: 400px;
  padding: 32px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0,0,0,.15);
}
h1 { margin: 0 0 8px; font-size: 22px; text-align: center; }
.subtitle { margin: 0 0 24px; text-align: center; color: #999; font-size: 13px; }
.submit { width: 100%; margin-top: 8px; }
.hint { margin: 16px 0 0; text-align: center; color: #999; font-size: 12px; }
</style>
