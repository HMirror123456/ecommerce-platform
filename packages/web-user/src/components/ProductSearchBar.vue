<script setup>
import { ref, watch } from 'vue';
import { Search } from '@element-plus/icons-vue';

const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '搜索商品' },
});

const emit = defineEmits(['update:modelValue', 'search']);

const keyword = ref(props.modelValue);

watch(
  () => props.modelValue,
  (val) => {
    if (val !== keyword.value) keyword.value = val;
  },
);

function sync(value) {
  keyword.value = value;
  emit('update:modelValue', value);
}

function onSearch() {
  const trimmed = String(keyword.value || '').trim();
  sync(trimmed);
  emit('search', trimmed);
}

function onClear() {
  sync('');
  emit('search', '');
}
</script>

<template>
  <div class="product-search-bar">
    <el-input
      :model-value="keyword"
      :placeholder="placeholder"
      clearable
      class="search-input"
      @update:model-value="sync"
      @keyup.enter="onSearch"
      @clear="onClear"
    >
      <template #append>
        <el-button :icon="Search" @click="onSearch" />
      </template>
    </el-input>
  </div>
</template>

<style scoped>
.product-search-bar {
  width: 100%;
  max-width: 420px;
}
.search-input :deep(.el-input-group__append) {
  background: var(--color-primary);
  color: #fff;
  border-color: var(--color-primary);
  box-shadow: none;
}
.search-input :deep(.el-input-group__append .el-button) {
  color: #fff;
}
</style>
