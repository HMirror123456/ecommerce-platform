/** Store facade over MySQL repositories; legacy product fixtures remain for older helper fallbacks. */

import * as adminRepo from '../repositories/adminRepo.js';
import * as merchantRepo from '../repositories/merchantRepo.js';
import * as merchantApplicationRepo from '../repositories/merchantApplicationRepo.js';
import * as productAuditRepo from '../repositories/productAuditRepo.js';
import * as userRepo from '../repositories/userRepo.js';
import * as orderRepo from '../repositories/orderRepo.js';
import * as afterSaleRepo from '../repositories/afterSaleRepo.js';
import * as favoriteRepo from '../repositories/favoriteRepo.js';
import * as categoryRepo from '../repositories/categoryRepo.js';
import * as productRepo from '../repositories/productRepo.js';
import * as stockRepo from '../repositories/stockRepo.js';
import * as chatRepo from '../repositories/chatRepo.js';

const ORDER_PAY_TIMEOUT_MS = 15 * 60 * 1000;
/** 子单发货后 7 天自动确认收货 */
const ORDER_AUTO_CONFIRM_MS = 7 * 24 * 60 * 60 * 1000;

// Legacy product fixtures; main category/product/stock flows use repository-backed MySQL data.
export const categories = [
  {
    id: 1,
    name: '数码',
    children: [
      { id: 11, name: '耳机', children: [] },
      { id: 12, name: '电脑外设', children: [] },
    ],
  },
  {
    id: 2,
    name: '家居生活',
    children: [
      { id: 21, name: '照明', children: [] },
    ],
  },
];

export const spus = [
  {
    spuId: 101,
    shopId: 1,
    shopName: '数码旗舰店',
    merchantId: 1,
    categoryId: 11,
    title: '无线蓝牙耳机 Pro',
    description: '主动降噪，续航 30 小时',
    mainImage: 'https://picsum.photos/seed/spu101/200/200',
    status: 'ON_SHELF',
    submittedAt: '2026-08-04T08:30:00.000Z',
    skus: [
      { skuId: 1001, specJson: { color: '黑色' }, price: 299, stock: { available: 120, locked: 0 } },
      { skuId: 1002, specJson: { color: '白色' }, price: 299, stock: { available: 80, locked: 0 } },
    ],
  },
  {
    spuId: 102,
    shopId: 2,
    shopName: '家居生活馆',
    merchantId: 2,
    categoryId: 21,
    title: '北欧简约台灯',
    description: '三档调光，护眼设计',
    mainImage: 'https://picsum.photos/seed/spu102/200/200',
    status: 'ON_SHELF',
    submittedAt: '2026-08-04T09:15:00.000Z',
    skus: [{ skuId: 1003, specJson: { color: '原木色' }, price: 159, stock: { available: 50, locked: 0 } }],
  },
  {
    spuId: 103,
    shopId: 1,
    shopName: '数码旗舰店',
    merchantId: 1,
    categoryId: 12,
    title: '机械键盘 87 键',
    description: '青轴，RGB 背光',
    mainImage: 'https://picsum.photos/seed/spu103/200/200',
    status: 'PENDING_AUDIT',
    submittedAt: '2026-08-04T10:00:00.000Z',
    skus: [{ skuId: 1004, specJson: { switch: '青轴' }, price: 449, stock: { available: 30, locked: 0 } }],
  },
];

function getNextSpuId() {
  return Math.max(0, ...spus.map((s) => Number(s.spuId) || 0)) + 1;
}

function getNextSkuId() {
  const skuIds = spus.flatMap((spu) => spu.skus.map((sku) => Number(sku.skuId) || 0));
  return Math.max(0, ...skuIds) + 1;
}

function ownsSpu(merchant, spu) {
  if (!merchant || !spu) return false;
  if (spu.merchantId != null) return spu.merchantId === merchant.id;
  return spu.shopId === merchant.shopId;
}

function findCategoryById(categoryId, nodes = categories) {
  for (const node of nodes) {
    if (node.id === categoryId) return node;
    const child = findCategoryById(categoryId, node.children || []);
    if (child) return child;
  }
  return null;
}

function findRootCategoryById(categoryId, nodes = categories, root = null) {
  for (const node of nodes) {
    const currentRoot = root || node;
    if (node.id === categoryId) return currentRoot;
    const childRoot = findRootCategoryById(categoryId, node.children || [], currentRoot);
    if (childRoot) return childRoot;
  }
  return null;
}

function collectCategoryIds(category) {
  return [category.id, ...(category.children || []).flatMap(collectCategoryIds)];
}

function getCategoryFilterIds(categoryId) {
  const cid = Number(categoryId);
  if (!Number.isInteger(cid)) return null;
  const category = findCategoryById(cid);
  return category ? collectCategoryIds(category) : [cid];
}

function getCategoryInfo(categoryId) {
  const category = findRootCategoryById(categoryId);
  return {
    categoryId,
    categoryName: category?.name || null,
  };
}

function serializeMerchantProduct(spu) {
  const category = getCategoryInfo(spu.categoryId);
  const product = {
    spuId: spu.spuId,
    shopId: spu.shopId,
    shopName: spu.shopName,
    merchantId: spu.merchantId,
    categoryId: category.categoryId,
    categoryName: category.categoryName,
    title: spu.title,
    description: spu.description,
    mainImage: spu.mainImage,
    status: spu.status,
    skus: spu.skus.map((sku) => ({
      skuId: sku.skuId,
      specJson: sku.specJson,
      price: sku.price,
      stock: {
        available: sku.stock?.available ?? 0,
        locked: sku.stock?.locked ?? 0,
      },
    })),
  };
  if (spu.submittedAt) product.submittedAt = spu.submittedAt;
  if (spu.rejectReason) product.rejectReason = spu.rejectReason;
  return product;
}

function serializePublicProductSummary(spu) {
  const prices = spu.skus.map((s) => s.price);
  const category = getCategoryInfo(spu.categoryId);
  return {
    spuId: spu.spuId,
    categoryId: category.categoryId,
    categoryName: category.categoryName,
    title: spu.title,
    mainImage: spu.mainImage,
    minPrice: prices.length ? Math.min(...prices) : 0,
  };
}

function serializePublicProductDetail(spu) {
  const category = getCategoryInfo(spu.categoryId);
  return {
    spuId: spu.spuId,
    categoryId: category.categoryId,
    categoryName: category.categoryName,
    title: spu.title,
    description: spu.description,
    mainImage: spu.mainImage,
    shopName: spu.shopName,
    skus: spu.skus.map((sku) => ({
      skuId: sku.skuId,
      specJson: sku.specJson,
      price: sku.price,
      stock: sku.stock?.available ?? 0,
    })),
  };
}

function isPlainObject(value) {
  return value != null && typeof value === 'object' && !Array.isArray(value);
}

function validateCreateMerchantProductInput(payload) {
  if (payload?.categoryId == null || payload.categoryId === '') {
    return { error: 'INVALID_INPUT', message: 'Category is required' };
  }
  const categoryId = Number(payload?.categoryId);
  if (!Number.isInteger(categoryId)) {
    return { error: 'INVALID_INPUT', message: 'Category is required' };
  }
  if (!payload?.title?.trim()) {
    return { error: 'INVALID_INPUT', message: 'Product title is required' };
  }
  if (!payload?.description?.trim()) {
    return { error: 'INVALID_INPUT', message: 'Product description is required' };
  }
  if (!payload?.mainImage?.trim()) {
    return { error: 'INVALID_INPUT', message: 'Product main image is required' };
  }
  if (!Array.isArray(payload?.skus) || payload.skus.length === 0) {
    return { error: 'INVALID_INPUT', message: 'At least one SKU is required' };
  }
  for (const sku of payload.skus) {
    if (!isPlainObject(sku.specJson)) {
      return { error: 'INVALID_INPUT', message: 'SKU spec is required' };
    }
    if (sku.price == null || sku.price === '') {
      return { error: 'INVALID_INPUT', message: 'SKU price is invalid' };
    }
    const price = Number(sku.price);
    if (!Number.isFinite(price) || price < 0) {
      return { error: 'INVALID_INPUT', message: 'SKU price is invalid' };
    }
    if (sku.stock?.available == null || sku.stock.available === '') {
      return { error: 'INVALID_INPUT', message: 'Stock available is invalid' };
    }
    const available = Number(sku.stock?.available);
    if (!Number.isInteger(available) || available < 0) {
      return { error: 'INVALID_INPUT', message: 'Stock available is invalid' };
    }
  }
  return { ok: true };
}

function validateUpdateMerchantProductInput(payload) {
  if (payload?.categoryId == null || payload.categoryId === '') {
    return { error: 'INVALID_INPUT', message: 'Category is required' };
  }
  const categoryId = Number(payload?.categoryId);
  if (!Number.isInteger(categoryId)) {
    return { error: 'INVALID_INPUT', message: 'Category is required' };
  }
  if (!payload?.title?.trim()) {
    return { error: 'INVALID_INPUT', message: 'Product title is required' };
  }
  if (!payload?.description?.trim()) {
    return { error: 'INVALID_INPUT', message: 'Product description is required' };
  }
  if (!payload?.mainImage?.trim()) {
    return { error: 'INVALID_INPUT', message: 'Product main image is required' };
  }
  if (!Array.isArray(payload?.skus) || payload.skus.length === 0) {
    return { error: 'INVALID_INPUT', message: 'At least one SKU is required' };
  }
  const skuIds = new Set();
  for (const sku of payload.skus) {
    const skuId = Number(sku.skuId);
    if (!Number.isInteger(skuId) || skuId <= 0 || skuIds.has(skuId)) {
      return { error: 'INVALID_INPUT', message: 'SKU id is invalid' };
    }
    skuIds.add(skuId);
    if (!isPlainObject(sku.specJson) || Object.keys(sku.specJson).length === 0) {
      return { error: 'INVALID_INPUT', message: 'SKU spec is required' };
    }
    if (sku.price == null || sku.price === '') {
      return { error: 'INVALID_INPUT', message: 'SKU price is invalid' };
    }
    const price = Number(sku.price);
    if (!Number.isFinite(price) || price < 0) {
      return { error: 'INVALID_INPUT', message: 'SKU price is invalid' };
    }
  }
  return { ok: true };
}

export async function expirePendingOrders() {
  const expired = await orderRepo.listExpiredPendingOrders();
  for (const order of expired) {
    for (const item of order.items) {
      await stockRepo.releaseStock(item.skuId, item.quantity);
    }
    const now = new Date().toISOString();
    await orderRepo.updateOrder(order.orderId, {
      status: 'CANCELLED',
      cancelledAt: now,
      cancelReason: 'PAYMENT_TIMEOUT',
    });
    await orderRepo.updateSubOrdersByOrder(order.orderId, 'PENDING_PAYMENT', 'CANCELLED');
  }
  await autoConfirmShippedOrders();
  await escalateOverdueAfterSales();
}

