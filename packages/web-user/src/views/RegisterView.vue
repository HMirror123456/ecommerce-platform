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
  <div class="auth-page">
    <div class="auth-shell">
      <aside class="brand-panel">
        <div class="brand-inner">
          <p class="brand-kicker">欢迎加入</p>
          <h1 class="brand-name">电商平台</h1>
          <p class="brand-desc">注册即享完整购物体验</p>
          <ul class="brand-points">
            <li>收藏心仪商品</li>
            <li>管理收货地址</li>
            <li>跟踪订单与售后</li>
          </ul>
        </div>
      </aside>

      <section class="form-panel">
        <div class="form-card">
          <h2>用户注册</h2>
          <p class="subtitle">注册后即可浏览商品并下单</p>
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
                placeholder="请输入 11 位手机号"
              />
            </el-form-item>
            <el-form-item label="密码" prop="password">
              <el-input
                v-model="form.password"
                size="large"
                type="password"
                show-password
                autocomplete="new-password"
                placeholder="至少 6 位"
              />
            </el-form-item>
            <el-form-item label="确认密码" prop="confirmPassword">
              <el-input
                v-model="form.confirmPassword"
                size="large"
                type="password"
                show-password
                autocomplete="new-password"
                placeholder="再次输入密码"
                @keyup.enter="onSubmit"
              />
            </el-form-item>
            <el-button type="primary" class="submit" size="large" :loading="loading" @click="onSubmit">
              注册
            </el-button>
          </el-form>
          <p class="footer-link">
            已有账号？
            <router-link :to="{ name: 'login', query: route.query }">去登录</router-link>
          </p>
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
</style>
