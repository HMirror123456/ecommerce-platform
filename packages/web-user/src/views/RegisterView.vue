<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { register } from '@/api/auth';
import { useAuthStore } from '@/stores/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const formRef = ref(null);
const form = ref({ phone: '', password: '', confirmPassword: '' });
const loading = ref(false);

const rules = {
  phone: [
    { required: true, message: '请输入手机号', trigger: 'blur' },
    { pattern: /^1\d{10}$/, message: '请输入有效的 11 位手机号', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 6, message: '密码至少 6 位', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请确认密码', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value !== form.value.password) callback(new Error('两次输入的密码不一致'));
        else callback();
      },
      trigger: 'blur',
    },
  ],
};

async function onSubmit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;
  try {
    const data = await register(form.value.phone, form.value.password);
    auth.setSession(data, form.value.phone);
    ElMessage.success('注册成功');
    router.replace(route.query.redirect || '/products');
  } catch (e) {
    ElMessage.error(e.message || '注册失败');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="register-page">
    <div class="register-card">
      <h1>用户注册</h1>
      <p class="subtitle">注册后即可浏览商品并下单</p>
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" @submit.prevent="onSubmit">
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" autocomplete="username" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            show-password
            autocomplete="new-password"
            placeholder="至少 6 位"
          />
        </el-form-item>
        <el-form-item label="确认密码" prop="confirmPassword">
          <el-input
            v-model="form.confirmPassword"
            type="password"
            show-password
            autocomplete="new-password"
            placeholder="再次输入密码"
            @keyup.enter="onSubmit"
          />
        </el-form-item>
        <el-button type="primary" class="submit" :loading="loading" @click="onSubmit">注册</el-button>
      </el-form>
      <p class="footer-link">
        已有账号？
        <router-link :to="{ name: 'login', query: route.query }">去登录</router-link>
      </p>
    </div>
  </div>
</template>

<style scoped>
.register-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #e4393c 0%, #c81623 100%);
}
.register-card {
  width: 400px;
  padding: 32px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}
h1 {
  margin: 0 0 8px;
  font-size: 24px;
  text-align: center;
}
.subtitle {
  margin: 0 0 24px;
  text-align: center;
  color: var(--text-muted);
}
.submit {
  width: 100%;
  margin-top: 8px;
}
.footer-link {
  margin: 16px 0 0;
  text-align: center;
  color: var(--text-body);
  font-size: 13px;
}
.footer-link a {
  color: var(--color-primary);
  text-decoration: none;
}
</style>