/**
 * 领域：SHIPPED → COMPLETED（超时自动确认收货，按子单）
 * 每个 SHIPPED 子单独立判断 shippedAt + ORDER_AUTO_CONFIRM_MS
 */
export async function autoConfirmShippedOrders() {
  const candidates = await orderRepo.listOrdersByStatus('SHIPPED');
  // 部分发货时主单也可能仍是 PENDING_SHIPMENT？当前发货逻辑会把主单置 SHIPPED。
  // 另扫 PENDING_SHIPMENT 以防历史数据：有子单已发货但主单未升态
  const pendingShip = await orderRepo.listOrdersByStatus('PENDING_SHIPMENT');
  const seen = new Set();
  const orders = [];
  for (const order of [...candidates, ...pendingShip]) {
    if (seen.has(order.orderId)) continue;
    seen.add(order.orderId);
    orders.push(order);
  }

  const now = Date.now();
  for (const order of orders) {
    let changed = false;
    for (const sub of order.subOrders || []) {
      if (sub.status !== 'SHIPPED') continue;
      const shippedAtMs = getSubShippedAtMs(sub);
      if (shippedAtMs == null) continue;
      if (shippedAtMs + ORDER_AUTO_CONFIRM_MS > now) continue;
      await orderRepo.updateSubOrderStatus(sub.subOrderId, 'COMPLETED');
      changed = true;
    }
    if (changed) {
      const fresh = await orderRepo.findById(order.orderId);
      await syncMainOrderFulfillmentStatus(fresh);
    }
  }
}

function getSubShippedAtMs(sub) {
  const raw = sub?.shipment?.shippedAt;
  const t = raw ? new Date(raw).getTime() : NaN;
  return Number.isFinite(t) ? t : null;
}

function computeSubAutoConfirmDeadline(sub) {
  if (sub.status !== 'SHIPPED') return null;
  const shippedAtMs = getSubShippedAtMs(sub);
  if (shippedAtMs == null) return null;
  return new Date(shippedAtMs + ORDER_AUTO_CONFIRM_MS).toISOString();
}

/** 主单展示：最早一个待自动确认的子单截止时间 */
function computeAutoConfirmDeadline(order) {
  let earliest = null;
  for (const sub of order.subOrders || []) {
    const d = computeSubAutoConfirmDeadline(sub);
    if (!d) continue;
    if (!earliest || new Date(d).getTime() < new Date(earliest).getTime()) earliest = d;
  }
  return earliest;
}

/**
 * 履约完成后聚合主单状态（不覆盖 REFUNDING/REFUNDED/CANCELLED/PENDING_PAYMENT）
 * - 全部活跃子单 COMPLETED → 主单 COMPLETED
 * - 存在 SHIPPED/COMPLETED 且无待发货 → SHIPPED
 * - 存在 SHIPPED/COMPLETED 且仍有 PENDING_SHIPMENT → SHIPPED（部分发货）
 * - 仅有待发货 → PENDING_SHIPMENT
 */
async function syncMainOrderFulfillmentStatus(order) {
  if (!order) return null;
  if (['REFUNDING', 'REFUNDED', 'CANCELLED', 'PENDING_PAYMENT'].includes(order.status)) {
    return order;
  }
  const active = (order.subOrders || []).filter((s) => s.status !== 'CANCELLED');
  if (!active.length) return order;

  let next = order.status;
  if (active.every((s) => s.status === 'COMPLETED')) {
    next = 'COMPLETED';
  } else if (active.some((s) => s.status === 'SHIPPED' || s.status === 'COMPLETED')) {
    next = 'SHIPPED';
  } else if (active.every((s) => s.status === 'PENDING_SHIPMENT' || s.status === 'PAID')) {
    next = 'PENDING_SHIPMENT';
  }

  if (next !== order.status) {
    await orderRepo.updateOrder(order.orderId, { status: next });
    return orderRepo.findById(order.orderId);
  }
  return order;
}

/** 领域规则：商家 48h 未处理 APPLIED → ESCALATED */
export async function escalateOverdueAfterSales() {
  return afterSaleRepo.escalateOverdue(new Date());
}

/** 进行中 + 已退款 占用可售后数量；REJECTED 不占用 */
const AFTER_SALE_QTY_OCCUPIED = new Set(['APPLIED', 'ESCALATED', 'APPROVED', 'RETURNING', 'REFUNDED']);
const AFTER_SALE_IN_PROGRESS = new Set(['APPLIED', 'ESCALATED', 'APPROVED', 'RETURNING']);

function getOccupiedQtyBySku(afterSales) {
  const map = new Map();
  for (const as of afterSales || []) {
    if (!AFTER_SALE_QTY_OCCUPIED.has(as.status)) continue;
    for (const line of as.items || []) {
      const skuId = Number(line.skuId);
      const qty = Number(line.quantity) || 0;
      if (!Number.isInteger(skuId) || skuId <= 0 || qty <= 0) continue;
      map.set(skuId, (map.get(skuId) || 0) + qty);
    }
  }
  return map;
}

function buildRemainingItemsForSub(sub, occupiedBySku) {
  return (sub.items || [])
    .map((line) => {
      const skuId = Number(line.skuId);
      const ordered = Number(line.quantity) || 0;
      const occupied = occupiedBySku.get(skuId) || 0;
      const remaining = Math.max(0, ordered - occupied);
      return {
        skuId,
        title: line.title,
        price: line.price,
        quantity: remaining,
        orderedQuantity: ordered,
      };
    })
    .filter((line) => line.quantity > 0);
}

async function orderHasInProgressAfterSale(orderId, excludeAfterSaleId = null) {
  const list = await afterSaleRepo.listByOrderId(orderId);
  return list.some(
    (a) =>
      a.afterSaleId !== excludeAfterSaleId && AFTER_SALE_IN_PROGRESS.has(a.status),
  );
}

async function isOrderFullyRefundedByAfterSales(order) {
  const list = await afterSaleRepo.listByOrderId(order.orderId);
  const refundedQty = new Map();
  for (const as of list) {
    if (as.status !== 'REFUNDED') continue;
    for (const line of as.items || []) {
      const skuId = Number(line.skuId);
      const qty = Number(line.quantity) || 0;
      refundedQty.set(skuId, (refundedQty.get(skuId) || 0) + qty);
    }
  }
  for (const line of order.items || []) {
    const skuId = Number(line.skuId);
    const ordered = Number(line.quantity) || 0;
    if ((refundedQty.get(skuId) || 0) < ordered) return false;
  }
  return (order.items || []).length > 0;
}

/**
 * 领域规则：同意售后收尾 → 本售后 REFUNDED；
 * 仅当订单全部商品均已 REFUNDED 时主单/子单 → REFUNDED；库存按本售后 items 回滚
 */
async function finalizeApprovedAfterSale(item, { auditReason = null } = {}) {
  for (const line of item.items || []) {
    const skuId = Number(line.skuId);
    const quantity = Number(line.quantity);
    if (!Number.isInteger(skuId) || skuId <= 0) continue;
    if (!Number.isInteger(quantity) || quantity <= 0) continue;
    const restored = await stockRepo.restoreAvailable(skuId, quantity);
    if (restored.error === 'SKU_NOT_FOUND') {
      continue;
    }
    if (restored.error) return restored;
  }

  const updated = await afterSaleRepo.updateAudit(item.afterSaleId, {
    status: 'REFUNDED',
    auditReason,
    auditedAt: new Date(),
  });

  const order = await orderRepo.findById(item.orderId);
  if (order && (await isOrderFullyRefundedByAfterSales(order))) {
    await orderRepo.updateOrder(item.orderId, { status: 'REFUNDED' });
    for (const sub of order.subOrders || []) {
      await orderRepo.updateSubOrderStatus(sub.subOrderId, 'REFUNDED');
    }
  } else if (order && !(await orderHasInProgressAfterSale(item.orderId, item.afterSaleId))) {
    // 部分退款完成且无进行中售后：退出 REFUNDING
    if (order.status === 'REFUNDING') {
      await orderRepo.updateOrder(item.orderId, { status: 'SHIPPED' });
    }
    if (item.subOrderId) {
      const sub = order.subOrders?.find((s) => s.subOrderId === item.subOrderId);
      if (sub?.status === 'REFUNDING') {
        await orderRepo.updateSubOrderStatus(item.subOrderId, 'SHIPPED');
      }
    }
  }

  return { afterSale: afterSaleRepo.serialize(updated) };
}

/**
 * 领域规则：
 * - REFUND_ONLY：同意 → 直接 REFUNDED
 * - RETURN_REFUND：同意 → APPROVED，等待用户寄回
 */
async function approveAfterSale(item, { auditReason = null } = {}) {
  if (item.type === 'RETURN_REFUND') {
    const updated = await afterSaleRepo.updateAudit(item.afterSaleId, {
      status: 'APPROVED',
      auditReason: auditReason || '同意退货退款，请用户寄回商品',
      auditedAt: new Date(),
    });
    return { afterSale: afterSaleRepo.serialize(updated) };
  }
  return finalizeApprovedAfterSale(item, { auditReason });
}

/** 领域规则：售后拒绝关闭 → 若无其它进行中售后，订单退出 REFUNDING */
async function closeRejectedAfterSale(item, reason) {
  const updated = await afterSaleRepo.updateAudit(item.afterSaleId, {
    status: 'REJECTED',
    auditReason: reason?.trim() || null,
    auditedAt: new Date(),
  });
  const order = await orderRepo.findById(item.orderId);
  const stillOpen = await orderHasInProgressAfterSale(item.orderId, item.afterSaleId);
  if (!stillOpen && order?.status === 'REFUNDING') {
    await orderRepo.updateOrder(item.orderId, { status: 'SHIPPED' });
  }
  if (!stillOpen && item.subOrderId) {
    const sub = order?.subOrders?.find((s) => s.subOrderId === item.subOrderId);
    if (sub?.status === 'REFUNDING') {
      await orderRepo.updateSubOrderStatus(item.subOrderId, 'SHIPPED');
    }
  }
  return { afterSale: afterSaleRepo.serialize(updated) };
}

/** 领域规则：APPROVED + RETURN_REFUND → RETURNING（用户寄回） */
export async function submitAfterSaleReturn(userId, orderId, afterSaleId, { logisticsCompany, trackingNo } = {}) {
  await expirePendingOrders();
  if (!logisticsCompany?.trim() || !trackingNo?.trim()) {
    return { error: 'INVALID_INPUT', message: '请填写物流公司与运单号' };
  }

  const item = await afterSaleRepo.findById(afterSaleId);
  if (!item || item.orderId !== Number(orderId) || item.userId !== userId) {
    return { error: 'NOT_FOUND', message: '售后单不存在' };
  }
  if (item.type !== 'RETURN_REFUND') {
    return { error: 'INVALID_STATE', message: '仅退货退款售后需要寄回物流' };
  }
  if (item.status !== 'APPROVED') {
    return { error: 'INVALID_STATE', message: '当前售后状态不允许填写寄回物流' };
  }

  const returnShipment = {
    logisticsCompany: logisticsCompany.trim(),
    trackingNo: trackingNo.trim(),
    shippedAt: new Date().toISOString(),
  };
  const updated = await afterSaleRepo.updateReturnShipment(afterSaleId, {
    status: 'RETURNING',
    returnShipment,
  });
  return { afterSale: afterSaleRepo.serialize(updated) };
}

