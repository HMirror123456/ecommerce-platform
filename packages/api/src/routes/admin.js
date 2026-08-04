import { Router } from 'express';
import { auditProduct, getPendingProducts, getSpuById } from '../data/store.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();

router.get('/products/pending', requireAdmin(['OPERATOR']), (req, res) => {
  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 20;
  res.json(getPendingProducts(page, pageSize));
});

router.get('/products/:spuId', requireAdmin(['OPERATOR']), (req, res) => {
  const spu = getSpuById(Number(req.params.spuId));
  if (!spu) return res.status(404).json({ message: '商品不存在' });
  res.json(spu);
});

router.post('/products/:spuId/audit', requireAdmin(['OPERATOR']), (req, res) => {
  const spuId = Number(req.params.spuId);
  const { approved, reason } = req.body || {};
  if (typeof approved !== 'boolean') return res.status(400).json({ message: 'approved 必填' });
  const result = auditProduct(spuId, req.admin.id, approved, reason);
  if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
  if (result.error === 'INVALID_STATE') return res.status(409).json({ message: result.message });
  if (result.error === 'REASON_REQUIRED') return res.status(400).json({ message: result.message });
  res.json({ spuId: result.spu.spuId, status: result.spu.status, message: approved ? '审核通过' : '已驳回' });
});

export default router;
