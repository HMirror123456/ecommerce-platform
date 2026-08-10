import { Router } from 'express';
import {
  cancelOrder,
  createAfterSale,
  createOrder,
  escalateAfterSale,
  getOrderById,
  getOrdersByUser,
  payOrder,
} from '../data/store.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();

router.post('/', requireUser, async (req, res, next) => {
  try {
    const { addressId, items, remark } = req.body || {};
    if (!addressId || !items) return res.status(400).json({ message: 'addressId 与 items 必填' });
    const result = await createOrder(req.user.id, { addressId: Number(addressId), items, remark });
    if (result.error === 'ADDRESS_NOT_FOUND') return res.status(404).json({ message: result.message });
    if (result.error === 'SKU_NOT_FOUND') return res.status(404).json({ message: result.message });
    if (result.error === 'PRODUCT_NOT_ON_SHELF') return res.status(409).json({ message: result.message });
    if (result.error === 'INSUFFICIENT_STOCK') return res.status(409).json({ message: result.message });
    if (result.error) return res.status(400).json({ message: result.message });
    res.status(201).json(result.order);
  } catch (err) {
    next(err);
  }
});

router.get('/', requireUser, async (req, res, next) => {
  try {
    const status = req.query.status || undefined;
    res.json(await getOrdersByUser(req.user.id, status));
  } catch (err) {
    next(err);
  }
});

router.get('/:id', requireUser, async (req, res, next) => {
  try {
    const order = await getOrderById(req.user.id, Number(req.params.id));
    if (!order) return res.status(404).json({ message: '订单不存在' });
    res.json(order);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/pay', requireUser, async (req, res, next) => {
  try {
    const result = await payOrder(req.user.id, Number(req.params.id));
    if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
    if (result.error === 'PAYMENT_TIMEOUT') return res.status(409).json({ message: result.message });
    if (result.error === 'INVALID_STATE') return res.status(409).json({ message: result.message });
    if (result.error) return res.status(400).json({ message: result.message });
    res.json({ message: '支付成功', order: result.order });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/cancel', requireUser, async (req, res, next) => {
  try {
    const result = await cancelOrder(req.user.id, Number(req.params.id));
    if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
    if (result.error === 'INVALID_STATE') return res.status(409).json({ message: result.message });
    res.json(result.order);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/after-sales', requireUser, async (req, res, next) => {
  try {
    const result = await createAfterSale(req.user.id, Number(req.params.id), req.body || {});
    if (result.error === 'NOT_FOUND' || result.error === 'SUB_ORDER_NOT_FOUND') {
      return res.status(404).json({ message: result.message });
    }
    if (
      result.error === 'INVALID_STATE' ||
      result.error === 'ALREADY_EXISTS' ||
      result.error === 'INVALID_TYPE' ||
      result.error === 'REASON_REQUIRED'
    ) {
      return res.status(result.error === 'INVALID_STATE' || result.error === 'ALREADY_EXISTS' ? 409 : 400).json({
        message: result.message,
      });
    }
    res.status(201).json(result.afterSale);
  } catch (err) {
    next(err);
  }
});

router.post('/:id/after-sales/:afterSaleId/escalate', requireUser, async (req, res, next) => {
  try {
    const result = await escalateAfterSale(
      req.user.id,
      Number(req.params.id),
      Number(req.params.afterSaleId),
    );
    if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
    if (result.error === 'INVALID_STATE') return res.status(409).json({ message: result.message });
    res.json({ message: '已申请平台介入', afterSale: result.afterSale });
  } catch (err) {
    next(err);
  }
});

export default router;
