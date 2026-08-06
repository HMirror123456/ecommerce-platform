import { Router } from 'express';
import {
  auditProduct,
  getAdminOrderById,
  getAdminOrders,
  getAdminProductDetail,
  getDashboardSummary,
  getEscalatedAfterSales,
  getPendingMerchants,
  getPendingProducts,
} from '../data/store.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();
const adminRoles = ['OPERATOR', 'CS_AGENT'];

router.get('/dashboard/summary', requireAdmin(adminRoles), (_req, res) => {
  res.json(getDashboardSummary());
});

router.get('/products/pending', requireAdmin(['OPERATOR']), (req, res) => {
  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 20;
  res.json(getPendingProducts(page, pageSize));
});

router.get('/products/:spuId', requireAdmin(['OPERATOR']), (req, res) => {
  const product = getAdminProductDetail(Number(req.params.spuId));
  if (!product) return res.status(404).json({ message: '商品不存在' });
  res.json(product);
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

router.get('/orders', requireAdmin(adminRoles), (req, res) => {
  const { orderNo, userId, merchantId, status } = req.query;
  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 20;
  res.json(getAdminOrders({ orderNo, userId, merchantId, status, page, pageSize }));
});

router.get('/orders/:orderId', requireAdmin(adminRoles), (req, res) => {
  const order = getAdminOrderById(Number(req.params.orderId));
  if (!order) return res.status(404).json({ message: '订单不存在' });
  res.json(order);
});

router.get('/after-sales', requireAdmin(['CS_AGENT']), (req, res) => {
  const page = Number(req.query.page) || 1;
  const pageSize = Number(req.query.pageSize) || 20;
  res.json(getEscalatedAfterSales(page, pageSize));
});

router.get('/merchants/pending', requireAdmin(['OPERATOR']), (_req, res) => {
  res.json(getPendingMerchants());
});

export default router;
