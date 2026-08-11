import { Router } from 'express';
import {
  auditMerchantApplication,
  auditProduct,
  arbitrateAfterSale,
  getAdminOrderById,
  getAdminOrders,
  getAdminProductDetail,
  getDashboardSummary,
  getAdminAfterSales,
  getMerchantApplications,
  getPendingMerchants,
  getPendingProducts,
  getProductAuditHistory,
} from '../data/store.js';
import { requireAdmin } from '../middleware/auth.js';

const router = Router();
const adminRoles = ['OPERATOR', 'CS_AGENT'];

router.get('/dashboard/summary', requireAdmin(adminRoles), async (_req, res, next) => {
  try {
    res.json(await getDashboardSummary());
  } catch (err) {
    next(err);
  }
});

router.get('/products/pending', requireAdmin(['OPERATOR']), async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;
    res.json(await getPendingProducts(page, pageSize));
  } catch (err) {
    next(err);
  }
});

router.get('/products/audits', requireAdmin(['OPERATOR']), async (req, res, next) => {
  try {
    const { approved } = req.query;
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;
    let approvedFilter;
    if (approved === 'true') approvedFilter = true;
    else if (approved === 'false') approvedFilter = false;
    res.json(await getProductAuditHistory({ approved: approvedFilter, page, pageSize }));
  } catch (err) {
    next(err);
  }
});

router.get('/products/:spuId', requireAdmin(['OPERATOR']), async (req, res, next) => {
  try {
  const product = await getAdminProductDetail(Number(req.params.spuId));
  if (!product) return res.status(404).json({ message: '商品不存在' });
  res.json(product);
  } catch (err) {
    next(err);
  }
});

router.post('/products/:spuId/audit', requireAdmin(['OPERATOR']), async (req, res, next) => {
  try {
    const spuId = Number(req.params.spuId);
    const { approved, reason } = req.body || {};
    if (typeof approved !== 'boolean') return res.status(400).json({ message: 'approved 必填' });
    const result = await auditProduct(spuId, req.admin.id, approved, reason);
    if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
    if (result.error === 'INVALID_STATE') return res.status(409).json({ message: result.message });
    if (result.error === 'REASON_REQUIRED') return res.status(400).json({ message: result.message });
    res.json({ spuId: result.spu.spuId, status: result.spu.status, message: approved ? '审核通过' : '已驳回' });
  } catch (err) {
    next(err);
  }
});

router.get('/orders', requireAdmin(adminRoles), async (req, res, next) => {
  try {
    const { orderNo, userId, merchantId, status } = req.query;
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;
    res.json(await getAdminOrders({ orderNo, userId, merchantId, status, page, pageSize }));
  } catch (err) {
    next(err);
  }
});

router.get('/orders/:orderId', requireAdmin(adminRoles), async (req, res, next) => {
  try {
    const order = await getAdminOrderById(Number(req.params.orderId));
    if (!order) return res.status(404).json({ message: '订单不存在' });
    res.json(order);
  } catch (err) {
    next(err);
  }
});

router.get('/after-sales', requireAdmin(['CS_AGENT']), async (req, res, next) => {
  try {
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;
    const status = req.query.status || 'ESCALATED';
    res.json(await getAdminAfterSales({ status, page, pageSize }));
  } catch (err) {
    next(err);
  }
});

router.post('/after-sales/:afterSaleId/arbitrate', requireAdmin(['CS_AGENT']), async (req, res, next) => {
  try {
    const afterSaleId = Number(req.params.afterSaleId);
    const { approved, reason } = req.body || {};
    if (typeof approved !== 'boolean') return res.status(400).json({ message: 'approved 必填' });
    const result = await arbitrateAfterSale(afterSaleId, { approved, reason });
    if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
    if (result.error === 'INVALID_STATE') return res.status(409).json({ message: result.message });
    if (result.error === 'REASON_REQUIRED' || result.error === 'INVALID_INPUT') {
      return res.status(400).json({ message: result.message });
    }
    if (result.error) return res.status(400).json({ message: result.message });
    res.json(result.afterSale);
  } catch (err) {
    next(err);
  }
});

router.get('/merchants/pending', requireAdmin(['OPERATOR']), async (_req, res, next) => {
  try {
    res.json(await getPendingMerchants());
  } catch (err) {
    next(err);
  }
});

router.get('/merchants/applications', requireAdmin(['OPERATOR']), async (req, res, next) => {
  try {
    const status = req.query.status || undefined;
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 20;
    res.json(await getMerchantApplications({ status, page, pageSize }));
  } catch (err) {
    next(err);
  }
});

router.post('/merchants/:merchantId/audit', requireAdmin(['OPERATOR']), async (req, res, next) => {
  try {
    const applicationId = Number(req.params.merchantId);
    const { approved, reason } = req.body || {};
    if (typeof approved !== 'boolean') return res.status(400).json({ message: 'approved 必填' });
    const result = await auditMerchantApplication(applicationId, req.admin.id, approved, reason);
    if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
    if (result.error === 'REASON_REQUIRED') return res.status(400).json({ message: result.message });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