/** 领域规则：RETURNING → REFUNDED（商家验收） */
export async function confirmAfterSaleReturn(merchantId, afterSaleId) {
  await expirePendingOrders();
  const item = await afterSaleRepo.findById(afterSaleId);
  if (!item) return { error: 'NOT_FOUND', message: '售后单不存在' };
  if (item.merchantId !== merchantId) return { error: 'FORBIDDEN', message: '无权处理该售后单' };
  if (item.status !== 'RETURNING') {
    return { error: 'INVALID_STATE', message: '仅退货中（RETURNING）售后可验收退款' };
  }
  return finalizeApprovedAfterSale(item, {
    auditReason: item.auditReason || '商家验收通过，已退款',
  });
}

export async function findAdmin(username, password) {
  return adminRepo.findAdminByCredentials(username, password);
}

export async function findAdminById(id) {
  return adminRepo.findAdminById(id);
}

export async function findMerchant(username, password) {
  return merchantRepo.findMerchantByCredentials(username, password);
}

export async function findMerchantById(id) {
  return merchantRepo.findMerchantById(id);
}

export async function findUserByPhone(phone, password) {
  return userRepo.findByPhone(phone, password);
}

export async function findUserById(id) {
  return userRepo.findById(id);
}

const AVATAR_MAX_LENGTH = 300000;
const AVATAR_HTTP_RE = /^https?:\/\/.+/i;
const AVATAR_DATA_RE = /^data:image\/(jpeg|jpg|png|gif|webp);base64,[a-z0-9+/=\s]+$/i;

function normalizeAvatarUrl(value) {
  if (value == null) return { avatarUrl: null };
  const avatarUrl = String(value).trim();
  if (!avatarUrl) return { avatarUrl: null };
  if (avatarUrl.length > AVATAR_MAX_LENGTH) {
    return { error: 'INVALID_INPUT', message: '头像文件过大，请选择约 200KB 以内的图片' };
  }
  if (AVATAR_HTTP_RE.test(avatarUrl) || AVATAR_DATA_RE.test(avatarUrl)) {
    return { avatarUrl };
  }
  return { error: 'INVALID_INPUT', message: '头像须为 http(s) 图片地址或本地上传的图片' };
}

export function serializeUserProfile(user) {
  if (!user) return null;
  return {
    userId: user.id,
    phone: user.phone,
    nickname: user.nickname || null,
    avatarUrl: user.avatarUrl || null,
  };
}

export async function getUserProfile(userId) {
  const user = await userRepo.findById(userId);
  if (!user) return null;
  return serializeUserProfile(user);
}

/** 领域规则：手机号唯一且不可改；可改昵称/头像；改密需校验原密码 */
export async function updateUserProfile(userId, payload = {}) {
  const user = await userRepo.findById(userId);
  if (!user) return { error: 'NOT_FOUND', message: '用户不存在' };

  const updates = {};
  if (payload.nickname !== undefined) {
    const nickname = String(payload.nickname || '').trim();
    if (!nickname) return { error: 'INVALID_INPUT', message: '昵称不能为空' };
    if (nickname.length > 64) return { error: 'INVALID_INPUT', message: '昵称最多 64 个字符' };
    updates.nickname = nickname;
  }

  if (payload.avatarUrl !== undefined) {
    const normalized = normalizeAvatarUrl(payload.avatarUrl);
    if (normalized.error) return normalized;
    updates.avatarUrl = normalized.avatarUrl;
  }

  const { currentPassword, newPassword } = payload;
  const changingPassword = currentPassword != null || newPassword != null;
  if (changingPassword) {
    if (!currentPassword || !newPassword) {
      return { error: 'INVALID_INPUT', message: '修改密码需同时提供当前密码与新密码' };
    }
    if (user.password !== String(currentPassword)) {
      return { error: 'INVALID_PASSWORD', message: '当前密码不正确' };
    }
    if (String(newPassword).length < 6) {
      return { error: 'INVALID_INPUT', message: '新密码至少 6 位' };
    }
    updates.password = String(newPassword);
  }

  if (!Object.keys(updates).length) {
    return { error: 'INVALID_INPUT', message: '请提供要修改的字段' };
  }

  const updated = await userRepo.updateProfile(userId, updates);
  return { profile: serializeUserProfile(updated) };
}

export async function registerUser({ phone, password }) {
  const normalizedPhone = String(phone || '').trim();
  const normalizedPassword = String(password || '');
  if (!/^1\d{10}$/.test(normalizedPhone)) {
    return { error: 'INVALID_PHONE', message: '请输入有效的 11 位手机号' };
  }
  if (normalizedPassword.length < 6) {
    return { error: 'INVALID_PASSWORD', message: '密码至少 6 位' };
  }
  const existing = await userRepo.findByPhoneOnly(normalizedPhone);
  if (existing) {
    return { error: 'PHONE_EXISTS', message: '该手机号已注册' };
  }
  const user = await userRepo.createUser({
    phone: normalizedPhone,
    password: normalizedPassword,
    nickname: `用户${normalizedPhone.slice(-4)}`,
  });
  return { user };
}

export async function findAddressById(userId, addressId) {
  return userRepo.findAddressById(userId, addressId);
}

function serializeAddress(address) {
  return {
    id: address.id,
    receiverName: address.receiverName,
    phone: address.phone,
    province: address.province,
    city: address.city,
    district: address.district,
    detail: address.detail,
    isDefault: Boolean(address.isDefault),
  };
}

function validateAddressInput(payload, { partial = false } = {}) {
  const fields = ['receiverName', 'phone', 'province', 'city', 'district', 'detail'];
  for (const field of fields) {
    if (partial && payload[field] === undefined) continue;
    if (!payload[field]?.trim()) {
      return { error: 'INVALID_INPUT', message: `${field} 不能为空` };
    }
  }
  return { ok: true };
}

export async function getAddresses(userId) {
  await expirePendingOrders();
  const list = await userRepo.listAddresses(userId);
  return list.map(serializeAddress);
}

export async function createAddress(userId, payload) {
  await expirePendingOrders();
  const validation = validateAddressInput(payload);
  if (validation.error) return validation;
  return userRepo.createAddress(userId, payload);
}

export async function updateAddress(userId, addressId, payload) {
  await expirePendingOrders();
  const validation = validateAddressInput(payload, { partial: true });
  if (validation.error) return validation;
  return userRepo.updateAddress(userId, addressId, payload);
}

export async function deleteAddress(userId, addressId) {
  await expirePendingOrders();
  return userRepo.deleteAddress(userId, addressId);
}

export async function setDefaultAddress(userId, addressId) {
  await expirePendingOrders();
  return userRepo.setDefaultAddress(userId, addressId);
}

async function buildCartSkuSnapshot(skuId) {
  const snapshot = await productRepo.findSkuSnapshot(skuId);
  if (!snapshot) return null;
  if (snapshot.status !== 'ON_SHELF') {
    return {
      skuId: snapshot.skuId,
      spuId: snapshot.spuId,
      specJson: snapshot.specJson || {},
      price: 0,
      stock: 0,
      title: '商品已下架',
      mainImage: snapshot.mainImage || '',
      shopName: snapshot.shopName || '',
      invalid: true,
    };
  }
  return {
    skuId: snapshot.skuId,
    spuId: snapshot.spuId,
    specJson: snapshot.specJson,
    price: snapshot.price,
    stock: snapshot.stock.available,
    title: snapshot.title,
    mainImage: snapshot.mainImage,
    shopName: snapshot.shopName,
  };
}

async function serializeCartItem(item) {
  const sku = await buildCartSkuSnapshot(item.skuId);
  return {
    itemId: item.itemId,
    skuId: item.skuId,
    quantity: item.quantity,
    sku: sku || {
      skuId: item.skuId,
      spuId: null,
      specJson: {},
      price: 0,
      stock: 0,
      title: '商品已下架',
      mainImage: '',
      shopName: '',
      invalid: true,
    },
  };
}

export async function getCartItems(userId) {
  await expirePendingOrders();
  const items = await userRepo.listCartItems(userId);
  return Promise.all(items.map(serializeCartItem));
}

export async function addCartItem(userId, skuId, quantity) {
  await expirePendingOrders();
  const qty = Number(quantity);
  if (!Number.isInteger(skuId) || skuId <= 0 || !Number.isInteger(qty) || qty < 1) {
    return { error: 'INVALID_INPUT', message: '商品或数量无效' };
  }
  const snapshot = await buildCartSkuSnapshot(skuId);
  if (!snapshot) return { error: 'PRODUCT_NOT_ON_SHELF', message: '商品未上架或不存在' };
  if (snapshot.stock < qty) return { error: 'INSUFFICIENT_STOCK', message: '库存不足' };

  let item = await userRepo.findCartItemBySku(userId, skuId);
  if (item) {
    const newQty = item.quantity + qty;
    if (snapshot.stock < newQty) return { error: 'INSUFFICIENT_STOCK', message: '库存不足' };
    await userRepo.updateCartItemQuantity(item.itemId, newQty);
    item.quantity = newQty;
  } else {
    item = await userRepo.insertCartItem(userId, skuId, qty);
  }
  return { item: await serializeCartItem(item) };
}

export async function updateCartItem(userId, itemId, quantity) {
  await expirePendingOrders();
  const item = await userRepo.findCartItem(userId, itemId);
  if (!item) return { error: 'NOT_FOUND', message: '购物车项不存在' };
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1) {
    return { error: 'INVALID_INPUT', message: '数量无效' };
  }
  const snapshot = await buildCartSkuSnapshot(item.skuId);
  if (!snapshot) return { error: 'PRODUCT_NOT_ON_SHELF', message: '商品已下架' };
  if (snapshot.stock < qty) return { error: 'INSUFFICIENT_STOCK', message: '库存不足' };
  await userRepo.updateCartItemQuantity(itemId, qty);
  item.quantity = qty;
  return { item: await serializeCartItem(item) };
}

export async function deleteCartItem(userId, itemId) {
  await expirePendingOrders();
  const item = await userRepo.findCartItem(userId, itemId);
  if (!item) return { error: 'NOT_FOUND', message: '购物车项不存在' };
  await userRepo.deleteCartItem(itemId);
  return { ok: true };
}

