import { Router } from 'express';
import { getUserProfile, updateUserProfile } from '../data/store.js';
import { requireUser } from '../middleware/auth.js';

const router = Router();

router.get('/me', requireUser, async (req, res, next) => {
  try {
    const profile = await getUserProfile(req.user.id);
    if (!profile) return res.status(404).json({ message: '用户不存在' });
    res.json(profile);
  } catch (err) {
    next(err);
  }
});

router.put('/me', requireUser, async (req, res, next) => {
  try {
    const result = await updateUserProfile(req.user.id, req.body || {});
    if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
    if (result.error === 'INVALID_PASSWORD') return res.status(401).json({ message: result.message });
    if (result.error === 'INVALID_INPUT') return res.status(400).json({ message: result.message });
    res.json(result.profile);
  } catch (err) {
    next(err);
  }
});

export default router;
