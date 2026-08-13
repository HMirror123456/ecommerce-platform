import { Router } from 'express';
import {
  ensureUserCsThread,
  ensureUserMerchantThreadForMerchant,
  ensureUserMerchantThreadForUser,
  getChatMessages,
  listChatThreads,
  postChatMessage,
  runChatAction,
} from '../data/store.js';
import { requireAdmin, requireMerchant, requireUser, requireUserOrCs } from '../middleware/auth.js';

const router = Router();

function chatActor(req) {
  if (req.admin) return { kind: 'admin', admin: req.admin };
  if (req.user) return { kind: 'user', user: req.user };
  if (req.merchant) return { kind: 'merchant', merchant: req.merchant };
  return null;
}

router.post('/after-sales/:afterSaleId/chat/thread', requireUser, async (req, res, next) => {
  try {
    const result = await ensureUserCsThread(req.user.id, Number(req.params.afterSaleId));
    if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
    if (result.error === 'FORBIDDEN') return res.status(403).json({ message: result.message });
    if (result.error) return res.status(400).json({ message: result.message });
    res.status(result.created ? 201 : 200).json(result.thread);
  } catch (err) {
    next(err);
  }
});

router.post('/after-sales/:afterSaleId/merchant-chat/thread', requireUser, async (req, res, next) => {
  try {
    const result = await ensureUserMerchantThreadForUser(req.user.id, Number(req.params.afterSaleId));
    if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
    if (result.error === 'FORBIDDEN') return res.status(403).json({ message: result.message });
    if (result.error) return res.status(400).json({ message: result.message });
    return res.status(result.created ? 201 : 200).json(result.thread);
  } catch (err) {
    next(err);
  }
});

router.post('/merchant/after-sales/:afterSaleId/chat/thread', requireMerchant, async (req, res, next) => {
  try {
    const result = await ensureUserMerchantThreadForMerchant(req.merchant.id, Number(req.params.afterSaleId));
    if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
    if (result.error === 'FORBIDDEN') return res.status(403).json({ message: result.message });
    if (result.error) return res.status(400).json({ message: result.message });
    return res.status(result.created ? 201 : 200).json(result.thread);
  } catch (err) {
    next(err);
  }
});

router.get('/chat/threads', requireUserOrCs, async (req, res, next) => {
  try {
    const list = await listChatThreads(chatActor(req), { status: req.query.status || undefined });
    res.json({ list });
  } catch (err) {
    next(err);
  }
});

router.get('/chat/threads/:threadId/messages', requireUserOrCs, async (req, res, next) => {
  try {
    const result = await getChatMessages(chatActor(req), Number(req.params.threadId), {
      afterId: req.query.afterId ? Number(req.query.afterId) : undefined,
    });
    if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
    if (result.error === 'FORBIDDEN') return res.status(403).json({ message: result.message });
    res.json({ list: result.list });
  } catch (err) {
    next(err);
  }
});

router.post('/chat/threads/:threadId/messages', requireUserOrCs, async (req, res, next) => {
  try {
    const result = await postChatMessage(chatActor(req), Number(req.params.threadId), req.body || {});
    if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
    if (result.error === 'FORBIDDEN') return res.status(403).json({ message: result.message });
    if (result.error) return res.status(400).json({ message: result.message });
    res.status(201).json(result.message);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/chat/threads/:threadId/actions/:actionKey',
  requireAdmin(['CS_AGENT']),
  async (req, res, next) => {
    try {
      const result = await runChatAction(
        req.admin,
        Number(req.params.threadId),
        req.params.actionKey,
        req.body || {},
      );
      if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
      if (result.error === 'FORBIDDEN') return res.status(403).json({ message: result.message });
      if (result.error === 'INVALID_STATE') return res.status(409).json({ message: result.message });
      if (result.error) return res.status(400).json({ message: result.message });
      res.json({ message: result.message, afterSale: result.afterSale || null });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
