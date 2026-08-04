import { Router } from 'express';
import { getSubOrdersByMerchant, shipSubOrder } from '../data/store.js';
import { requireMerchant } from '../middleware/auth.js';

const router = Router();

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

export default router;