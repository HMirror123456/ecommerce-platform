<script setup>
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import ProductSearchBar from '@/components/ProductSearchBar.vue';
import { fetchFavorites, removeFavorite } from '@/api/favorite';

const router = useRouter();
const loading = ref(false);
const list = ref([]);
const searchKeyword = ref('');
const appliedKeyword = ref('');

const filteredList = computed(() => {
  const kw = appliedKeyword.value.trim().toLowerCase();
  if (!kw) return list.value;
  return list.value.filter((item) => {
    const title = String(item.title || '').toLowerCase();
    const shop = String(item.shopName || '').toLowerCase();
    return title.includes(kw) || shop.includes(kw);
  });
});

function formatPrice(value) {
  if (value == null || Number.isNaN(Number(value))) return '-';
  return `¥${Number(value).toFixed(2)}`;
}

function formatTime(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('zh-CN');
}

async function loadList() {
  loading.value = true;
  try {
    list.value = await fetchFavorites();
  } catch (e) {
    ElMessage.error(e.message || '加载收藏失败');
    list.value = [];
  } finally {
    loading.value = false;
  }
}

function goDetail(item) {
  if (item.status !== 'ON_SHELF') {
    ElMessage.warning('该商品暂不可购买');
    return;
  }
  router.push({ name: 'product-detail', params: { spuId: item.spuId } });
}

async function onRemove(item) {
  try {
    await ElMessageBox.confirm(`确认取消收藏「${item.title}」？`, '提示', { type: 'warning' });
    await removeFavorite(item.spuId);
    ElMessage.success('已取消收藏');
    await loadList();
  } catch (e) {
    if (e !== 'cancel') ElMessage.error(e.message || '操作失败');
  }
}

function onSearch(keyword) {
  const next = String(keyword || '').trim();
  searchKeyword.value = next;
  appliedKeyword.value = next;
}

onMounted(loadList);
</script>

<template>
  <div class="favorite-page" v-loading="loading">
    <div class="page-header">
      <h2 class="page-title">我的收藏</h2>
      <ProductSearchBar
        v-model="searchKeyword"
        placeholder="在收藏中搜索商品"
        @search="onSearch"
      />
    </div>

    <el-empty v-if="!loading && list.length === 0" description="还没有收藏商品">
      <el-button type="primary" @click="router.push({ name: 'products' })">去逛逛</el-button>
    </el-empty>

    <el-empty
      v-else-if="!loading && filteredList.length === 0"
      :description="`没有找到匹配「${appliedKeyword}」的收藏`"
    >
      <el-button @click="onSearch('')">清空搜索</el-button>
    </el-empty>

    <div v-else class="favorite-grid">
      <article v-for="item in filteredList" :key="item.favoriteId" class="favorite-card">
        <div class="image-wrap" @click="goDetail(item)">
          <img
            v-if="item.mainImage"
            :src="item.mainImage"
            :alt="item.title"
            class="image"
            loading="lazy"
          />
          <div v-else class="image placeholder">暂无图片</div>
          <span v-if="item.status !== 'ON_SHELF'" class="badge">已失效</span>
        </div>
        <div class="body">
          <h3 class="title" @click="goDetail(item)">{{ item.title }}</h3>
          <p class="meta">{{ item.shopName || '—' }} · 收藏于 {{ formatTime(item.createdAt) }}</p>
          <div class="footer">
            <span class="price">{{ formatPrice(item.minPrice) }}<small v-if="item.minPrice != null">起</small></span>
            <el-button link type="danger" @click="onRemove(item)">取消收藏</el-button>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.page-title { margin: 0; font-size: 20px; }
.favorite-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}
@media (max-width: 768px) {
  .favorite-grid { grid-template-columns: 1fr; }
}
.favorite-card {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 12px;
  background: #fff;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
}
.image-wrap {
  position: relative;
  width: 120px;
  height: 120px;
  background: #fafafa;
  cursor: pointer;
}
.image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.image.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--text-muted);
}
.badge {
  position: absolute;
  left: 0;
  top: 0;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 12px;
  padding: 2px 8px;
}
.body {
  padding: 12px 12px 12px 0;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.title:hover { color: var(--color-primary); }
.meta {
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
}
.footer {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.price {
  color: var(--color-primary);
  font-size: 18px;
  font-weight: 700;
}
.price small {
  margin-left: 2px;
  font-size: 12px;
  font-weight: 400;
  color: var(--text-muted);
}
</style>
