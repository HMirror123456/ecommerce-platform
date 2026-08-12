<script setup>
import { onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  createAddress,
  deleteAddress,
  fetchAddresses,
  setDefaultAddress,
  updateAddress,
} from '@/api/address';

const loading = ref(false);
const saving = ref(false);
const list = ref([]);
const dialogVisible = ref(false);
const editingId = ref(null);
const form = ref(emptyForm());

function emptyForm() {
  return {
    receiverName: '',
    phone: '',
    province: '',
    city: '',
    district: '',
    detail: '',
    isDefault: false,
  };
}

function fullAddress(row) {
  return `${row.province}${row.city}${row.district}${row.detail}`;
}

async function loadList() {
  loading.value = true;
  try {
    list.value = await fetchAddresses();
  } catch (e) {
    ElMessage.error(e.message || '加载地址失败');
    list.value = [];
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingId.value = null;
  form.value = emptyForm();
  dialogVisible.value = true;
}

function openEdit(row) {
  editingId.value = row.id;
  form.value = {
    receiverName: row.receiverName,
    phone: row.phone,
    province: row.province,
    city: row.city,
    district: row.district,
    detail: row.detail,
    isDefault: row.isDefault,
  };
  dialogVisible.value = true;
}

async function onSubmit() {
  if (!form.value.receiverName?.trim() || !form.value.phone?.trim()) {
    ElMessage.warning('请填写收件人和电话');
    return;
  }
  saving.value = true;
  try {
    if (editingId.value) {
      await updateAddress(editingId.value, form.value);
      ElMessage.success('地址已更新');
    } else {
      await createAddress(form.value);
      ElMessage.success('地址已添加');
    }
    dialogVisible.value = false;
    await loadList();
  } catch (e) {
    ElMessage.error(e.message || '保存失败');
  } finally {
    saving.value = false;
  }
}

async function onDelete(row) {
  try {
    await ElMessageBox.confirm('确认删除该地址？', '提示', { type: 'warning' });
    await deleteAddress(row.id);
    ElMessage.success('已删除');
    await loadList();
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e.message || '删除失败');
  }
}

async function onSetDefault(row) {
  if (row.isDefault) return;
  try {
    await setDefaultAddress(row.id);
    ElMessage.success('已设为默认地址');
    await loadList();
  } catch (e) {
    ElMessage.error(e.message || '操作失败');
  }
}

onMounted(loadList);
</script>

<template>
  <div class="address-page" v-loading="loading">
    <div class="page-header">
      <div>
        <h2 class="page-title">收货地址</h2>
        <p class="page-sub">管理下单时使用的收货信息</p>
      </div>
      <el-button type="primary" @click="openCreate">新增地址</el-button>
    </div>

    <el-empty v-if="!loading && list.length === 0" description="暂无收货地址">
      <el-button type="primary" @click="openCreate">添加第一个地址</el-button>
    </el-empty>

    <div v-else class="address-grid">
      <article
        v-for="row in list"
        :key="row.id"
        class="address-card"
        :class="{ default: row.isDefault }"
      >
        <span v-if="row.isDefault" class="default-ribbon">默认</span>
        <div class="address-top">
          <p class="name-line">
            <span class="name">{{ row.receiverName }}</span>
            <span class="phone">{{ row.phone }}</span>
          </p>
        </div>
        <p class="detail">{{ fullAddress(row) }}</p>
        <div class="actions">
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" @click="onDelete(row)">删除</el-button>
          <el-button v-if="!row.isDefault" link type="primary" @click="onSetDefault(row)">
            设为默认
          </el-button>
        </div>
      </article>
    </div>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑地址' : '新增地址'" width="480px">
      <el-form label-position="top">
        <el-form-item label="收件人" required>
          <el-input v-model="form.receiverName" placeholder="请输入收件人姓名" />
        </el-form-item>
        <el-form-item label="手机号" required>
          <el-input v-model="form.phone" placeholder="请输入手机号" />
        </el-form-item>
        <div class="region-row">
          <el-form-item label="省" required>
            <el-input v-model="form.province" />
          </el-form-item>
          <el-form-item label="市" required>
            <el-input v-model="form.city" />
          </el-form-item>
          <el-form-item label="区/县" required>
            <el-input v-model="form.district" />
          </el-form-item>
        </div>
        <el-form-item label="详细地址" required>
          <el-input v-model="form.detail" type="textarea" :rows="2" placeholder="街道门牌等" />
        </el-form-item>
        <el-form-item>
          <el-checkbox v-model="form.isDefault">设为默认地址</el-checkbox>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="onSubmit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.page-title {
  margin: 0 0 4px;
  font-size: 22px;
}

.page-sub {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
}

.address-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 720px) {
  .address-grid {
    grid-template-columns: 1fr;
  }
}

.address-card {
  position: relative;
  padding: 18px 16px 14px;
  background: #fff;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  overflow: hidden;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.address-card:hover {
  border-color: #ffb4b4;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.05);
}

.address-card.default {
  border-color: var(--color-primary);
  background: #fff8f8;
  box-shadow: 0 0 0 1px var(--color-primary);
}

.default-ribbon {
  position: absolute;
  top: 10px;
  right: -22px;
  width: 88px;
  padding: 2px 0;
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: var(--color-primary);
  transform: rotate(35deg);
  letter-spacing: 0.04em;
}

.address-top {
  margin-bottom: 8px;
  padding-right: 36px;
}

.name-line {
  margin: 0;
}

.name {
  font-weight: 700;
  margin-right: 10px;
  color: var(--text-title);
}

.phone {
  color: var(--text-body);
  font-size: 13px;
}

.detail {
  margin: 0 0 12px;
  color: var(--text-body);
  line-height: 1.6;
  font-size: 13px;
  min-height: 42px;
}

.actions {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  padding-top: 8px;
  border-top: 1px dashed var(--border-color);
}

.region-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
}

@media (max-width: 520px) {
  .region-row {
    grid-template-columns: 1fr;
  }
}
</style>
