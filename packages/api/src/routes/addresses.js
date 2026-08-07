import { Router } from 'express';
import {
  createAddress,
  deleteAddress,
  getAddresses,
  setDefaultAddress,
  updateAddress,
} from '../data/store.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();

router.get('/', requireUser, async (req, res, next) => {
  try {
    res.json(await getAddresses(req.user.id));
  } catch (err) {
    next(err);
  }
});

router.post('/', requireUser, async (req, res, next) => {
  try {
    const result = await createAddress(req.user.id, req.body || {});
    if (result.error === 'INVALID_INPUT') return res.status(400).json({ message: result.message });
    return res.status(201).json(result.address);
  } catch (err) {
    next(err);
  }
});

router.put('/:addressId', requireUser, async (req, res, next) => {
  try {
    const addressId = Number(req.params.addressId);
    const result = await updateAddress(req.user.id, addressId, req.body || {});
    if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
    if (result.error === 'INVALID_INPUT') return res.status(400).json({ message: result.message });
    return res.json(result.address);
  } catch (err) {
    next(err);
  }
});

router.delete('/:addressId', requireUser, async (req, res, next) => {
  try {
    const addressId = Number(req.params.addressId);
    const result = await deleteAddress(req.user.id, addressId);
    if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
});

router.patch('/:addressId/default', requireUser, async (req, res, next) => {
  try {
    const addressId = Number(req.params.addressId);
    const result = await setDefaultAddress(req.user.id, addressId);
    if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
    return res.json(result.address);
  } catch (err) {
    next(err);
  }
});

export default router;
