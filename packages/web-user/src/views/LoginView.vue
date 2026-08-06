<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { login } from '@/api/auth';
import { useAuthStore } from '@/stores/auth';

const DEFAULT_REDIRECT = '/products';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const formRef = ref(null);
const form = ref({ phone: '', password: '' });
const loading = ref(false);
const rules = {
  phone: [{ required: true, message: '请输入手机号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
};

async function onSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;
  try {
    const data = await login(form.value.phone, form.value.password);
    auth.setSession(data, form.value.phone);
    ElMessage.success('登录成功');
    router.replace(route.query.redirect || DEFAULT_REDIRECT);
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
      <h1>用户登录</h1>
      <p class="subtitle">登录后即可下单购买</p>
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="onSubmit">
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" autocomplete="username" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            autocomplete="current-password"
            placeholder="请输入密码"
            @keyup.enter="onSubmit"
          />
        </el-form-item>
        <el-button type="primary" class="submit" :loading="loading" @click="onSubmit">登录</el-button>
      </el-form>
      <p class="demo-hint">演示账号：13800138000 / 123456</p>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #e4393c 0%, #c81623 100%);
}
.login-card {
  width: 400px;
  padding: 32px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}
h1 {
  margin: 0 0 8px;
  font-size: 22px;
  text-align: center;
  color: var(--text-title);
}
.subtitle {
  margin: 0 0 24px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}
.submit {
  width: 100%;
  margin-top: 8px;
}
.demo-hint {
  margin: 16px 0 0;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
}
</style>
