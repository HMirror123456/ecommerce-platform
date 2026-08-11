<script setup>
import { computed, onMounted, ref } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { createAdmin, deleteAdmin, fetchAdmins, updateAdmin } from '@/api/admin';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();

const loading = ref(false);
const list = ref([]);
const allForStats = ref([]);

const keyword = ref('');
const filterRole = ref('');
const filterStatus = ref('');

const createVisible = ref(false);
const createLoading = ref(false);
const createForm = ref({ username: '', password: '', role: 'OPERATOR' });

const editVisible = ref(false);
const editLoading = ref(false);
const editTarget = ref(null);
const editRoleLocked = ref(false);
const editForm = ref({ role: 'OPERATOR', status: 'ACTIVE', password: '' });

const roleMeta = {
  SUPER_ADMIN: { label: '超级管理员', type: 'danger' },
  OPERATOR: { label: '运营管理员', type: 'warning' },
  CS_AGENT: { label: '客服管理员', type: 'info' },
};

const stats = computed(() => {
  const all = allForStats.value;
  return {
    total: all.length,
    active: all.filter((a) => a.status === 'ACTIVE').length,
    disabled: all.filter((a) => a.status === 'DISABLED').length,
  };
});

const editUsername = computed(() => (editTarget.value ? editTarget.value.username : ''));
const editIsSuperAdmin = computed(() => !!(editTarget.value && editTarget.value.role === 'SUPER_ADMIN'));

function roleLabel(row) {
  const meta = roleMeta[row && row.role];
  return (meta && meta.label) || (row && row.role) || '-';
}

function roleTagType(row) {
  const meta = roleMeta[row && row.role];
  return (meta && meta.type) || 'info';
}

function formatTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN');
}

function canDelete(row) {
  return row.role !== 'SUPER_ADMIN' && row.id !== auth.adminId;
}

async function loadStats() {
  try {
    const data = await fetchAdmins();
    allForStats.value = data.list || [];
  } catch (e) {
    allForStats.value = [];
  }
}

async function loadList() {
  loading.value = true;
  try {
    const params = {};
    if (keyword.value.trim()) params.keyword = keyword.value.trim();
    if (filterRole.value) params.role = filterRole.value;
    if (filterStatus.value) params.status = filterStatus.value;
    const data = await fetchAdmins(params);
    list.value = data.list || [];
  } catch (e) {
    ElMessage.error(e.message || '加载失败');
  } finally {
    loading.value = false;
  }
}

async function refreshAll() {
  await Promise.all([loadStats(), loadList()]);
}

function openCreate() {
  createForm.value = { username: '', password: '', role: 'OPERATOR' };
  createVisible.value = true;
}

async function submitCreate() {
  const username = createForm.value.username;
  const password = createForm.value.password;
  const role = createForm.value.role;
  const name = username ? username.trim() : '';
  if (!name || !password || !role) {
    ElMessage.warning('请填写完整信息');
    return;
  }
  createLoading.value = true;
  try {
    await createAdmin({ username: name, password, role });
    ElMessage.success('创建成功');
    createVisible.value = false;
    await refreshAll();
  } catch (e) {
    ElMessage.error(e.message || '创建失败');
  } finally {
    createLoading.value = false;
  }
}

function openEdit(row) {
  editTarget.value = row;
  editRoleLocked.value = row.role === 'SUPER_ADMIN';
  editForm.value = {
    role: row.role,
    status: row.status,
    password: '',
  };
  editVisible.value = true;
}

async function submitEdit() {
  const row = editTarget.value;
  if (!row) return;
  const payload = {};
  if (!editRoleLocked.value && editForm.value.role !== row.role) {
    payload.role = editForm.value.role;
  }
  if (editForm.value.status !== row.status) {
    payload.status = editForm.value.status;
  }
  if (editForm.value.password) {
    payload.password = editForm.value.password;
  }
  if (!Object.keys(payload).length) {
    ElMessage.warning('未修改任何内容');
    return;
  }
  editLoading.value = true;
  try {
    await updateAdmin(row.id, payload);
    ElMessage.success('已保存');
    editVisible.value = false;
    await refreshAll();
  } catch (e) {
    ElMessage.error(e.message || '保存失败');
  } finally {
    editLoading.value = false;
  }
}

async function toggleStatus(row) {
  const next = row.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
  const action = next === 'DISABLED' ? '禁用' : '启用';
  try {
    await ElMessageBox.confirm('确认' + action + '账号「' + row.username + '」？', action, { type: 'warning' });
    await updateAdmin(row.id, { status: next });
    ElMessage.success('已' + action);
    await refreshAll();
  } catch (e) {
    if (e !== 'cancel' && e && e.message) ElMessage.error(e.message);
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(
      '确认删除账号「' + row.username + '」？删除后不可恢复。',
      '删除账号',
      { type: 'error', confirmButtonText: '删除', confirmButtonClass: 'el-button--danger' },
    );
    await deleteAdmin(row.id);
    ElMessage.success('已删除');
    await refreshAll();
  } catch (e) {
    if (e !== 'cancel' && e && e.message) ElMessage.error(e.message);
  }
}

