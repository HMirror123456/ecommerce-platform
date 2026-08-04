import { Router } from 'express';
import {
  cancelOrder,
  createOrder,
  getOrderById,
  getOrdersByUser,
  payOrder,
} from '../data/store.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();

router.post('/', requireUser, (req, res) => {
  const { addressId, items, remark } = req.body || {};
  if (!addressId || !items) return res.status(400).json({ message: 'addressId 与 items 必填' });
  const result = createOrder(req.user.id, { addressId: Number(addressId), items, remark });
  if (result.error === 'ADDRESS_NOT_FOUND') return res.status(404).json({ message: result.message });
  if (result.error === 'SKU_NOT_FOUND') return res.status(404).json({ message: result.message });
  if (result.error === 'PRODUCT_NOT_ON_SHELF') return res.status(409).json({ message: result.message });
  if (result.error === 'INSUFFICIENT_STOCK') return res.status(409).json({ message: result.message });
  if (result.error) return res.status(400).json({ message: result.message });
  res.status(201).json(result.order);
});

router.get('/', requireUser, (req, res) => {
  const status = req.query.status || undefined;
  res.json(getOrdersByUser(req.user.id, status));
});

router.get('/:id', requireUser, (req, res) => {
  const order = getOrderById(req.user.id, Number(req.params.id));
  if (!order) return res.status(404).json({ message: '订单不存在' });
  res.json(order);
});

router.post('/:id/pay', requireUser, (req, res) => {
  const result = payOrder(req.user.id, Number(req.params.id));
  if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
  if (result.error === 'PAYMENT_TIMEOUT') return res.status(409).json({ message: result.message });
  if (result.error === 'INVALID_STATE') return res.status(409).json({ message: result.message });
  if (result.error) return res.status(400).json({ message: result.message });
  res.json({ message: '支付成功', order: result.order });
});

router.post('/:id/cancel', requireUser, (req, res) => {
  const result = cancelOrder(req.user.id, Number(req.params.id));
  if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
  if (result.error === 'INVALID_STATE') return res.status(409).json({ message: result.message });
  res.json(result.order);
});

export default router;