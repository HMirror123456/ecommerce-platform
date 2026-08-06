import { Router } from 'express';
import {
  auditMerchantAfterSale,
  createMerchantProduct,
  getMerchantAfterSales,
  getMerchantDashboardSummary,
  getMerchantProducts,
  getSubOrdersByMerchant,
  shipSubOrder,
  submitMerchantProductAudit,
} from '../data/store.js';
import { requireMerchant } from '../middleware/auth.js';

const router = Router();

router.get('/dashboard/summary', requireMerchant, (req, res) => {
  res.json(getMerchantDashboardSummary(req.merchant));
});

router.get('/products', requireMerchant, (req, res) => {
  res.json(getMerchantProducts(req.merchant));
});

router.post('/products', requireMerchant, (req, res) => {
  const result = createMerchantProduct(req.merchant, req.body || {});
  if (result.error === 'INVALID_INPUT') return res.status(400).json({ message: result.message });
  return res.status(201).json(result.product);
});

router.post('/products/:spuId/submit-audit', requireMerchant, (req, res) => {
  const spuId = Number(req.params.spuId);
  const result = submitMerchantProductAudit(req.merchant, spuId);
  if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
  if (result.error === 'FORBIDDEN') return res.status(403).json({ message: result.message });
  if (result.error === 'INVALID_STATE') return res.status(409).json({ message: result.message });
  return res.json(result);
});

router.get('/orders', requireMerchant, (req, res) => {
  const status = req.query.status || undefined;
  res.json(getSubOrdersByMerchant(req.merchant.id, status));
});

router.post('/orders/:subOrderId/ship', requireMerchant, (req, res) => {
  const subOrderId = Number(req.params.subOrderId);
  const { logisticsCompany, trackingNo } = req.body || {};
  const result = shipSubOrder(req.merchant.id, subOrderId, { logisticsCompany, trackingNo });
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
});

router.get('/after-sales', requireMerchant, (req, res) => {
  const status = req.query.status || undefined;
  res.json(getMerchantAfterSales(req.merchant.id, status));
});

router.post('/after-sales/:afterSaleId/audit', requireMerchant, (req, res) => {
  const afterSaleId = Number(req.params.afterSaleId);
  const result = auditMerchantAfterSale(req.merchant.id, afterSaleId, req.body || {});
  if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
  if (result.error === 'FORBIDDEN') return res.status(403).json({ message: result.message });
  if (result.error === 'INVALID_STATE') return res.status(409).json({ message: result.message });
  if (result.error === 'INVALID_INPUT' || result.error === 'REASON_REQUIRED') {
    return res.status(400).json({ message: result.message });
  }
  res.json({ message: '售后处理成功', afterSale: result.afterSale });
});

export default router;
