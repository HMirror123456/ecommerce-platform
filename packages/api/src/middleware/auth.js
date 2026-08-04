import jwt from 'jsonwebtoken';
import { findAdminById, findMerchantById, findUserById } from '../data/store.js';

const JWT_SECRET = process.env.JWT_SECRET || 'ecommerce-dev-secret-change-me';

export function signAdminToken(admin) {
  return jwt.sign({ sub: admin.id, role: admin.role, type: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
}

export function signUserToken(user) {
  return jwt.sign({ sub: user.id, type: 'user' }, JWT_SECRET, { expiresIn: '7d' });
}

export function signMerchantToken(merchant) {
  return jwt.sign({ sub: merchant.id, type: 'merchant' }, JWT_SECRET, { expiresIn: '24h' });
}

export function requireAdmin(requiredRoles) {
  return (req, res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return res.status(401).json({ message: '未登录' });
    try {
      const payload = jwt.verify(header.slice(7), JWT_SECRET);
      if (payload.type !== 'admin') return res.status(403).json({ message: '无权限' });
      const admin = findAdminById(payload.sub);
      if (!admin) return res.status(401).json({ message: '账号无效' });
      if (requiredRoles?.length && !requiredRoles.includes(admin.role)) {
        return res.status(403).json({ message: '当前角色无此操作权限' });
      }
      req.admin = admin;
      next();
    } catch {
      return res.status(401).json({ message: '登录已过期，请重新登录' });
    }
  };
}

export function requireUser(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ message: '未登录' });
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    if (payload.type !== 'user') return res.status(403).json({ message: '无权限' });
    const user = findUserById(payload.sub);
    if (!user) return res.status(401).json({ message: '账号无效' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: '登录已过期，请重新登录' });
  }
}

export function requireMerchant(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ message: '未登录' });
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    if (payload.type !== 'merchant') return res.status(403).json({ message: '无权限' });
    const merchant = findMerchantById(payload.sub);
    if (!merchant) return res.status(401).json({ message: '账号无效' });
    req.merchant = merchant;
    next();
  } catch {
    return res.status(401).json({ message: '登录已过期，请重新登录' });
  }
}