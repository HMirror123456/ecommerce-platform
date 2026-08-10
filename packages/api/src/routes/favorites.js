import { Router } from 'express';
import { addFavorite, getFavorites, isFavorite, removeFavorite } from '../data/store.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();

router.get('/', requireUser, async (req, res, next) => {
  try {
    res.json(await getFavorites(req.user.id));
  } catch (err) {
    next(err);
  }
});

router.post('/', requireUser, async (req, res, next) => {
  try {
    const result = await addFavorite(req.user.id, req.body?.spuId);
    if (result.error === 'INVALID_INPUT') return res.status(400).json({ message: result.message });
    if (result.error === 'PRODUCT_NOT_ON_SHELF') return res.status(404).json({ message: result.message });
    if (result.error === 'ALREADY_EXISTS') return res.status(409).json({ message: result.message });
    res.status(201).json(result.favorite);
  } catch (err) {
    next(err);
  }
});

router.get('/:spuId', requireUser, async (req, res, next) => {
  try {
    res.json(await isFavorite(req.user.id, Number(req.params.spuId)));
  } catch (err) {
    next(err);
  }
});

router.delete('/:spuId', requireUser, async (req, res, next) => {
  try {
    const result = await removeFavorite(req.user.id, Number(req.params.spuId));
    if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
