import { Router } from 'express';
import {
  ensureUserCsThread,
  ensureUserMerchantThread,
  ensureOrderMerchantThread,
  closeChatThread,
  getAfterSaleChatThread,
  getChatMessages,
  listChatThreads,
  postChatMessage,
  runChatAction,
  runMerchantChatAction,
} from '../data/store.js';
import {
  requireAdmin,
  requireMerchant,
  requireUser,
  requireUserMerchantOrCs,
} from '../middleware/auth.js';

const router = Router();

function chatActor(req) {
  if (req.admin) return { kind: 'admin', admin: req.admin };
  if (req.merchant) return { kind: 'merchant', merchant: req.merchant };
  if (req.user) return { kind: 'user', user: req.user };
  return null;
}

router.post('/after-sales/:afterSaleId/chat/thread', requireUser, async (req, res, next) => {
  try {
    const result = await ensureUserCsThread(req.user.id, Number(req.params.afterSaleId));
    if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
    if (result.error === 'FORBIDDEN') return res.status(403).json({ message: result.message });
    if (result.error === 'INVALID_STATE') return res.status(409).json({ message: result.message });
    if (result.error) return res.status(400).json({ message: result.message });
    res.status(result.created ? 201 : 200).json(result.thread);
  } catch (err) {
    next(err);
  }
});

router.get('/after-sales/:afterSaleId/chat/thread', requireUserMerchantOrCs, async (req, res, next) => {
  try {
    const result = await getAfterSaleChatThread(chatActor(req), Number(req.params.afterSaleId), 'USER_CS');
    if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
    if (result.error === 'FORBIDDEN') return res.status(403).json({ message: result.message });
    if (result.error) return res.status(400).json({ message: result.message });
    res.json(result.thread);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/after-sales/:afterSaleId/merchant-chat/thread',
  requireUserMerchantOrCs,
  async (req, res, next) => {
    try {
      if (req.admin) {
        return res.status(403).json({ message: '平台客服请使用 USER_CS 会话' });
      }
      const actor = req.merchant
        ? { kind: 'merchant', merchant: req.merchant }
        : { kind: 'user', user: req.user };
      const result = await ensureUserMerchantThread(actor, Number(req.params.afterSaleId));
      if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
      if (result.error === 'FORBIDDEN') return res.status(403).json({ message: result.message });
      if (result.error === 'INVALID_STATE') return res.status(409).json({ message: result.message });
      if (result.error) return res.status(400).json({ message: result.message });
      res.status(result.created ? 201 : 200).json(result.thread);
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  '/after-sales/:afterSaleId/merchant-chat/thread',
  requireUserMerchantOrCs,
  async (req, res, next) => {
    try {
      if (req.admin) {
        return res.status(403).json({ message: '平台客服请使用 USER_CS 会话' });
      }
      const result = await getAfterSaleChatThread(
        chatActor(req),
        Number(req.params.afterSaleId),
        'USER_MERCHANT',
      );
      if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
      if (result.error === 'FORBIDDEN') return res.status(403).json({ message: result.message });
      if (result.error) return res.status(400).json({ message: result.message });
      res.json(result.thread);
    } catch (err) {
      next(err);
    }
  },
);

router.post('/orders/:orderId/merchant-chat/thread', requireUser, async (req, res, next) => {
  try {
    const result = await ensureOrderMerchantThread(req.user.id, Number(req.params.orderId), req.body || {});
    if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
    if (result.error === 'FORBIDDEN') return res.status(403).json({ message: result.message });
    if (result.error === 'INVALID_STATE') return res.status(409).json({ message: result.message });
    if (result.error === 'INVALID_INPUT') return res.status(400).json({ message: result.message });
    if (result.error) return res.status(400).json({ message: result.message });
    res.status(result.created ? 201 : 200).json(result.thread);
  } catch (err) {
    next(err);
  }
});

/** 商家端开聊入口（与 openapi / web-merchant 对齐） */
router.post('/merchant/after-sales/:afterSaleId/chat/thread', requireMerchant, async (req, res, next) => {
  try {
    const result = await ensureUserMerchantThread(
      { kind: 'merchant', merchant: req.merchant },
      Number(req.params.afterSaleId),
    );
    if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
    if (result.error === 'FORBIDDEN') return res.status(403).json({ message: result.message });
    if (result.error === 'INVALID_STATE') return res.status(409).json({ message: result.message });
    if (result.error) return res.status(400).json({ message: result.message });
    res.status(result.created ? 201 : 200).json(result.thread);
  } catch (err) {
    next(err);
  }
});

router.get('/chat/threads', requireUserMerchantOrCs, async (req, res, next) => {
  try {
    const list = await listChatThreads(chatActor(req), {
      status: req.query.status || undefined,
      type: req.query.type || undefined,
    });
    res.json({ list });
  } catch (err) {
    next(err);
  }
});

router.get('/chat/threads/:threadId/messages', requireUserMerchantOrCs, async (req, res, next) => {
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

router.post('/chat/threads/:threadId/messages', requireUserMerchantOrCs, async (req, res, next) => {
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

router.post('/chat/threads/:threadId/close', requireUserMerchantOrCs, async (req, res, next) => {
  try {
    const result = await closeChatThread(chatActor(req), Number(req.params.threadId));
    if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
    if (result.error === 'FORBIDDEN') return res.status(403).json({ message: result.message });
    if (result.error) return res.status(400).json({ message: result.message });
    res.json(result.thread);
  } catch (err) {
    next(err);
  }
});

router.post(
  '/chat/threads/:threadId/actions/:actionKey',
  async (req, res, next) => {
    // 客服动作走 admin；商家动作走 merchant
    const key = String(req.params.actionKey || '').toUpperCase();
    if (key.startsWith('MERCHANT_')) {
      return requireMerchant(req, res, async (err) => {
        if (err) return next(err);
        try {
          const result = await runMerchantChatAction(
            req.merchant,
            Number(req.params.threadId),
            key,
            req.body || {},
          );
          if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
          if (result.error === 'FORBIDDEN') return res.status(403).json({ message: result.message });
          if (result.error === 'INVALID_STATE') return res.status(409).json({ message: result.message });
          if (result.error === 'REASON_REQUIRED' || result.error === 'INVALID') {
            return res.status(400).json({ message: result.message });
          }
          if (result.error) return res.status(400).json({ message: result.message });
          res.json({ message: result.message, afterSale: result.afterSale || null });
        } catch (e) {
          next(e);
        }
      });
    }
    return requireAdmin(['CS_AGENT'])(req, res, async (err) => {
      if (err) return next(err);
      try {
        const result = await runChatAction(
          req.admin,
          Number(req.params.threadId),
          key,
          req.body || {},
        );
        if (result.error === 'NOT_FOUND') return res.status(404).json({ message: result.message });
        if (result.error === 'FORBIDDEN') return res.status(403).json({ message: result.message });
        if (result.error === 'INVALID_STATE') return res.status(409).json({ message: result.message });
        if (result.error) return res.status(400).json({ message: result.message });
        res.json({ message: result.message, afterSale: result.afterSale || null });
      } catch (e) {
        next(e);
      }
    });
  },
);

export default router;
