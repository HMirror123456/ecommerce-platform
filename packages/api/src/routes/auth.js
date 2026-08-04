import { Router } from 'express';
import { findAdmin, findMerchant, findUserByPhone } from '../data/store.js';
import { signAdminToken, signMerchantToken, signUserToken } from '../middleware/auth.js';

const router = Router();

router.post('/user/login', (req, res) => {
  const { phone, password } = req.body || {};
  if (!phone || !password) return res.status(400).json({ message: '请输入手机号和密码' });
  const user = findUserByPhone(phone);
  if (!user || user.password !== password) return res.status(401).json({ message: '账号或密码错误' });
  res.json({ token: signUserToken(user), userId: user.id });
});

router.post('/merchant/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ message: '请输入账号和密码' });
  const merchant = findMerchant(username, password);
  if (!merchant) return res.status(401).json({ message: '账号或密码错误' });
  res.json({
    token: signMerchantToken(merchant),
    merchantId: merchant.id,
    shopId: merchant.shopId,
    shopName: merchant.shopName,
  });
});

router.post('/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ message: '请输入账号和密码' });
  const admin = findAdmin(username, password);
  if (!admin) return res.status(401).json({ message: '账号或密码错误' });
  res.json({ token: signAdminToken(admin), adminId: admin.id, role: admin.role });
});

export default router;