<script setup>
import { computed, onMounted, ref } from 'vue';
import { ElMessage } from 'element-plus';
import { useRoute, useRouter } from 'vue-router';
import {
  createMerchantProduct,
  fetchCategories,
  fetchMerchantProduct,
  updateMerchantProduct,
} from '@/api/merchant';

const router = useRouter();
const route = useRoute();
const isEdit = computed(() => route.name === 'product-edit');
const spuId = computed(() => Number(route.params.spuId));
const formRef = ref(null);
const submitting = ref(false);
const detailLoading = ref(false);
const categoryLoading = ref(false);
const categories = ref([]);
const categoryProps = {
  value: 'id',
  label: 'name',
  children: 'children',
  emitPath: false,
};

function createSku() {
  return {
    skuId: null,
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
        if (value == null || value === '' || Array.isArray(value)) {
          callback(new Error('请选择商品分类'));
          return;
        }
        if (!Number.isInteger(Number(value))) {
          callback(new Error('请选择有效的商品分类'));
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

async function loadCategories() {
  categoryLoading.value = true;
  try {
    const data = await fetchCategories();
    categories.value = Array.isArray(data) ? data : [];
  } catch (e) {
    ElMessage.error(e.message || '加载商品分类失败');
    categories.value = [];
  } finally {
    categoryLoading.value = false;
  }
}

function getFirstSpecEntry(specJson) {
  const entries = Object.entries(specJson || {});
  return entries[0] || ['', ''];
}

async function loadProductDetail() {
  if (!isEdit.value || !Number.isInteger(spuId.value)) return;
  detailLoading.value = true;
  try {
    const data = await fetchMerchantProduct(spuId.value);
    form.value.categoryId = data.categoryId;
    form.value.title = data.title || '';
    form.value.description = data.description || '';
    form.value.mainImage = data.mainImage || '';
    form.value.skus = (Array.isArray(data.skus) ? data.skus : []).map((sku) => {
      const [specName, specValue] = getFirstSpecEntry(sku.specJson);
      return {
        skuId: sku.skuId,
        specName,
        specValue,
        price: sku.price,
        available: sku.stock?.available ?? 0,
      };
    });
    if (!form.value.skus.length) form.value.skus = [createSku()];
  } catch (e) {
    ElMessage.error(e.message || '加载商品详情失败');
    router.push({ name: 'products' });
  } finally {
    detailLoading.value = false;
  }
}

function addSku() {
  if (isEdit.value) return;
  form.value.skus.push(createSku());
}

function removeSku(index) {
  if (isEdit.value) return;
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
    skus: form.value.skus.map((sku) => {
      const item = {
        specJson: {
          [sku.specName.trim()]: sku.specValue.trim(),
        },
        price: Number(sku.price),
      };
      if (isEdit.value) {
        item.skuId = Number(sku.skuId);
      } else {
        item.stock = {
          available: Number(sku.available),
        };
      }
      return item;
    }),
  };
}

async function submitProduct() {
  const hasSku = form.value.skus.some((sku) =>
    String(sku.specName || '').trim()
    || String(sku.specValue || '').trim()
    || sku.price != null
    || sku.available != null
  );
  if (!hasSku) {
    ElMessage.warning('请至少填写一个 SKU');
    return;
  }

  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  submitting.value = true;
  try {
    if (isEdit.value) {
      await updateMerchantProduct(spuId.value, buildPayload());
      ElMessage.success('商品保存成功');
    } else {
      await createMerchantProduct(buildPayload());
      ElMessage.success('商品创建成功');
    }
    router.push({ name: 'products' });
  } catch (e) {
    ElMessage.error(e.message || (isEdit.value ? '商品保存失败' : '商品创建失败'));
  } finally {
    submitting.value = false;
  }
}

onMounted(async () => {
  await loadCategories();
  await loadProductDetail();
});
</script>

<template>
  <el-card shadow="never">
    <template #header>
      <div class="card-header">
        <div>
          <div class="title">{{ isEdit ? '编辑商品' : '发布商品' }}</div>
          <div class="description">
            {{ isEdit ? '维护 SPU 基础信息与 SKU 价格、规格' : '填写 SPU 基础信息，并维护至少一个 SKU 与库存' }}
          </div>
        </div>
        <el-button @click="router.push({ name: 'products' })">返回列表</el-button>
      </div>
    </template>

    <el-form
      ref="formRef"
      v-loading="detailLoading"
      :model="form"
      :rules="rules"
      label-position="top"
      class="product-form"
    >
      <el-row :gutter="16">
        <el-col :xs="24" :sm="12">
          <el-form-item label="商品分类" prop="categoryId">
            <el-cascader
              v-model="form.categoryId"
              :options="categories"
              :props="categoryProps"
              :disabled="categoryLoading"
              clearable
              filterable
              :placeholder="categoryLoading ? '正在加载商品分类' : '请选择商品分类'"
              class="full-width"
            />
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
        <el-button v-if="!isEdit" @click="addSku">新增 SKU</el-button>
      </div>

      <div v-for="(sku, index) in form.skus" :key="index" class="sku-row">
        <div class="sku-title">
          <span>SKU {{ index + 1 }}</span>
          <el-button
            v-if="!isEdit"
            link
            type="danger"
            :disabled="form.skus.length <= 1"
            @click="removeSku(index)"
          >
            删除
          </el-button>
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
              :rules="isEdit ? [] : skuAvailableRules"
            >
              <el-input-number
                v-model="sku.available"
                :min="0"
                :precision="0"
                :disabled="isEdit"
                controls-position="right"
                class="full-width"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </div>

      <div class="actions">
        <el-button @click="router.push({ name: 'products' })">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitProduct">
          {{ isEdit ? '保存商品' : '创建商品' }}
        </el-button>
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
