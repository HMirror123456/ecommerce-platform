import { Router } from 'express';
import { addCartItem, deleteCartItem, getCartItems, updateCartItem } from '../data/store.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();

router.get('/items', requireUser, async (req, res, next) => {
  try {
    res.json(await getCartItems(req.user.id));
  } catch (err) {
    next(err);
  }
});

router.post('/items', requireUser, async (req, res, next) => {
  try {
    const { skuId, quantity } = req.body || {};
    const result = await addCartItem(req.user.id, Number(skuId), quantity);
    if (result.error === 'INVALID_INPUT') return res.status(400).json({ message: result.message });
    if (result.error === 'PRODUCT_NOT_ON_SHELF') return res.status(409).json({ message: result.message });
    if (result.error === 'INSUFFICIENT_STOCK') return res.status(409).json({ message: result.message });
    return res.status(201).json(result.item);
  } catch (err) {
    next(err);
  }
});

router.put('/items/:itemId', requireUser, async (req, res, next) => {
  try {
    const itemId = Number(req.params.itemId);
    const { quantity } = req.body || {};
    const result = await updateCartItem(req.user.id, itemId, quantity);
    if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
    if (result.error === 'INVALID_INPUT') return res.status(400).json({ message: result.message });
    if (result.error === 'PRODUCT_NOT_ON_SHELF') return res.status(409).json({ message: result.message });
    if (result.error === 'INSUFFICIENT_STOCK') return res.status(409).json({ message: result.message });
    return res.json(result.item);
  } catch (err) {
    next(err);
  }
});

router.delete('/items/:itemId', requireUser, async (req, res, next) => {
  try {
    const itemId = Number(req.params.itemId);
    const result = await deleteCartItem(req.user.id, itemId);
    if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