export function findSkuById(skuId) {
  for (const spu of spus) {
    const sku = spu.skus.find((s) => s.skuId === skuId);
    if (sku) return { spu, sku };
  }
  return null;
}

export function lockStock(skuId, quantity) {
  const found = findSkuById(skuId);
  if (!found) return { error: 'SKU_NOT_FOUND', message: 'SKU 不存在' };
  const { sku } = found;
  if (quantity <= 0) return { error: 'INVALID_QTY', message: '数量无效' };
  if (sku.stock.available < quantity) {
    return { error: 'INSUFFICIENT_STOCK', message: '库存不足' };
  }
  sku.stock.available -= quantity;
  sku.stock.locked += quantity;
  return { ok: true };
}

export function releaseStock(skuId, quantity) {
  const found = findSkuById(skuId);
  if (!found) return { error: 'SKU_NOT_FOUND', message: 'SKU 不存在' };
  const { sku } = found;
  const releaseQty = Math.min(quantity, sku.stock.locked);
  sku.stock.locked -= releaseQty;
  sku.stock.available += releaseQty;
  return { ok: true };
}

export function deductStock(skuId, quantity) {
  const found = findSkuById(skuId);
  if (!found) return { error: 'SKU_NOT_FOUND', message: 'SKU 不存在' };
  const { sku } = found;
  const deductQty = Math.min(quantity, sku.stock.locked);
  sku.stock.locked -= deductQty;
  return { ok: true };
}

export async function getPendingProducts(page = 1, pageSize = 20) {
  await expirePendingOrders();
  return productRepo.listPendingProducts(page, pageSize);
}

export async function getProductAuditHistory({ approved, page = 1, pageSize = 20 } = {}) {
  await expirePendingOrders();
  return productRepo.listAuditHistory({ approved, page, pageSize });
}

export function getSpuById(spuId) {
  expirePendingOrders();
  return spus.find((s) => s.spuId === spuId);
}

export async function getAdminProductDetail(spuId) {
  await expirePendingOrders();
  return productRepo.findById(spuId);
}

export async function getPublicProducts(page = 1, pageSize = 20, categoryId, keyword) {
  await expirePendingOrders();
  let categoryIds;
  if (categoryId != null && categoryId !== '') {
    categoryIds = await categoryRepo.getCategoryFilterIds(categoryId);
  }
  return productRepo.listPublicProducts({ page, pageSize, categoryIds, keyword });
}

export async function getCategories() {
  return categoryRepo.listTree();
}

function serializeFavoriteItem(favorite, spu) {
  if (!spu) {
    return {
      favoriteId: favorite.favoriteId,
      spuId: favorite.spuId,
      title: '商品已下架或不存在',
      mainImage: null,
      minPrice: null,
      shopName: null,
      status: 'UNAVAILABLE',
      createdAt: favorite.createdAt,
    };
  }
  const prices = (spu.skus || []).map((s) => s.price);
  return {
    favoriteId: favorite.favoriteId,
    spuId: favorite.spuId,
    title: spu.title,
    mainImage: spu.mainImage,
    minPrice: prices.length ? Math.min(...prices) : null,
    shopName: spu.shopName || null,
    status: spu.status,
    createdAt: favorite.createdAt,
  };
}

export async function getFavorites(userId) {
  const list = await favoriteRepo.listByUser(userId);
  const result = [];
  for (const item of list) {
    const spu = await productRepo.findById(item.spuId);
    result.push(serializeFavoriteItem(item, spu));
  }
  return result;
}

export async function isFavorite(userId, spuId) {
  const item = await favoriteRepo.findByUserAndSpu(userId, Number(spuId));
  return { spuId: Number(spuId), favorited: Boolean(item) };
}

/** 领域规则：仅可收藏已上架 SPU；同一用户同一 SPU 唯一 */
export async function addFavorite(userId, spuId) {
  const id = Number(spuId);
  if (!Number.isInteger(id) || id <= 0) {
    return { error: 'INVALID_INPUT', message: 'spuId 无效' };
  }
  const spu = await productRepo.findById(id);
  if (!spu || spu.status !== 'ON_SHELF') {
    return { error: 'PRODUCT_NOT_ON_SHELF', message: '商品不存在或未上架' };
  }
  const existing = await favoriteRepo.findByUserAndSpu(userId, id);
  if (existing) {
    return { error: 'ALREADY_EXISTS', message: '已收藏该商品', favorite: serializeFavoriteItem(existing, spu) };
  }
  const created = await favoriteRepo.create(userId, id);
  return { favorite: serializeFavoriteItem(created, spu) };
}

export async function removeFavorite(userId, spuId) {
  const id = Number(spuId);
  const removed = await favoriteRepo.remove(userId, id);
  if (!removed) return { error: 'NOT_FOUND', message: '未收藏该商品' };
  return { ok: true };
}

export async function getPublicProductDetail(spuId) {
  await expirePendingOrders();
  return productRepo.findPublicProductDetail(spuId);
}

function normalizeMerchantProductQuery(query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
  const status = query.status ? String(query.status) : undefined;
  const keyword = String(query.keyword || query.q || '').trim();
  return { page, pageSize, status, keyword };
}

function validateBatchSpuIds(payload) {
  if (!Array.isArray(payload?.spuIds) || payload.spuIds.length === 0) {
    return { error: 'INVALID_INPUT', message: 'spuIds is required' };
  }
  const spuIds = [...new Set(payload.spuIds.map((id) => Number(id)).filter((id) => Number.isInteger(id) && id > 0))];
  if (!spuIds.length) return { error: 'INVALID_INPUT', message: 'spuIds is invalid' };
  return { spuIds };
}

export async function getMerchantProducts(merchant, query = {}) {
  await expirePendingOrders();
  const options = normalizeMerchantProductQuery(query);
  if (query.categoryId != null && query.categoryId !== '') {
    const categoryId = Number(query.categoryId);
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return { error: 'INVALID_INPUT', message: 'categoryId is invalid' };
    }
    options.categoryIds = await categoryRepo.getCategoryFilterIds(categoryId);
  }
  return productRepo.listByMerchant(merchant.id, options);
}

export async function getMerchantProductDetail(merchant, spuId) {
  await expirePendingOrders();
  return productRepo.findByMerchant(merchant.id, spuId);
}

export async function getMerchantDashboardSummary(merchant) {
  await expirePendingOrders();
  const productStats = await productRepo.countByMerchantStatus(merchant.id);
  const productCountByStatus = productStats.counts;

  const pendingShipmentOrderCount = await orderRepo.countSubOrdersByMerchant(
    merchant.id,
    'PENDING_SHIPMENT',
  );
  const shippedOrderCount = await orderRepo.countSubOrdersByMerchant(merchant.id, 'SHIPPED');

  return {
    merchantId: merchant.id,
    shopId: merchant.shopId,
    shopName: merchant.shopName,
    productTotal: productStats.total,
    draftProductCount: productCountByStatus.DRAFT || 0,
    pendingAuditProductCount: productCountByStatus.PENDING_AUDIT || 0,
    onShelfProductCount: productCountByStatus.ON_SHELF || 0,
    rejectedProductCount: productCountByStatus.REJECTED || 0,
    offShelfProductCount: productCountByStatus.OFF_SHELF || 0,
    pendingShipmentOrderCount,
    shippedOrderCount,
  };
}

export async function createMerchantProduct(merchant, payload) {
  await expirePendingOrders();
  const validation = validateCreateMerchantProductInput(payload);
  if (validation.error) return validation;

  const category = await categoryRepo.findById(Number(payload.categoryId));
  if (!category) return { error: 'INVALID_INPUT', message: 'Category does not exist' };

  return productRepo.createMerchantProduct(merchant, payload);
}

export async function updateMerchantProduct(merchant, spuId, payload) {
  await expirePendingOrders();
  const validation = validateUpdateMerchantProductInput(payload);
  if (validation.error) return validation;

  const category = await categoryRepo.findById(Number(payload.categoryId));
  if (!category) return { error: 'INVALID_INPUT', message: 'Category does not exist' };

  return productRepo.updateMerchantProduct(merchant, spuId, payload);
}

export async function updateMerchantSkuStock(merchant, skuId, payload) {
  await expirePendingOrders();
  const id = Number(skuId);
  if (!Number.isInteger(id) || id <= 0) {
    return { error: 'INVALID_INPUT', message: 'SKU id is invalid' };
  }
  if (payload?.available == null || payload.available === '') {
    return { error: 'INVALID_INPUT', message: 'available is required' };
  }
  const available = Number(payload.available);
  if (!Number.isInteger(available) || available < 0) {
    return { error: 'INVALID_INPUT', message: 'available must be a non-negative integer' };
  }
  return productRepo.updateMerchantSkuStock(merchant, id, available);
}

export async function submitMerchantProductAudit(merchant, spuId) {
  await expirePendingOrders();
  return productRepo.submitMerchantProductAudit(merchant, spuId);
}

export async function offShelfMerchantProduct(merchant, spuId) {
  await expirePendingOrders();
  return productRepo.offShelfMerchantProduct(merchant, spuId);
}

export async function batchSubmitMerchantProductAudit(merchant, payload) {
  await expirePendingOrders();
  const validation = validateBatchSpuIds(payload);
  if (validation.error) return validation;
  return productRepo.batchSubmitMerchantProductAudit(merchant, validation.spuIds);
}

export async function batchOffShelfMerchantProducts(merchant, payload) {
  await expirePendingOrders();
  const validation = validateBatchSpuIds(payload);
  if (validation.error) return validation;
  return productRepo.batchOffShelfMerchantProducts(merchant, validation.spuIds);
}

export async function auditProduct(spuId, adminId, approved, reason) {
  await expirePendingOrders();
  if (!approved && !reason?.trim()) {
    return { error: 'REASON_REQUIRED', message: '驳回须填写原因' };
  }
  return productRepo.auditProduct(spuId, adminId, approved, reason);
}

function formatAddressSnapshot(address) {
  return {
    receiverName: address.receiverName,
    phone: address.phone,
    fullAddress: `${address.province}${address.city}${address.district}${address.detail}`,
  };
}

function serializeOrder(order, { includeSubOrders = false, afterSales = null } = {}) {
  const activeSubs = (order.subOrders || []).filter((s) => s.status !== 'CANCELLED');
  const canConfirmAllReceipt =
    activeSubs.length > 0 && activeSubs.every((s) => s.status === 'SHIPPED');
  const base = {
    orderId: order.orderId,
    orderNo: order.orderNo,
    status: order.status,
    totalAmount: order.totalAmount,
    items: order.items.map((i) => ({
      skuId: i.skuId,
      title: i.title,
      price: i.price,
      quantity: i.quantity,
    })),
    createdAt: order.createdAt,
    paymentDeadline: order.paymentDeadline,
    autoConfirmDeadline: computeAutoConfirmDeadline(order),
    canConfirmAllReceipt,
  };
  if (includeSubOrders) {
    base.subOrders = order.subOrders.map((s) => ({
      subOrderId: s.subOrderId,
      merchantId: s.merchantId,
      shopName: s.shopName,
      status: s.status,
      items: s.items,
      shipment: s.shipment || null,
      autoConfirmDeadline: computeSubAutoConfirmDeadline(s),
    }));
    base.addressSnapshot = order.addressSnapshot;
  }
  if (afterSales) {
    base.afterSales = afterSales.map(afterSaleRepo.serialize);
  }
  return base;
}

