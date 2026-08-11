import { Router } from 'express';
import { getCategories } from '../data/store.js';

const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    res.json(await getCategories());
  } catch (err) {
    next(err);
  }
});

export default router;