onMounted(refreshAll);
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2 class="title">管理员账号</h2>
        <p class="desc">管理运营与客服账号：支持创建、编辑角色/状态、重置密码与删除。超级管理员不可删除。</p>
      </div>
      <el-button type="primary" @click="openCreate">新建账号</el-button>
    </div>

    <div class="stat-row">
      <div class="stat-card">
        <div class="stat-label">全部账号</div>
        <div class="stat-value">{{ stats.total }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">启用中</div>
        <div class="stat-value success">{{ stats.active }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">已禁用</div>
        <div class="stat-value muted">{{ stats.disabled }}</div>
      </div>
    </div>

    <el-card shadow="never" class="panel">
      <div class="toolbar">
        <div class="filters">
          <el-input
            v-model="keyword"
            clearable
            placeholder="搜索用户名"
            style="width: 200px"
            @keyup.enter="loadList"
            @clear="loadList"
          />
          <el-select v-model="filterRole" clearable placeholder="角色" style="width: 140px" @change="loadList">
            <el-option label="超级管理员" value="SUPER_ADMIN" />
            <el-option label="运营管理员" value="OPERATOR" />
            <el-option label="客服管理员" value="CS_AGENT" />
          </el-select>
          <el-select v-model="filterStatus" clearable placeholder="状态" style="width: 120px" @change="loadList">
            <el-option label="启用" value="ACTIVE" />
            <el-option label="禁用" value="DISABLED" />
          </el-select>
          <el-button @click="loadList">查询</el-button>
          <el-button @click="refreshAll">刷新</el-button>
        </div>
      </div>

      <el-table v-loading="loading" :data="list" stripe>
        <template #empty>
          <el-empty description="暂无符合条件的管理员账号" :image-size="80" />
        </template>
        <el-table-column prop="id" label="ID" width="72" />
        <el-table-column label="用户名" min-width="160">
          <template #default="{ row }">
            <span class="username">{{ row.username }}</span>
            <el-tag v-if="row.id === auth.adminId" size="small" type="success" effect="plain" class="me-tag">当前登录</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="角色" width="140">
          <template #default="{ row }">
            <el-tag :type="roleTagType(row)" size="small" effect="light">
              {{ roleLabel(row) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.status === 'ACTIVE' ? 'success' : 'info'" size="small">
              {{ row.status === 'ACTIVE' ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" min-width="170">
          <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="220" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button
              link
              type="primary"
              :disabled="row.id === auth.adminId && row.status === 'ACTIVE'"
              @click="toggleStatus(row)"
            >
              {{ row.status === 'ACTIVE' ? '禁用' : '启用' }}
            </el-button>
            <el-button v-if="canDelete(row)" link type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="createVisible" title="新建账号" width="440px" destroy-on-close>
      <el-form label-width="88px" @submit.prevent>
        <el-form-item label="用户名" required>
          <el-input v-model="createForm.username" placeholder="唯一用户名" maxlength="64" />
        </el-form-item>
        <el-form-item label="密码" required>
          <el-input v-model="createForm.password" type="password" show-password placeholder="初始密码" />
        </el-form-item>
        <el-form-item label="角色" required>
          <el-select v-model="createForm.role" style="width: 100%">
            <el-option label="运营管理员" value="OPERATOR" />
            <el-option label="客服管理员" value="CS_AGENT" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="createLoading" @click="submitCreate">创建</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="editVisible" title="编辑账号" width="440px" destroy-on-close>
      <p class="edit-user">账号：<strong>{{ editUsername }}</strong>（用户名不可修改）</p>
      <el-form label-width="88px" @submit.prevent>
        <el-form-item label="角色">
          <el-select v-model="editForm.role" style="width: 100%" :disabled="editRoleLocked">
            <el-option v-if="editIsSuperAdmin" label="超级管理员" value="SUPER_ADMIN" />
            <el-option label="运营管理员" value="OPERATOR" />
            <el-option label="客服管理员" value="CS_AGENT" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="editForm.status">
            <el-radio label="ACTIVE">启用</el-radio>
            <el-radio label="DISABLED">禁用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="新密码">
          <el-input
            v-model="editForm.password"
            type="password"
            show-password
            placeholder="留空则不修改密码"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="editLoading" @click="submitEdit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page { max-width: 1100px; }
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 16px;
}
.title {
  margin: 0 0 6px;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}
.desc {
  margin: 0;
  font-size: 13px;
  color: #999;
  line-height: 1.5;
  max-width: 640px;
}
.stat-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.stat-card {
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  padding: 16px 20px;
}
.stat-label {
  font-size: 13px;
  color: #999;
  margin-bottom: 8px;
}
.stat-value {
  font-size: 28px;
  font-weight: 600;
  color: #333;
  line-height: 1;
}
.stat-value.success { color: #52c41a; }
.stat-value.muted { color: #999; }
.panel {
  border: 1px solid #e8e8e8;
  border-radius: 8px;
}
.toolbar {
  margin-bottom: 16px;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.username { margin-right: 8px; }
.me-tag { vertical-align: middle; }
.edit-user {
  margin: 0 0 16px;
  color: #666;
  font-size: 13px;
}
@media (max-width: 768px) {
  .stat-row { grid-template-columns: 1fr; }
  .page-header { flex-direction: column; }
}
</style>