const AFTER_SALE_TYPES = new Set(['REFUND_ONLY', 'RETURN_REFUND']);
const MERCHANT_AFTER_SALE_HOURS = 48;

export async function createOrder(userId, { addressId, items, remark }) {
  await expirePendingOrders();
  if (!Array.isArray(items) || items.length === 0) {
    return { error: 'ITEMS_REQUIRED', message: '请选择商品' };
  }
  const address = await findAddressById(userId, addressId);
  if (!address) return { error: 'ADDRESS_NOT_FOUND', message: '收货地址不存在' };

  const lineItems = [];
  const locked = [];

  for (const raw of items) {
    const skuId = Number(raw.skuId);
    const quantity = Number(raw.quantity);
    if (!Number.isInteger(skuId) || !Number.isInteger(quantity) || skuId <= 0 || quantity < 1) {
      for (const l of locked) await stockRepo.releaseStock(l.skuId, l.quantity);
      return { error: 'INVALID_ITEM', message: '商品项无效' };
    }
    const snapshot = await productRepo.findSkuSnapshot(skuId);
    if (!snapshot) {
      for (const l of locked) await stockRepo.releaseStock(l.skuId, l.quantity);
      return { error: 'SKU_NOT_FOUND', message: 'SKU 不存在' };
    }
    if (snapshot.status !== 'ON_SHELF') {
      for (const l of locked) await stockRepo.releaseStock(l.skuId, l.quantity);
      return { error: 'PRODUCT_NOT_ON_SHELF', message: '商品未上架' };
    }
    const lockResult = await stockRepo.lockStock(skuId, quantity);
    if (lockResult.error) {
      for (const l of locked) await stockRepo.releaseStock(l.skuId, l.quantity);
      return lockResult;
    }
    locked.push({ skuId, quantity });
    lineItems.push({
      skuId,
      spuId: snapshot.spuId,
      merchantId: snapshot.merchantId,
      shopName: snapshot.shopName,
      title: snapshot.title,
      price: snapshot.price,
      quantity,
    });
  }

  const totalAmount = lineItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const now = new Date();
  const paymentDeadline = new Date(now.getTime() + ORDER_PAY_TIMEOUT_MS);

  const byMerchant = new Map();
  for (const item of lineItems) {
    if (!byMerchant.has(item.merchantId)) {
      byMerchant.set(item.merchantId, {
        merchantId: item.merchantId,
        shopName: item.shopName,
        status: 'PENDING_PAYMENT',
        items: [],
      });
    }
    byMerchant.get(item.merchantId).items.push({
      skuId: item.skuId,
      title: item.title,
      price: item.price,
      quantity: item.quantity,
    });
  }

  let order;
  try {
    order = await orderRepo.createOrderRecord({
      userId,
      status: 'PENDING_PAYMENT',
      totalAmount,
      remark: remark || null,
      addressId,
      addressSnapshot: formatAddressSnapshot(address),
      createdAt: now,
      paymentDeadline,
      lineItems,
      subOrderGroups: [...byMerchant.values()],
    });
  } catch (err) {
    for (const l of locked) await stockRepo.releaseStock(l.skuId, l.quantity);
    throw err;
  }

  // 领域规则：下单成功后，购物车中对应 SKU 应移除（含购物车结算与立即购买）
  await userRepo.deleteCartItemsBySkuIds(
    userId,
    lineItems.map((item) => item.skuId),
  );

  return { order: serializeOrder(order, { includeSubOrders: true }) };
}

export async function getOrdersByUser(userId, status) {
  await expirePendingOrders();
  const list = await orderRepo.listByUser(userId, status);
  return {
    total: list.length,
    list: list.map((o) => serializeOrder(o)),
  };
}

export async function getOrderById(userId, orderId) {
  await expirePendingOrders();
  const order = await orderRepo.findByIdAndUser(orderId, userId);
  if (!order) return null;
  const afterSales = await afterSaleRepo.listByOrderId(orderId);
  return serializeOrder(order, { includeSubOrders: true, afterSales });
}

/** 领域规则：按 SKU 申请售后；一单可多笔；整件 quantity=剩余可售后量 */
export async function createAfterSale(userId, orderId, { type, reason, subOrderId, items } = {}) {
  await expirePendingOrders();
  if (!AFTER_SALE_TYPES.has(type)) {
    return { error: 'INVALID_TYPE', message: '售后类型无效' };
  }
  if (!reason?.trim()) {
    return { error: 'REASON_REQUIRED', message: '请填写售后原因' };
  }

  const order = await orderRepo.findByIdAndUser(orderId, userId);
  if (!order) return { error: 'NOT_FOUND', message: '订单不存在' };
  if (!['SHIPPED', 'COMPLETED', 'REFUNDING'].includes(order.status)) {
    return { error: 'INVALID_STATE', message: '仅已发货、已完成或退款中订单可继续申请售后' };
  }

  const existing = await afterSaleRepo.listByOrderId(orderId);
  const occupiedBySku = getOccupiedQtyBySku(existing);

  let sub = null;
  if (subOrderId) {
    sub = order.subOrders.find((s) => s.subOrderId === Number(subOrderId));
    if (!sub) return { error: 'SUB_ORDER_NOT_FOUND', message: '子订单不存在' };
  }

  const remainingBySub = new Map();
  for (const s of order.subOrders || []) {
    if (!['SHIPPED', 'COMPLETED', 'REFUNDING'].includes(s.status)) continue;
    remainingBySub.set(s.subOrderId, buildRemainingItemsForSub(s, occupiedBySku));
  }

  let selectedLines = [];
  if (Array.isArray(items) && items.length > 0) {
    const want = items.map((it) => ({
      skuId: Number(it.skuId),
      quantity: Number(it.quantity),
    }));
    for (const w of want) {
      if (!Number.isInteger(w.skuId) || w.skuId <= 0) {
        return { error: 'INVALID_INPUT', message: 'skuId 无效' };
      }
      if (!Number.isInteger(w.quantity) || w.quantity <= 0) {
        return { error: 'INVALID_INPUT', message: 'quantity 须为正整数' };
      }
    }

    // 定位子单：显式 subOrderId，或由 SKU 唯一归属推断
    if (!sub) {
      const candidates = [];
      for (const [sid, remain] of remainingBySub.entries()) {
        const ids = new Set(remain.map((r) => r.skuId));
        if (want.every((w) => ids.has(w.skuId))) candidates.push(sid);
      }
      if (candidates.length === 1) {
        sub = order.subOrders.find((s) => s.subOrderId === candidates[0]);
      } else if (candidates.length === 0) {
        return { error: 'INVALID_INPUT', message: '所选商品不在可售后子单中，或已无剩余可售后数量' };
      } else {
        return { error: 'INVALID_INPUT', message: '请指定 subOrderId（所选商品可能跨店）' };
      }
    }

    const remainList = remainingBySub.get(sub.subOrderId) || [];
    const remainMap = new Map(remainList.map((r) => [r.skuId, r]));
    for (const w of want) {
      const rem = remainMap.get(w.skuId);
      if (!rem) {
        return { error: 'INVALID_STATE', message: `SKU ${w.skuId} 无可售后剩余数量` };
      }
      // 本迭代：整件售后
      if (w.quantity !== rem.quantity) {
        return {
          error: 'INVALID_INPUT',
          message: `SKU ${w.skuId} 须整件申请，剩余可售后数量为 ${rem.quantity}`,
        };
      }
      selectedLines.push({
        skuId: rem.skuId,
        title: rem.title,
        price: rem.price,
        quantity: rem.quantity,
      });
    }
  } else {
    // 兼容旧调用：未传 items 时，对该子单全部剩余商品整单申请
    if (!sub) {
      sub =
        order.subOrders.find((s) => ['SHIPPED', 'COMPLETED', 'REFUNDING'].includes(s.status)) ||
        order.subOrders[0];
    }
    if (!sub) return { error: 'SUB_ORDER_NOT_FOUND', message: '子订单不存在' };
    selectedLines = remainingBySub.get(sub.subOrderId) || [];
    if (!selectedLines.length) {
      return { error: 'INVALID_STATE', message: '该子单没有可申请售后的商品' };
    }
    selectedLines = selectedLines.map((r) => ({
      skuId: r.skuId,
      title: r.title,
      price: r.price,
      quantity: r.quantity,
    }));
  }

  if (!selectedLines.length) {
    return { error: 'INVALID_INPUT', message: '请选择要售后的商品' };
  }

  const now = new Date();
  const merchantDeadline = new Date(now.getTime() + MERCHANT_AFTER_SALE_HOURS * 60 * 60 * 1000);
  const created = await afterSaleRepo.create({
    orderId: order.orderId,
    orderNo: order.orderNo,
    subOrderId: sub.subOrderId,
    userId,
    merchantId: sub.merchantId,
    shopName: sub.shopName,
    type,
    reason: reason.trim(),
    status: 'APPLIED',
    appliedAt: now,
    merchantDeadline,
    items: selectedLines,
  });

  if (order.status !== 'REFUNDING') {
    await orderRepo.updateOrder(order.orderId, { status: 'REFUNDING' });
  }
  if (sub.status !== 'REFUNDING') {
    await orderRepo.updateSubOrderStatus(sub.subOrderId, 'REFUNDING');
  }

  return { afterSale: afterSaleRepo.serialize(created) };
}

/** 领域规则：APPLIED/REJECTED → ESCALATED（用户申请平台介入） */
export async function escalateAfterSale(userId, orderId, afterSaleId) {
  await expirePendingOrders();
  const order = await orderRepo.findByIdAndUser(orderId, userId);
  if (!order) return { error: 'NOT_FOUND', message: '订单不存在' };

  const item = await afterSaleRepo.findById(afterSaleId);
  if (!item || item.orderId !== orderId || item.userId !== userId) {
    return { error: 'NOT_FOUND', message: '售后单不存在' };
  }
  if (!['APPLIED', 'REJECTED'].includes(item.status)) {
    return { error: 'INVALID_STATE', message: '当前售后状态不可申请平台介入' };
  }

  const updated = await afterSaleRepo.escalate(afterSaleId, new Date());
  if (order.status !== 'REFUNDING') {
    await orderRepo.updateOrder(order.orderId, { status: 'REFUNDING' });
  }
  try {
    await ensureUserCsThread(userId, afterSaleId);
  } catch (err) {
    console.warn('auto create chat thread failed:', err.message);
  }
  return { afterSale: afterSaleRepo.serialize(updated) };
}

