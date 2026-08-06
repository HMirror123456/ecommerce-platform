<script setup>
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useRouter } from 'vue-router';
import { createMerchantProduct } from '@/api/merchant';

const router = useRouter();
const formRef = ref(null);
const submitting = ref(false);

function createSku() {
  return {
    specName: '',
    specValue: '',
    price: null,
    available: null,
  };
}

const form = ref({
  categoryId: null,
  title: '',
  description: '',
  mainImage: '',
  skus: [createSku()],
});

const nonNegativeNumberRule = (message) => ({
  validator: (_rule, value, callback) => {
    if (value == null || value === '') {
      callback(new Error(message));
      return;
    }
    if (!Number.isFinite(Number(value)) || Number(value) < 0) {
      callback(new Error('请输入不小于 0 的数字'));
      return;
    }
    callback();
  },
  trigger: 'change',
});

const nonNegativeIntegerRule = (message) => ({
  validator: (_rule, value, callback) => {
    if (value == null || value === '') {
      callback(new Error(message));
      return;
    }
    if (!Number.isInteger(Number(value)) || Number(value) < 0) {
      callback(new Error('请输入不小于 0 的整数'));
      return;
    }
    callback();
  },
  trigger: 'change',
});

const requiredTrimRule = (message) => ({
  validator: (_rule, value, callback) => {
    if (!String(value || '').trim()) {
      callback(new Error(message));
      return;
    }
    callback();
  },
  trigger: 'blur',
});

const rules = {
  categoryId: [
    {
      validator: (_rule, value, callback) => {
        if (value == null || value === '') {
          callback(new Error('请输入分类ID'));
          return;
        }
        if (!Number.isInteger(Number(value))) {
          callback(new Error('请输入有效的分类ID'));
          return;
        }
        callback();
      },
      trigger: 'change',
    },
  ],
  title: [requiredTrimRule('请输入商品标题')],
  description: [requiredTrimRule('请输入商品描述')],
  mainImage: [requiredTrimRule('请输入商品主图地址')],
};

const skuSpecNameRules = [requiredTrimRule('请输入规格名')];
const skuSpecValueRules = [requiredTrimRule('请输入规格值')];
const skuPriceRules = [nonNegativeNumberRule('请输入价格')];
const skuAvailableRules = [nonNegativeIntegerRule('请输入可用库存')];

function getSkuField(index, field) {
  return `skus.${index}.${field}`;
}

function addSku() {
  form.value.skus.push(createSku());
}

function removeSku(index) {
  if (form.value.skus.length <= 1) {
    ElMessage.warning('至少保留一个 SKU');
    return;
  }
  form.value.skus.splice(index, 1);
}

function buildPayload() {
  return {
    categoryId: Number(form.value.categoryId),
    title: form.value.title.trim(),
    description: form.value.description.trim(),
    mainImage: form.value.mainImage.trim(),
    skus: form.value.skus.map((sku) => ({
      specJson: {
        [sku.specName.trim()]: sku.specValue.trim(),
      },
      price: Number(sku.price),
      stock: {
        available: Number(sku.available),
      },
    })),
  };
}

async function submitProduct() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  submitting.value = true;
  try {
    await createMerchantProduct(buildPayload());
    ElMessage.success('商品创建成功');
    router.push({ name: 'products' });
  } catch (e) {
    ElMessage.error(e.message || '商品创建失败');
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <el-card shadow="never">
    <template #header>
      <div class="card-header">
        <div>
          <div class="title">发布商品</div>
          <div class="description">填写 SPU 基础信息，并维护至少一个 SKU 与库存</div>
        </div>
        <el-button @click="router.push({ name: 'products' })">返回列表</el-button>
      </div>
    </template>

    <el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="product-form">
      <el-row :gutter="16">
        <el-col :xs="24" :sm="12">
          <el-form-item label="分类ID" prop="categoryId">
            <el-input-number v-model="form.categoryId" :min="0" :precision="0" controls-position="right" class="full-width" />
          </el-form-item>
        </el-col>
        <el-col :xs="24" :sm="12">
          <el-form-item label="商品标题" prop="title">
            <el-input v-model="form.title" maxlength="80" show-word-limit />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="商品描述" prop="description">
        <el-input v-model="form.description" type="textarea" :rows="4" maxlength="300" show-word-limit />
      </el-form-item>

      <el-form-item label="商品主图地址" prop="mainImage">
        <el-input v-model="form.mainImage" placeholder="https://..." />
      </el-form-item>

      <div class="section-header">
        <span>SKU列表</span>
        <el-button @click="addSku">新增 SKU</el-button>
      </div>

      <div v-for="(sku, index) in form.skus" :key="index" class="sku-row">
        <div class="sku-title">
          <span>SKU {{ index + 1 }}</span>
          <el-button link type="danger" :disabled="form.skus.length <= 1" @click="removeSku(index)">删除</el-button>
        </div>
        <el-row :gutter="16">
          <el-col :xs="24" :sm="6">
            <el-form-item
              label="规格名"
              :prop="getSkuField(index, 'specName')"
              :rules="skuSpecNameRules"
            >
              <el-input v-model="sku.specName" placeholder="color / size" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="6">
            <el-form-item
              label="规格值"
              :prop="getSkuField(index, 'specValue')"
              :rules="skuSpecValueRules"
            >
              <el-input v-model="sku.specValue" placeholder="黑色 / XL" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="6">
            <el-form-item label="价格" :prop="getSkuField(index, 'price')" :rules="skuPriceRules">
              <el-input-number v-model="sku.price" :min="0" :precision="2" controls-position="right" class="full-width" />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :sm="6">
            <el-form-item
              label="可用库存"
              :prop="getSkuField(index, 'available')"
              :rules="skuAvailableRules"
            >
              <el-input-number v-model="sku.available" :min="0" :precision="0" controls-position="right" class="full-width" />
            </el-form-item>
          </el-col>
        </el-row>
      </div>

      <div class="actions">
        <el-button @click="router.push({ name: 'products' })">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitProduct">创建商品</el-button>
      </div>
    </el-form>
  </el-card>
</template>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.title {
  color: #333;
  font-weight: 600;
  line-height: 24px;
}
.description {
  margin-top: 4px;
  color: #999;
  font-size: 13px;
}
.product-form { max-width: 960px; }
.full-width { width: 100%; }
.section-header {
  margin: 8px 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #333;
  font-weight: 600;
}
.sku-row {
  margin-bottom: 16px;
  padding: 16px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  background: #fff;
}
.sku-title {
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #333;
  font-weight: 600;
}
.actions {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
