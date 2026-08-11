import { Router } from 'express';
import {
  auditMerchantAfterSale,
  confirmAfterSaleReturn,
  createMerchantProduct,
  getMerchantAfterSales,
  getMerchantApplicationByPhone,
  getMerchantDashboardSummary,
  getMerchantProductDetail,
  getMerchantProducts,
  getSubOrdersByMerchant,
  offShelfMerchantProduct,
  shipSubOrder,
  submitMerchantApplication,
  submitMerchantProductAudit,
  updateMerchantProduct,
} from '../data/store.js';
import { requireMerchant } from '../middleware/auth.js';

const router = Router();

router.post('/applications', async (req, res, next) => {
  try {
    const result = await submitMerchantApplication(req.body || {});
    if (result.error === 'INVALID_INPUT') return res.status(400).json({ message: result.message });
    if (result.error === 'DUPLICATE_PENDING' || result.error === 'ALREADY_APPROVED') {
      return res.status(409).json({ message: result.message });
    }
    return res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/applications/status', async (req, res, next) => {
  try {
    const result = await getMerchantApplicationByPhone(req.query.contactPhone);
    if (result.error === 'INVALID_INPUT') return res.status(400).json({ message: result.message });
    if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/dashboard/summary', requireMerchant, async (req, res, next) => {
  try {
    res.json(await getMerchantDashboardSummary(req.merchant));
  } catch (err) {
    next(err);
  }
});

router.get('/products', requireMerchant, async (req, res, next) => {
  try {
    res.json(await getMerchantProducts(req.merchant));
  } catch (err) {
    next(err);
  }
});

router.post('/products', requireMerchant, async (req, res, next) => {
  try {
    const result = await createMerchantProduct(req.merchant, req.body || {});
    if (result.error === 'INVALID_INPUT') return res.status(400).json({ message: result.message });
    return res.status(201).json(result.product);
  } catch (err) {
    next(err);
  }
});

router.get('/products/:spuId', requireMerchant, async (req, res, next) => {
  try {
    const spuId = Number(req.params.spuId);
    const result = await getMerchantProductDetail(req.merchant, spuId);
    if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
    if (result.error === 'FORBIDDEN') return res.status(403).json({ message: result.message });
    return res.json(result.product);
  } catch (err) {
    next(err);
  }
});

router.put('/products/:spuId', requireMerchant, async (req, res, next) => {
  try {
    const spuId = Number(req.params.spuId);
    const result = await updateMerchantProduct(req.merchant, spuId, req.body || {});
    if (result.error === 'INVALID_INPUT') return res.status(400).json({ message: result.message });
    if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
    if (result.error === 'FORBIDDEN') return res.status(403).json({ message: result.message });
    if (result.error === 'INVALID_STATE') return res.status(409).json({ message: result.message });
    return res.json(result.product);
  } catch (err) {
    next(err);
  }
});

router.post('/products/:spuId/submit-audit', requireMerchant, async (req, res, next) => {
  try {
    const spuId = Number(req.params.spuId);
    const result = await submitMerchantProductAudit(req.merchant, spuId);
    if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
    if (result.error === 'FORBIDDEN') return res.status(403).json({ message: result.message });
    if (result.error === 'INVALID_STATE') return res.status(409).json({ message: result.message });
    return res.json(result);
  } catch (err) {
    next(err);
  }
});

router.post('/products/:spuId/off-shelf', requireMerchant, async (req, res, next) => {
  try {
    const spuId = Number(req.params.spuId);
    const result = await offShelfMerchantProduct(req.merchant, spuId);
    if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
    if (result.error === 'FORBIDDEN') return res.status(403).json({ message: result.message });
    if (result.error === 'INVALID_STATE') return res.status(409).json({ message: result.message });
    return res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/orders', requireMerchant, async (req, res, next) => {
  try {
    const status = req.query.status || undefined;
    res.json(await getSubOrdersByMerchant(req.merchant.id, status));
  } catch (err) {
    next(err);
  }
});

router.post('/orders/:subOrderId/ship', requireMerchant, async (req, res, next) => {
  try {
    const subOrderId = Number(req.params.subOrderId);
    const { logisticsCompany, trackingNo } = req.body || {};
    const result = await shipSubOrder(req.merchant.id, subOrderId, { logisticsCompany, trackingNo });
    if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
    if (result.error === 'FORBIDDEN') return res.status(403).json({ message: result.message });
    if (result.error === 'INVALID_STATE') return res.status(409).json({ message: result.message });
    if (result.error === 'INVALID_INPUT') return res.status(400).json({ message: result.message });
    res.json({
      message: '发货成功',
      subOrderId: result.subOrder.subOrderId,
      status: result.subOrder.status,
      shipment: result.subOrder.shipment,
      orderId: result.orderId,
      orderStatus: result.orderStatus,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/after-sales', requireMerchant, async (req, res, next) => {
  try {
    const status = req.query.status || undefined;
    res.json(await getMerchantAfterSales(req.merchant.id, status));
  } catch (err) {
    next(err);
  }
});

router.post('/after-sales/:afterSaleId/audit', requireMerchant, async (req, res, next) => {
  try {
    const afterSaleId = Number(req.params.afterSaleId);
    const result = await auditMerchantAfterSale(req.merchant.id, afterSaleId, req.body || {});
    if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
    if (result.error === 'FORBIDDEN') return res.status(403).json({ message: result.message });
    if (result.error === 'INVALID_STATE') return res.status(409).json({ message: result.message });
    if (result.error === 'INVALID_INPUT' || result.error === 'REASON_REQUIRED') {
      return res.status(400).json({ message: result.message });
    }
    res.json({ message: '售后处理成功', afterSale: result.afterSale });
  } catch (err) {
    next(err);
  }
});

router.post('/after-sales/:afterSaleId/confirm-return', requireMerchant, async (req, res, next) => {
  try {
    const afterSaleId = Number(req.params.afterSaleId);
    const result = await confirmAfterSaleReturn(req.merchant.id, afterSaleId);
    if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
    if (result.error === 'FORBIDDEN') return res.status(403).json({ message: result.message });
    if (result.error === 'INVALID_STATE') return res.status(409).json({ message: result.message });
    if (result.error) return res.status(400).json({ message: result.message });
    res.json({ message: '验收通过，已退款', afterSale: result.afterSale });
  } catch (err) {
    next(err);
  }
});

export default router;