export async function getAdminOrders({ orderNo, userId, merchantId, status, page = 1, pageSize = 20 } = {}) {
  await expirePendingOrders();
  const { total, list } = await orderRepo.listAdmin({ orderNo, userId, merchantId, status, page, pageSize });
  return {
    total,
    list: list.map((o) => ({
      ...serializeOrder(o),
      userId: o.userId,
    })),
  };
}

export async function getAdminOrderById(orderId) {
  await expirePendingOrders();
  const order = await orderRepo.findById(orderId);
  if (!order) return null;
  return {
    ...serializeOrder(order, { includeSubOrders: true }),
    userId: order.userId,
  };
}

export async function payOrder(userId, orderId) {
  await expirePendingOrders();
  const order = await orderRepo.findByIdAndUser(orderId, userId);
  if (!order) return { error: 'NOT_FOUND', message: '订单不存在' };
  if (order.status !== 'PENDING_PAYMENT') {
    return { error: 'INVALID_STATE', message: '订单状态不允许支付' };
  }
  if (new Date(order.paymentDeadline).getTime() < Date.now()) {
    for (const item of order.items) await stockRepo.releaseStock(item.skuId, item.quantity);
    const now = new Date().toISOString();
    await orderRepo.updateOrder(order.orderId, {
      status: 'CANCELLED',
      cancelledAt: now,
      cancelReason: 'PAYMENT_TIMEOUT',
    });
    await orderRepo.updateSubOrdersByOrder(order.orderId, 'PENDING_PAYMENT', 'CANCELLED');
    return { error: 'PAYMENT_TIMEOUT', message: '订单已超时关闭' };
  }

  for (const item of order.items) {
    const r = await stockRepo.deductStock(item.skuId, item.quantity);
    if (r.error) return r;
  }

  const paidAt = new Date();
  const payment = await orderRepo.insertPayment({
    orderId: order.orderId,
    userId,
    amount: order.totalAmount,
    channel: 'MOCK',
    status: 'SUCCESS',
    paidAt,
  });

  await orderRepo.updateOrder(order.orderId, {
    status: 'PENDING_SHIPMENT',
    paidAt: paidAt.toISOString(),
  });
  await orderRepo.updateSubOrdersByOrder(order.orderId, 'PENDING_PAYMENT', 'PENDING_SHIPMENT');

  const updated = await orderRepo.findById(order.orderId);
  return { order: serializeOrder(updated, { includeSubOrders: true }), payment };
}

export async function cancelOrder(userId, orderId) {
  await expirePendingOrders();
  const order = await orderRepo.findByIdAndUser(orderId, userId);
  if (!order) return { error: 'NOT_FOUND', message: '订单不存在' };
  if (order.status !== 'PENDING_PAYMENT') {
    return { error: 'INVALID_STATE', message: '仅待支付订单可取消' };
  }
  for (const item of order.items) await stockRepo.releaseStock(item.skuId, item.quantity);
  const now = new Date().toISOString();
  await orderRepo.updateOrder(order.orderId, {
    status: 'CANCELLED',
    cancelledAt: now,
    cancelReason: 'USER_CANCEL',
  });
  await orderRepo.updateSubOrdersByOrder(order.orderId, 'PENDING_PAYMENT', 'CANCELLED');
  const updated = await orderRepo.findById(order.orderId);
  return { order: serializeOrder(updated, { includeSubOrders: true }) };
}

/** 领域：子单 SHIPPED → COMPLETED；主单全部完成后聚合 COMPLETED */
export async function confirmSubOrderReceipt(userId, orderId, subOrderId) {
  await expirePendingOrders();
  const order = await orderRepo.findByIdAndUser(orderId, userId);
  if (!order) return { error: 'NOT_FOUND', message: '订单不存在' };
  const sub = order.subOrders.find((s) => s.subOrderId === Number(subOrderId));
  if (!sub) return { error: 'NOT_FOUND', message: '子订单不存在' };
  if (sub.status !== 'SHIPPED') {
    return { error: 'INVALID_STATE', message: '仅已发货的店铺包裹可确认收货' };
  }
  await orderRepo.updateSubOrderStatus(sub.subOrderId, 'COMPLETED');
  const fresh = await orderRepo.findById(order.orderId);
  const updated = await syncMainOrderFulfillmentStatus(fresh);
  return { order: serializeOrder(updated, { includeSubOrders: true }) };
}

/**
 * 整单确认：仅当全部活跃子单均为 SHIPPED 时，一次性确认所有店铺。
 * 若仍有未发货子单 → 409，引导按子单确认。
 */
export async function confirmOrderReceipt(userId, orderId) {
  await expirePendingOrders();
  const order = await orderRepo.findByIdAndUser(orderId, userId);
  if (!order) return { error: 'NOT_FOUND', message: '订单不存在' };
  const active = (order.subOrders || []).filter((s) => s.status !== 'CANCELLED');
  if (!active.length) {
    return { error: 'INVALID_STATE', message: '订单没有可确认的包裹' };
  }
  if (active.some((s) => s.status === 'PENDING_SHIPMENT' || s.status === 'PAID')) {
    return {
      error: 'INVALID_STATE',
      message: '仍有商品未发货，请对已发货的店铺分别确认收货',
    };
  }
  if (!active.every((s) => s.status === 'SHIPPED' || s.status === 'COMPLETED')) {
    return { error: 'INVALID_STATE', message: '当前订单状态不允许整单确认收货' };
  }
  if (!active.some((s) => s.status === 'SHIPPED')) {
    return { error: 'INVALID_STATE', message: '没有待确认收货的包裹' };
  }
  for (const sub of active) {
    if (sub.status === 'SHIPPED') {
      await orderRepo.updateSubOrderStatus(sub.subOrderId, 'COMPLETED');
    }
  }
  const fresh = await orderRepo.findById(order.orderId);
  const updated = await syncMainOrderFulfillmentStatus(fresh);
  return { order: serializeOrder(updated, { includeSubOrders: true }) };
}

export async function getSubOrdersByMerchant(merchantId, status) {
  await expirePendingOrders();
  const list = await orderRepo.listSubOrdersByMerchant(merchantId, status);
  return { total: list.length, list };
}

export async function shipSubOrder(merchantId, subOrderId, { logisticsCompany, trackingNo }) {
  await expirePendingOrders();
  if (!logisticsCompany?.trim() || !trackingNo?.trim()) {
    return { error: 'INVALID_INPUT', message: '请填写物流公司与运单号' };
  }
  const ctx = await orderRepo.findSubOrderContext(subOrderId);
  if (!ctx) return { error: 'NOT_FOUND', message: '子订单不存在' };
  const { order, subOrder: sub } = ctx;
  if (sub.merchantId !== merchantId) {
    return { error: 'FORBIDDEN', message: '无权操作该子订单' };
  }
  if (sub.status !== 'PENDING_SHIPMENT') {
    return { error: 'INVALID_STATE', message: '子订单状态不允许发货' };
  }
  const shipment = {
    logisticsCompany: logisticsCompany.trim(),
    trackingNo: trackingNo.trim(),
    shippedAt: new Date().toISOString(),
  };
  await orderRepo.shipSubOrder(subOrderId, shipment);

  const updated = await orderRepo.findById(order.orderId);
  const synced = await syncMainOrderFulfillmentStatus(updated);
  const updatedSub = synced.subOrders.find((s) => s.subOrderId === subOrderId);

  return { subOrder: updatedSub, orderId: order.orderId, orderStatus: synced.status };
}

export async function getMerchantAfterSales(merchantId, status) {
  await expirePendingOrders();
  const list = await afterSaleRepo.listByMerchant(merchantId, status);
  return {
    total: list.length,
    list: list.map(afterSaleRepo.serialize),
  };
}

export async function auditMerchantAfterSale(merchantId, afterSaleId, { approved, reason } = {}) {
  await expirePendingOrders();
  if (typeof approved !== 'boolean') {
    return { error: 'INVALID_INPUT', message: 'approved 必须是布尔值' };
  }
  if (!approved && !reason?.trim()) {
    return { error: 'REASON_REQUIRED', message: '拒绝售后必须填写原因' };
  }

  const item = await afterSaleRepo.findById(afterSaleId);
  if (!item) return { error: 'NOT_FOUND', message: '售后单不存在' };
  if (item.merchantId !== merchantId) return { error: 'FORBIDDEN', message: '无权处理该售后单' };
  if (item.status !== 'APPLIED') {
    if (item.status === 'ESCALATED') {
      return { error: 'INVALID_STATE', message: '该售后单已进入平台仲裁，商家不能处理' };
    }
    return { error: 'INVALID_STATE', message: '该售后单当前状态不允许处理' };
  }

  if (approved) {
    return approveAfterSale(item, {
      auditReason: reason?.trim() || '商家同意售后',
    });
  }
  return closeRejectedAfterSale(item, reason);
}

/** 领域规则：ESCALATED → 同意/拒绝；REFUND_ONLY 直接退款，RETURN_REFUND 停在 APPROVED */
export async function arbitrateAfterSale(afterSaleId, { approved, reason } = {}) {
  await expirePendingOrders();
  if (typeof approved !== 'boolean') {
    return { error: 'INVALID_INPUT', message: 'approved 必须是布尔值' };
  }
  if (!approved && !reason?.trim()) {
    return { error: 'REASON_REQUIRED', message: '拒绝售后必须填写原因' };
  }

  const item = await afterSaleRepo.findById(afterSaleId);
  if (!item) return { error: 'NOT_FOUND', message: '售后单不存在' };
  if (item.status !== 'ESCALATED') {
    return { error: 'INVALID_STATE', message: '仅待仲裁（ESCALATED）售后可由平台裁定' };
  }

  if (approved) {
    return approveAfterSale(item, {
      auditReason: reason?.trim() || '平台仲裁同意',
    });
  }
  return closeRejectedAfterSale(item, reason);
}

export async function getDashboardSummary() {
  await expirePendingOrders();
  const productSummary = await productRepo.getDashboardProductSummary();
  const pendingMerchantCount = await merchantApplicationRepo.countByStatus('PENDING');
  const auditedProductCount = await productAuditRepo.countAll();
  const recentPendingMerchants = await merchantApplicationRepo.findRecentPending(5);
  const escalatedAfterSaleCount = await afterSaleRepo.countByStatus('ESCALATED');
  const recentEscalatedAfterSales = await afterSaleRepo.listRecentEscalated(5);

  return {
    pendingProductCount: productSummary.pendingProductCount,
    escalatedAfterSaleCount,
    pendingMerchantCount,
    auditedProductCount,
    onShelfProductCount: productSummary.onShelfProductCount,
    rejectedProductCount: productSummary.rejectedProductCount,
    totalOrderCount: await orderRepo.countOrders(),
    pendingPaymentOrderCount: await orderRepo.countOrders('PENDING_PAYMENT'),
    recentPendingProducts: productSummary.recentPendingProducts,
    recentPendingMerchants: recentPendingMerchants.map(serializeMerchantApplicationPending),
    recentEscalatedAfterSales: recentEscalatedAfterSales.map(afterSaleRepo.serialize),
  };
}

