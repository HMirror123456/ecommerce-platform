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
      <h2 class="page-title">收货地址</h2>
      <el-button type="primary" @click="openCreate">新增地址</el-button>
    </div>

    <el-empty v-if="!loading && list.length === 0" description="暂无收货地址" />

    <div v-else class="address-list">
      <el-card v-for="row in list" :key="row.id" shadow="never" class="address-card">
        <div class="address-top">
          <div>
            <span class="name">{{ row.receiverName }}</span>
            <span class="phone">{{ row.phone }}</span>
            <el-tag v-if="row.isDefault" size="small" type="success">默认</el-tag>
          </div>
          <div class="actions">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="onDelete(row)">删除</el-button>
            <el-button v-if="!row.isDefault" link @click="onSetDefault(row)">设为默认</el-button>
          </div>
        </div>
        <p class="detail">{{ fullAddress(row) }}</p>
      </el-card>
    </div>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑地址' : '新增地址'" width="480px">
      <el-form label-position="top">
        <el-form-item label="收件人" required>
          <el-input v-model="form.receiverName" />
        </el-form-item>
        <el-form-item label="手机号" required>
          <el-input v-model="form.phone" />
        </el-form-item>
        <el-form-item label="省" required>
          <el-input v-model="form.province" />
        </el-form-item>
        <el-form-item label="市" required>
          <el-input v-model="form.city" />
        </el-form-item>
        <el-form-item label="区/县" required>
          <el-input v-model="form.district" />
        </el-form-item>
        <el-form-item label="详细地址" required>
          <el-input v-model="form.detail" type="textarea" :rows="2" />
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
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}
.page-title { margin: 0; font-size: 20px; }
.address-list { display: flex; flex-direction: column; gap: 12px; }
.address-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.name { font-weight: 600; margin-right: 12px; }
.phone { color: var(--text-body); margin-right: 8px; }
.detail { margin: 8px 0 0; color: var(--text-body); }
.actions { display: flex; gap: 4px; flex-shrink: 0; }
</style>
