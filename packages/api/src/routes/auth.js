import { Router } from 'express';
import { findAdmin, findMerchant, findUserByPhone, registerUser } from '../data/store.js';
import { signAdminToken, signMerchantToken, signUserToken } from '../middleware/auth.js';

const router = Router();

router.post('/user/register', async (req, res) => {
  const { phone, password } = req.body || {};
  try {
    const result = await registerUser({ phone, password });
    if (result.error === 'INVALID_PHONE' || result.error === 'INVALID_PASSWORD') {
      return res.status(400).json({ message: result.message });
    }
    if (result.error === 'PHONE_EXISTS') {
      return res.status(409).json({ message: result.message });
    }
    const user = result.user;
    res.status(201).json({ token: signUserToken(user), userId: user.id });
  } catch (err) {
    console.error(err);
    res.status(503).json({ message: '服务暂不可用，请确认数据库已启动' });
  }
});

router.post('/user/login', async (req, res) => {
  const { phone, password } = req.body || {};
  if (!phone || !password) return res.status(400).json({ message: '请输入手机号和密码' });
  try {
    const user = await findUserByPhone(phone, password);
    if (!user) return res.status(401).json({ message: '账号或密码错误' });
    res.json({ token: signUserToken(user), userId: user.id });
  } catch (err) {
    console.error(err);
    res.status(503).json({ message: '服务暂不可用，请确认数据库已启动' });
  }
});

router.post('/merchant/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ message: '请输入账号和密码' });
  try {
    const merchant = await findMerchant(username, password);
    if (!merchant) return res.status(401).json({ message: '账号或密码错误' });
    res.json({
      token: signMerchantToken(merchant),
      merchantId: merchant.id,
      shopId: merchant.shopId,
      shopName: merchant.shopName,
    });
  } catch (err) {
    console.error(err);
    res.status(503).json({ message: '服务暂不可用，请确认数据库已启动' });
  }
});

router.post('/admin/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ message: '请输入账号和密码' });
  try {
    const admin = await findAdmin(username, password);
    if (!admin) return res.status(401).json({ message: '账号或密码错误' });
    res.json({ token: signAdminToken(admin), adminId: admin.id, role: admin.role });
  } catch (err) {
    console.error(err);
    res.status(503).json({ message: '服务暂不可用，请确认数据库已启动' });
  }
});

export default router;