export async function getEscalatedAfterSales(page = 1, pageSize = 20) {
  return getAdminAfterSales({ status: 'ESCALATED', page, pageSize });
}

/** status: ESCALATED | REFUNDED | REJECTED | COMPLETED | ALL */
export async function getAdminAfterSales({ status = 'ESCALATED', page = 1, pageSize = 20 } = {}) {
  await expirePendingOrders();
  const { total, list } = await afterSaleRepo.listAdmin({ status, page, pageSize });
  return {
    total,
    list: list.map(afterSaleRepo.serialize),
  };
}

export async function getPendingMerchants() {
  expirePendingOrders();
  const list = await merchantApplicationRepo.findPending();
  return list.map(serializeMerchantApplicationPending);
}

function serializeMerchantApplicationPending({ merchantId, shopName, contactName, contactPhone, appliedAt }) {
  return { merchantId, shopName, contactName, contactPhone, appliedAt };
}

function serializeMerchantApplication(app) {
  return {
    merchantId: app.merchantId,
    shopName: app.shopName,
    contactName: app.contactName,
    contactPhone: app.contactPhone,
    status: app.status,
    appliedAt: app.appliedAt,
    auditedAt: app.auditedAt || undefined,
    rejectReason: app.rejectReason || undefined,
    approvedMerchantId: app.approvedMerchantId || undefined,
    merchantUsername: app.merchantUsername || undefined,
  };
}

export async function getMerchantApplications({ status, page = 1, pageSize = 20 } = {}) {
  expirePendingOrders();
  const { total, list } = await merchantApplicationRepo.listApplications({ status, page, pageSize });
  return {
    total,
    list: list.map(serializeMerchantApplication),
  };
}

export async function submitMerchantApplication({ shopName, contactName, contactPhone }) {
  expirePendingOrders();
  const name = shopName?.trim();
  const contact = contactName?.trim();
  const phone = contactPhone?.trim();
  if (!name || !contact || !phone) {
    return { error: 'INVALID_INPUT', message: '请填写店铺名称、联系人和联系电话' };
  }
  const pending = await merchantApplicationRepo.findPendingByPhone(phone);
  if (pending) {
    return { error: 'DUPLICATE_PENDING', message: '该手机号已有待审核申请，请耐心等待' };
  }
  const approved = await merchantApplicationRepo.findApprovedByPhone(phone);
  if (approved) {
    return { error: 'ALREADY_APPROVED', message: '该手机号已完成入驻' };
  }

  const application = await merchantApplicationRepo.insertApplication({
    shopName: name,
    contactName: contact,
    contactPhone: phone,
    appliedAt: new Date(),
  });
  return {
    application: serializeMerchantApplication(application),
    message: '入驻申请已提交，请等待平台审核',
  };
}

export async function getMerchantApplicationByPhone(contactPhone) {
  expirePendingOrders();
  const phone = contactPhone?.trim();
  if (!phone) return { error: 'INVALID_INPUT', message: '请提供联系电话' };
  const list = await merchantApplicationRepo.findByPhone(phone);
  if (!list.length) return { error: 'NOT_FOUND', message: '未找到该手机号的入驻申请' };
  return { list: list.map(serializeMerchantApplication) };
}

export async function auditMerchantApplication(applicationId, adminId, approved, reason) {
  expirePendingOrders();
  if (!approved && !reason?.trim()) {
    return { error: 'REASON_REQUIRED', message: '驳回须填写原因' };
  }
  return merchantApplicationRepo.auditApplication(applicationId, adminId, approved, reason);
}

function buildAfterSaleCardPayload(item) {
  const amount = (item.items || []).reduce(
    (sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0),
    0,
  );
  return {
    afterSaleId: item.afterSaleId,
    orderId: item.orderId,
    orderNo: item.orderNo,
    shopName: item.shopName,
    type: item.type,
    status: item.status,
    reason: item.reason,
    amount,
  };
}

function buildOrderMerchantCardPayload(order, sub) {
  const items = sub.items || [];
  const amount = items.reduce((sum, it) => sum + Number(it.price || 0) * Number(it.quantity || 0), 0);
  return {
    afterSaleId: null,
    orderId: order.orderId,
    orderNo: order.orderNo,
    shopName: sub.shopName,
    merchantId: sub.merchantId,
    orderStatus: order.status,
    subOrderStatus: sub.status,
    amount,
    itemTitles: items.map((it) => it.title).filter(Boolean).slice(0, 3),
  };
}

async function enrichThread(thread) {
  if (!thread) return null;
  if (thread.afterSaleId) {
    const item = await afterSaleRepo.findById(thread.afterSaleId);
    return {
      ...thread,
      afterSaleStatus: item ? item.status : null,
      merchantId: thread.merchantId ?? (item ? item.merchantId : null),
      shopName: item ? item.shopName : null,
    };
  }
  let shopName = null;
  if (thread.orderId && thread.merchantId) {
    const order = await orderRepo.findById(thread.orderId);
    const sub = order?.subOrders?.find((s) => s.merchantId === thread.merchantId);
    shopName = sub?.shopName || null;
  }
  return {
    ...thread,
    afterSaleStatus: null,
    merchantId: thread.merchantId,
    shopName,
  };
}

async function assertThreadAccess(actor, thread) {
  if (!thread) return { error: 'NOT_FOUND', message: '会话不存在' };
  if (actor.kind === 'user') {
    if (thread.userId !== actor.user.id) {
      return { error: 'FORBIDDEN', message: '无权访问该会话' };
    }
    return null;
  }
  if (actor.kind === 'admin') {
    if (thread.type !== 'USER_CS') {
      return { error: 'FORBIDDEN', message: '客服仅可访问平台客服会话' };
    }
    return null;
  }
  if (actor.kind === 'merchant') {
    if (thread.type !== 'USER_MERCHANT') {
      return { error: 'FORBIDDEN', message: '商家仅可访问商家会话' };
    }
    if (thread.merchantId != null && thread.merchantId === actor.merchant.id) {
      return null;
    }
    if (thread.afterSaleId) {
      const item = await afterSaleRepo.findById(thread.afterSaleId);
      if (item && item.merchantId === actor.merchant.id) return null;
    }
    return { error: 'FORBIDDEN', message: '无权访问该会话' };
  }
  return { error: 'FORBIDDEN', message: '无权访问该会话' };
}

/** 幂等：用户开聊 / 取已有 USER_CS 会话（新建仅 ESCALATED，与前端「联系平台客服」一致） */
export async function ensureUserCsThread(userId, afterSaleId) {
  const item = await afterSaleRepo.findById(afterSaleId);
  if (!item) return { error: 'NOT_FOUND', message: '售后单不存在' };
  if (item.userId !== userId) return { error: 'FORBIDDEN', message: '无权操作该售后' };

  const existing = await chatRepo.findOpenThreadByAfterSale(afterSaleId, 'USER_CS');
  if (existing) {
    return { thread: await enrichThread(existing), created: false };
  }

  if (item.status !== 'ESCALATED') {
    return {
      error: 'INVALID_STATE',
      message: '请先申请平台介入后再联系客服',
    };
  }

  let thread;
  try {
    thread = await chatRepo.createThread({
      afterSaleId: item.afterSaleId,
      orderId: item.orderId,
      orderNo: item.orderNo,
      userId: item.userId,
      type: 'USER_CS',
    });
  } catch (err) {
    const again = await chatRepo.findOpenThreadByAfterSale(afterSaleId, 'USER_CS');
    if (again) return { thread: await enrichThread(again), created: false };
    throw err;
  }

  await chatRepo.createMessage({
    threadId: thread.id,
    senderType: 'SYSTEM',
    senderId: null,
    msgType: 'TEXT',
    content: '已接入平台客服会话，请描述您的问题。客服可查看订单与售后卡片并协助仲裁。',
    payload: null,
  });
  await chatRepo.createMessage({
    threadId: thread.id,
    senderType: 'SYSTEM',
    senderId: null,
    msgType: 'CARD',
    content: '售后订单卡片',
    payload: buildAfterSaleCardPayload(item),
  });

  return { thread: await enrichThread(thread), created: true };
}

/** 用户新建售后商家会话：协商期 + 寄回履约期问物流/地址 */
const USER_MERCHANT_CHAT_CREATE_STATUSES = new Set([
  'APPLIED',
  'REJECTED',
  'APPROVED',
  'RETURNING',
]);
/** 商家新建/进入售后会话：含履约中售后与拒绝后协商；仲裁/已退款仅打开已有或建只读会话 */
const MERCHANT_CHAT_CREATE_STATUSES = new Set([
  'APPLIED',
  'APPROVED',
  'RETURNING',
  'REJECTED',
  'ESCALATED',
  'REFUNDED',
]);

/**
 * 幂等：USER_MERCHANT 开聊。
 * actor: { kind:'user', user } | { kind:'merchant', merchant }
 * 已有 OPEN 会话直接返回；新建状态见 USER_/MERCHANT_CHAT_CREATE_STATUSES。
 */
export async function ensureUserMerchantThread(actor, afterSaleId) {
  const item = await afterSaleRepo.findById(afterSaleId);
  if (!item) return { error: 'NOT_FOUND', message: '售后单不存在' };

  if (actor.kind === 'user') {
    if (item.userId !== actor.user.id) return { error: 'FORBIDDEN', message: '无权操作该售后' };
  } else if (actor.kind === 'merchant') {
    if (item.merchantId !== actor.merchant.id) return { error: 'FORBIDDEN', message: '无权操作该售后' };
  } else {
    return { error: 'FORBIDDEN', message: '无权操作该售后' };
  }

  const existing = await chatRepo.findOpenThreadByAfterSale(afterSaleId, 'USER_MERCHANT');
  if (existing) {
    return { thread: await enrichThread(existing), created: false };
  }

  const allowed =
    actor.kind === 'merchant'
      ? MERCHANT_CHAT_CREATE_STATUSES.has(item.status)
      : USER_MERCHANT_CHAT_CREATE_STATUSES.has(item.status);
  if (!allowed) {
    return { error: 'INVALID_STATE', message: '当前售后状态不可新建商家会话' };
  }

  let thread;
  try {
    thread = await chatRepo.createThread({
      afterSaleId: item.afterSaleId,
      orderId: item.orderId,
      orderNo: item.orderNo,
      userId: item.userId,
      merchantId: item.merchantId,
      type: 'USER_MERCHANT',
    });
  } catch (err) {
    const again = await chatRepo.findOpenThreadByAfterSale(afterSaleId, 'USER_MERCHANT');
    if (again) return { thread: await enrichThread(again), created: false };
    throw err;
  }

  await chatRepo.createMessage({
    threadId: thread.id,
    senderType: 'SYSTEM',
    senderId: null,
    msgType: 'TEXT',
    content: `已接入与「${item.shopName || '商家'}」的沟通，请说明售后问题。协商不成可申请平台介入。`,
    payload: null,
  });
  await chatRepo.createMessage({
    threadId: thread.id,
    senderType: 'SYSTEM',
    senderId: null,
    msgType: 'CARD',
    content: '售后订单卡片',
    payload: buildAfterSaleCardPayload(item),
  });

  return { thread: await enrichThread(thread), created: true };
}

