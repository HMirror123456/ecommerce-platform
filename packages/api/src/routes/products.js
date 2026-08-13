import { Router } from 'express';
import { getPublicProductDetail, getPublicProducts } from '../data/store.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;
    const { categoryId, keyword, q } = req.query;
    res.json(await getPublicProducts(page, pageSize, categoryId, keyword || q));
  } catch (err) {
    next(err);
  }
});

router.get('/:spuId', async (req, res, next) => {
  try {
    const product = await getPublicProductDetail(Number(req.params.spuId));
    if (!product) return res.status(404).json({ message: '商品不存在或未上架' });
    return res.json(product);
  } catch (err) {
    next(err);
  }
});

export default router;
