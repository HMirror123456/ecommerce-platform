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

function splitPrice(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return { integer: '-', decimal: '' };
  }
  const fixed = Number(value).toFixed(2);
  const [integer, decimal] = fixed.split('.');
  return { integer, decimal };
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
      <div>
        <h2 class="page-title">我的收藏</h2>
        <p class="page-sub">共 {{ list.length }} 件心仪商品</p>
      </div>
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
      <article
        v-for="item in filteredList"
        :key="item.favoriteId"
        class="favorite-card"
        :class="{ invalid: item.status !== 'ON_SHELF' }"
      >
        <div class="image-wrap" @click="goDetail(item)">
          <img
            v-if="item.mainImage"
            :src="item.mainImage"
            :alt="item.title"
            class="image"
            loading="lazy"
          />
          <div v-else class="image placeholder">暂无图片</div>
          <div v-if="item.status !== 'ON_SHELF'" class="invalid-mask">已失效</div>
        </div>
        <div class="body">
          <h3 class="title" @click="goDetail(item)">{{ item.title }}</h3>
          <p class="shop">{{ item.shopName || '—' }}</p>
          <p class="meta">收藏于 {{ formatTime(item.createdAt) }}</p>
          <div class="footer">
            <div class="price">
              <template v-if="item.minPrice != null">
                <span class="price-symbol">¥</span>
                <span class="price-integer">{{ splitPrice(item.minPrice).integer }}</span>
                <span class="price-decimal">.{{ splitPrice(item.minPrice).decimal }}</span>
                <span class="price-suffix">起</span>
              </template>
              <template v-else>-</template>
            </div>
            <div class="footer-actions">
              <el-button
                v-if="item.status === 'ON_SHELF'"
                type="primary"
                size="small"
                @click="goDetail(item)"
              >
                去购买
              </el-button>
              <el-button link type="danger" @click="onRemove(item)">取消</el-button>
            </div>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.page-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
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

.favorite-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

@media (max-width: 960px) {
  .favorite-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .favorite-grid {
    grid-template-columns: 1fr;
  }
}

.favorite-card {
  background: #fff;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  overflow: hidden;
  transition: box-shadow 0.2s, transform 0.2s;
}

.favorite-card:hover {
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.favorite-card.invalid {
  opacity: 0.92;
}

.image-wrap {
  position: relative;
  aspect-ratio: 1;
  background: #fafafa;
  cursor: pointer;
  overflow: hidden;
}

.image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.3s;
}

.favorite-card:hover .image {
  transform: scale(1.04);
}

.image.placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: var(--text-muted);
}

.invalid-mask {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.body {
  padding: 12px 14px 14px;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.title {
  margin: 0 0 6px;
  font-size: 14px;
  font-weight: 600;
  line-height: 1.45;
  cursor: pointer;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.title:hover {
  color: var(--color-primary);
}

.shop {
  margin: 0 0 4px;
  font-size: 12px;
  color: var(--text-body);
}

.meta {
  margin: 0 0 12px;
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
  font-weight: 700;
  display: flex;
  align-items: baseline;
}

.price-symbol {
  font-size: 13px;
  margin-right: 1px;
}

.price-integer {
  font-size: 20px;
  line-height: 1;
}

.price-decimal {
  font-size: 13px;
}

.price-suffix {
  margin-left: 2px;
  font-size: 12px;
  font-weight: 400;
  color: var(--text-muted);
}

.footer-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