/**
 * 订单级 USER_MERCHANT：待发货沟通（改色/催发货等）
 * body: { merchantId } | { subOrderId }
 */
export async function ensureOrderMerchantThread(userId, orderId, body = {}) {
  const order = await orderRepo.findByIdAndUser(orderId, userId);
  if (!order) return { error: 'NOT_FOUND', message: '订单不存在' };

  let merchantId = body.merchantId != null ? Number(body.merchantId) : null;
  let sub = null;
  if (body.subOrderId != null) {
    const subOrderId = Number(body.subOrderId);
    sub = (order.subOrders || []).find((s) => s.subOrderId === subOrderId);
    if (!sub) return { error: 'NOT_FOUND', message: '子订单不存在' };
    merchantId = sub.merchantId;
  } else if (merchantId != null) {
    sub = (order.subOrders || []).find((s) => s.merchantId === merchantId);
    if (!sub) return { error: 'NOT_FOUND', message: '订单中无该商家子单' };
  } else {
    return { error: 'INVALID_INPUT', message: '请提供 merchantId 或 subOrderId' };
  }

  const allowedOrder = ['PENDING_SHIPMENT', 'PAID', 'SHIPPED', 'COMPLETED', 'REFUNDING'].includes(order.status);
  const allowedSub = ['PENDING_SHIPMENT', 'PAID', 'SHIPPED', 'COMPLETED', 'REFUNDING'].includes(sub.status);
  // 产品要求：未发货即可联系；已发货也可继续沟通
  if (!allowedOrder || !allowedSub) {
    return { error: 'INVALID_STATE', message: '当前订单状态不可联系商家' };
  }
  if (['CANCELLED', 'REFUNDED'].includes(order.status) || ['CANCELLED', 'REFUNDED'].includes(sub.status)) {
    return { error: 'INVALID_STATE', message: '当前订单状态不可联系商家' };
  }

  const existing = await chatRepo.findOpenThreadByOrderMerchant(order.orderId, merchantId, 'USER_MERCHANT');
  if (existing) {
    return { thread: await enrichThread(existing), created: false };
  }

  let thread;
  try {
    thread = await chatRepo.createThread({
      afterSaleId: null,
      orderId: order.orderId,
      orderNo: order.orderNo,
      userId: order.userId,
      merchantId,
      type: 'USER_MERCHANT',
    });
  } catch (err) {
    const again = await chatRepo.findOpenThreadByOrderMerchant(order.orderId, merchantId, 'USER_MERCHANT');
    if (again) return { thread: await enrichThread(again), created: false };
    throw err;
  }

  await chatRepo.createMessage({
    threadId: thread.id,
    senderType: 'SYSTEM',
    senderId: null,
    msgType: 'TEXT',
    content: `已接入与「${sub.shopName || '商家'}」的订单沟通，可咨询发货、规格颜色等问题。`,
    payload: null,
  });
  await chatRepo.createMessage({
    threadId: thread.id,
    senderType: 'SYSTEM',
    senderId: null,
    msgType: 'CARD',
    content: '订单卡片',
    payload: buildOrderMerchantCardPayload(order, sub),
  });

  return { thread: await enrichThread(thread), created: true };
}

export async function listChatThreads(actor, { status, type } = {}) {
  if (actor.kind === 'admin') {
    const list = await chatRepo.listThreadsForCs({ status });
    return Promise.all(list.map(enrichThread));
  }
  if (actor.kind === 'merchant') {
    if (type && type !== 'USER_MERCHANT') return [];
    const list = await chatRepo.listThreadsForMerchant(actor.merchant.id, { status });
    return Promise.all(list.map(enrichThread));
  }
  const list = await chatRepo.listThreadsForUser(actor.user.id, { status, type });
  return Promise.all(list.map(enrichThread));
}

export async function getChatMessages(actor, threadId, { afterId } = {}) {
  const thread = await chatRepo.findThreadById(threadId);
  const denied = await assertThreadAccess(actor, thread);
  if (denied) return denied;
  const list = await chatRepo.listMessages(threadId, { afterId });
  return { list };
}

export async function postChatMessage(actor, threadId, body = {}) {
  const thread = await chatRepo.findThreadById(threadId);
  const denied = await assertThreadAccess(actor, thread);
  if (denied) return denied;
  if (thread.status !== 'OPEN') return { error: 'INVALID', message: '会话已关闭' };

  // 领域规则：售后进入平台仲裁或已退款后，商家仅可查看历史，不可再发消息
  if (
    actor.kind === 'merchant'
    && thread.type === 'USER_MERCHANT'
    && thread.afterSaleId
  ) {
    const afterSale = await afterSaleRepo.findById(thread.afterSaleId);
    if (!afterSale) return { error: 'NOT_FOUND', message: '关联售后不存在' };
    if (['ESCALATED', 'REFUNDED'].includes(afterSale.status)) {
      return { error: 'FORBIDDEN', message: '该售后仅可查看历史沟通，商家不能继续发送消息' };
    }
  }

  const msgType = body.msgType || 'TEXT';
  if (msgType !== 'TEXT' && msgType !== 'CARD') {
    return { error: 'INVALID', message: 'msgType 仅支持 TEXT / CARD' };
  }

  let content = (body.content || '').trim();
  let payload = body.payload || null;

  if (msgType === 'TEXT') {
    if (!content) return { error: 'INVALID', message: '消息内容不能为空' };
  } else if (thread.afterSaleId) {
    const item = await afterSaleRepo.findById(thread.afterSaleId);
    if (!item) return { error: 'NOT_FOUND', message: '关联售后不存在' };
    payload = payload || buildAfterSaleCardPayload(item);
    content = content || '售后订单卡片';
  } else {
    const order = await orderRepo.findById(thread.orderId);
    const sub = order?.subOrders?.find((s) => s.merchantId === thread.merchantId);
    if (!order || !sub) return { error: 'NOT_FOUND', message: '关联订单不存在' };
    payload = payload || buildOrderMerchantCardPayload(order, sub);
    content = content || '订单卡片';
  }

  let senderType = 'USER';
  let senderId = null;
  if (actor.kind === 'admin') {
    senderType = 'CS_AGENT';
    senderId = actor.admin.id;
  } else if (actor.kind === 'merchant') {
    senderType = 'MERCHANT';
    senderId = actor.merchant.id;
  } else {
    senderType = 'USER';
    senderId = actor.user.id;
  }

  const message = await chatRepo.createMessage({
    threadId,
    senderType,
    senderId,
    msgType,
    content,
    payload,
  });
  return { message };
}

export async function runChatAction(admin, threadId, actionKey, body = {}) {
  const thread = await chatRepo.findThreadById(threadId);
  if (!thread) return { error: 'NOT_FOUND', message: '会话不存在' };
  if (thread.type !== 'USER_CS') {
    return { error: 'INVALID', message: '该动作仅适用于平台客服会话' };
  }

  const key = String(actionKey || '').toUpperCase();
  if (key === 'HINT_RETURN') {
    const message = await chatRepo.createMessage({
      threadId,
      senderType: 'SYSTEM',
      senderId: admin.id,
      msgType: 'QUICK_ACTION',
      content: '【客服建议】请按页面指引填写退货物流信息寄回商品，商家验收后将完成退款。',
      payload: { actionKey: 'HINT_RETURN' },
    });
    return { message };
  }

  if (key !== 'CS_APPROVE' && key !== 'CS_REJECT') {
    return { error: 'INVALID', message: '未知 actionKey' };
  }

  const approved = key === 'CS_APPROVE';
  const reason = body.reason || (approved ? '平台客服仲裁同意' : '平台客服仲裁拒绝');
  if (!approved && !String(body.reason || '').trim()) {
    return { error: 'REASON_REQUIRED', message: '拒绝须填写原因' };
  }

  const arb = await arbitrateAfterSale(thread.afterSaleId, { approved, reason });
  if (arb.error) return arb;

  const message = await chatRepo.createMessage({
    threadId,
    senderType: 'SYSTEM',
    senderId: admin.id,
    msgType: 'QUICK_ACTION',
    content: approved
      ? '【系统】客服已裁定同意售后，请按后续流程处理。'
      : `【系统】客服已裁定拒绝售后。原因：${reason}`,
    payload: { actionKey: key, approved, reason },
  });
  return { message, afterSale: arb.afterSale };
}

/** 商家快捷：同意/拒绝售后（对接 auditMerchantAfterSale） */
export async function runMerchantChatAction(merchant, threadId, actionKey, body = {}) {
  const thread = await chatRepo.findThreadById(threadId);
  if (!thread) return { error: 'NOT_FOUND', message: '会话不存在' };
  if (thread.type !== 'USER_MERCHANT') {
    return { error: 'INVALID', message: '该动作仅适用于商家会话' };
  }
  if (!thread.afterSaleId) {
    return { error: 'INVALID', message: '订单沟通会话不支持售后快捷动作' };
  }
  const denied = await assertThreadAccess({ kind: 'merchant', merchant }, thread);
  if (denied) return denied;

  const key = String(actionKey || '').toUpperCase();
  if (key !== 'MERCHANT_APPROVE' && key !== 'MERCHANT_REJECT') {
    return { error: 'INVALID', message: '未知 actionKey' };
  }

  const approved = key === 'MERCHANT_APPROVE';
  const reason = body.reason || (approved ? '商家同意售后' : '商家拒绝售后');
  if (!approved && !String(body.reason || '').trim()) {
    return { error: 'REASON_REQUIRED', message: '拒绝须填写原因' };
  }

  const result = await auditMerchantAfterSale(merchant.id, thread.afterSaleId, { approved, reason });
  if (result.error) return result;

  const message = await chatRepo.createMessage({
    threadId,
    senderType: 'SYSTEM',
    senderId: merchant.id,
    msgType: 'QUICK_ACTION',
    content: approved
      ? '【系统】商家已同意售后，请按后续流程处理。'
      : `【系统】商家已拒绝售后。原因：${reason}`,
    payload: { actionKey: key, approved, reason },
  });
  return { message, afterSale: result.afterSale };
}

