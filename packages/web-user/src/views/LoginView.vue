<script setup>
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { login } from '@/api/auth';
import { useAuthStore } from '@/stores/auth';

const DEFAULT_REDIRECT = '/products';
const DEMO_PHONE = '13800138000';
const DEMO_PASSWORD = '123456';

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

function fillDemo() {
  form.value.phone = DEMO_PHONE;
  form.value.password = DEMO_PASSWORD;
  formRef.value?.clearValidate?.();
}

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
  <div class="auth-page">
    <div class="auth-shell">
      <aside class="brand-panel">
        <div class="brand-inner">
          <p class="brand-kicker">C 端商城</p>
          <h1 class="brand-name">电商平台</h1>
          <p class="brand-desc">正品好物 · 极速下单 · 安心售后</p>
          <ul class="brand-points">
            <li>海量 SKU，规格可选</li>
            <li>购物车勾选结算</li>
            <li>订单全程可追踪</li>
          </ul>
        </div>
      </aside>

      <section class="form-panel">
        <div class="form-card">
          <h2>用户登录</h2>
          <p class="subtitle">登录后即可浏览商品并下单购买</p>
          <el-form
            ref="formRef"
            :model="form"
            :rules="rules"
            label-position="top"
            @submit.prevent="onSubmit"
          >
            <el-form-item label="手机号" prop="phone">
              <el-input
                v-model="form.phone"
                size="large"
                autocomplete="username"
                placeholder="请输入手机号"
              />
            </el-form-item>
            <el-form-item label="密码" prop="password">
              <el-input
                v-model="form.password"
                size="large"
                type="password"
                show-password
                autocomplete="current-password"
                placeholder="请输入密码"
                @keyup.enter="onSubmit"
              />
            </el-form-item>
            <el-button type="primary" class="submit" size="large" :loading="loading" @click="onSubmit">
              登录
            </el-button>
          </el-form>

          <p class="footer-link">
            还没有账号？
            <router-link :to="{ name: 'register', query: route.query }">立即注册</router-link>
          </p>

          <button type="button" class="demo-chip" @click="fillDemo">
            <span class="demo-label">演示账号</span>
            <span class="demo-value">{{ DEMO_PHONE }} / {{ DEMO_PASSWORD }}</span>
            <span class="demo-action">一键填入</span>
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    radial-gradient(circle at 12% 18%, rgba(255, 255, 255, 0.18), transparent 42%),
    radial-gradient(circle at 88% 82%, rgba(0, 0, 0, 0.12), transparent 40%),
    linear-gradient(135deg, #e4393c 0%, #c81623 55%, #9f1018 100%);
}

.auth-shell {
  width: min(920px, 100%);
  display: grid;
  grid-template-columns: 1.05fr 1fr;
  overflow: hidden;
  border-radius: 16px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.28);
  background: #fff;
}

@media (max-width: 800px) {
  .auth-shell {
    grid-template-columns: 1fr;
  }

  .brand-panel {
    min-height: 180px;
  }
}

.brand-panel {
  position: relative;
  color: #fff;
  background:
    linear-gradient(160deg, rgba(255, 255, 255, 0.12), transparent 45%),
    linear-gradient(180deg, #ff5a5f 0%, #c81623 100%);
  padding: 40px 36px;
  display: flex;
  align-items: flex-end;
}

.brand-kicker {
  margin: 0 0 10px;
  font-size: 13px;
  letter-spacing: 0.12em;
  opacity: 0.85;
}

.brand-name {
  margin: 0 0 12px;
  font-size: 36px;
  font-weight: 800;
  letter-spacing: 0.04em;
  line-height: 1.15;
}

.brand-desc {
  margin: 0 0 24px;
  font-size: 15px;
  opacity: 0.92;
}

.brand-points {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.brand-points li {
  position: relative;
  padding-left: 18px;
  font-size: 14px;
  opacity: 0.95;
}

.brand-points li::before {
  content: '';
  position: absolute;
  left: 0;
  top: 7px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #fff;
}

.form-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 36px 32px;
  background: #fff;
}

.form-card {
  width: 100%;
  max-width: 360px;
}

.form-card h2 {
  margin: 0 0 8px;
  font-size: 24px;
  color: var(--text-title);
}

.subtitle {
  margin: 0 0 28px;
  color: var(--text-muted);
  font-size: 13px;
}

.submit {
  width: 100%;
  margin-top: 8px;
  height: 44px;
  font-size: 16px;
}

.footer-link {
  margin: 18px 0 0;
  text-align: center;
  color: var(--text-body);
  font-size: 13px;
}

.footer-link a {
  color: var(--color-primary);
  text-decoration: none;
  font-weight: 600;
}

.demo-chip {
  margin-top: 18px;
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  padding: 12px 14px;
  border: 1px dashed #ffccc7;
  border-radius: 8px;
  background: #fff8f8;
  cursor: pointer;
  text-align: left;
  transition: background 0.2s, border-color 0.2s;
}

.demo-chip:hover {
  background: #fff1f0;
  border-color: var(--color-primary);
}

.demo-label {
  font-size: 12px;
  color: var(--color-primary);
  font-weight: 700;
}

.demo-value {
  flex: 1;
  font-size: 12px;
  color: var(--text-body);
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

.demo-action {
  font-size: 12px;
  color: var(--color-primary);
  font-weight: 600;
}
</style>
