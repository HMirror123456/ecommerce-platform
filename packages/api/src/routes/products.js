import { Router } from 'express';
import { getPublicProductDetail, getPublicProducts } from '../data/store.js';

const router = Router();

router.get('/', (req, res) => {
  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 20;
  const { categoryId } = req.query;
  res.json(getPublicProducts(page, pageSize, categoryId));
});

router.get('/:spuId', (req, res) => {
  const product = getPublicProductDetail(Number(req.params.spuId));
  if (!product) return res.status(404).json({ message: '商品不存在或未上架' });
  res.json(product);
});

export default router;
