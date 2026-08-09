/** Hybrid store: batch 1 + 3 in MySQL; SPU/SKU/stock still in-memory (batch 2). */

import * as adminRepo from '../repositories/adminRepo.js';
import * as merchantRepo from '../repositories/merchantRepo.js';
import * as merchantApplicationRepo from '../repositories/merchantApplicationRepo.js';
import * as productAuditRepo from '../repositories/productAuditRepo.js';
import * as userRepo from '../repositories/userRepo.js';
import * as orderRepo from '../repositories/orderRepo.js';
import * as afterSaleRepo from '../repositories/afterSaleRepo.js';
import * as categoryRepo from '../repositories/categoryRepo.js';
import * as productRepo from '../repositories/productRepo.js';

const ORDER_PAY_TIMEOUT_MS = 15 * 60 * 1000;

// Batch 2: still in-memory (SPU/SKU/stock — see docs/DB_MIGRATION.md)
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
      releaseStock(item.skuId, item.quantity);
    }
    const now = new Date().toISOString();
    await orderRepo.updateOrder(order.orderId, {
      status: 'CANCELLED',
      cancelledAt: now,
      cancelReason: 'PAYMENT_TIMEOUT',
    });
    await orderRepo.updateSubOrdersByOrder(order.orderId, 'PENDING_PAYMENT', 'CANCELLED');
  }
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

function buildCartSkuSnapshot(skuId) {
  const found = findSkuById(skuId);
  if (!found) return null;
  const { spu, sku } = found;
  if (spu.status !== 'ON_SHELF') return null;
  return {
    skuId: sku.skuId,
    specJson: sku.specJson,
    price: sku.price,
    stock: sku.stock?.available ?? 0,
    title: spu.title,
    mainImage: spu.mainImage,
    shopName: spu.shopName,
  };
}

function serializeCartItem(item) {
  const sku = buildCartSkuSnapshot(item.skuId);
  return {
    itemId: item.itemId,
    skuId: item.skuId,
    quantity: item.quantity,
    sku: sku || {
      skuId: item.skuId,
      specJson: {},
      price: 0,
      stock: 0,
      title: '商品已下架',
      mainImage: '',
      shopName: '',
    },
  };
}

export async function getCartItems(userId) {
  await expirePendingOrders();
  const items = await userRepo.listCartItems(userId);
  return items.map(serializeCartItem);
}

export async function addCartItem(userId, skuId, quantity) {
  await expirePendingOrders();
  const qty = Number(quantity);
  if (!skuId || !Number.isInteger(qty) || qty < 1) {
    return { error: 'INVALID_INPUT', message: '商品或数量无效' };
  }
  const snapshot = buildCartSkuSnapshot(skuId);
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
  return { item: serializeCartItem(item) };
}

export async function updateCartItem(userId, itemId, quantity) {
  await expirePendingOrders();
  const item = await userRepo.findCartItem(userId, itemId);
  if (!item) return { error: 'NOT_FOUND', message: '购物车项不存在' };
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 1) {
    return { error: 'INVALID_INPUT', message: '数量无效' };
  }
  const snapshot = buildCartSkuSnapshot(item.skuId);
  if (!snapshot) return { error: 'PRODUCT_NOT_ON_SHELF', message: '商品已下架' };
  if (snapshot.stock < qty) return { error: 'INSUFFICIENT_STOCK', message: '库存不足' };
  await userRepo.updateCartItemQuantity(itemId, qty);
  item.quantity = qty;
  return { item: serializeCartItem(item) };
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

export async function getPublicProducts(page = 1, pageSize = 20, categoryId) {
  await expirePendingOrders();
  let categoryIds;
  if (categoryId != null && categoryId !== '') {
    categoryIds = await categoryRepo.getCategoryFilterIds(categoryId);
  }
  return productRepo.listPublicProducts({ page, pageSize, categoryIds });
}

export async function getCategories() {
  return categoryRepo.listTree();
}

export async function getPublicProductDetail(spuId) {
  await expirePendingOrders();
  return productRepo.findPublicProductDetail(spuId);
}

export async function getMerchantProducts(merchant) {
  await expirePendingOrders();
  return productRepo.listByMerchant(merchant.id);
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

export async function submitMerchantProductAudit(merchant, spuId) {
  await expirePendingOrders();
  return productRepo.submitMerchantProductAudit(merchant, spuId);
}

export async function offShelfMerchantProduct(merchant, spuId) {
  await expirePendingOrders();
  return productRepo.offShelfMerchantProduct(merchant, spuId);
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

function serializeOrder(order, { includeSubOrders = false } = {}) {
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
  };
  if (includeSubOrders) {
    base.subOrders = order.subOrders.map((s) => ({
      subOrderId: s.subOrderId,
      merchantId: s.merchantId,
      shopName: s.shopName,
      status: s.status,
      items: s.items,
      shipment: s.shipment || null,
    }));
    base.addressSnapshot = order.addressSnapshot;
  }
  return base;
}

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
    if (!skuId || !quantity || quantity < 1) {
      for (const l of locked) releaseStock(l.skuId, l.quantity);
      return { error: 'INVALID_ITEM', message: '商品项无效' };
    }
    const found = findSkuById(skuId);
    if (!found) {
      for (const l of locked) releaseStock(l.skuId, l.quantity);
      return { error: 'SKU_NOT_FOUND', message: 'SKU 不存在' };
    }
    const { spu, sku } = found;
    if (spu.status !== 'ON_SHELF') {
      for (const l of locked) releaseStock(l.skuId, l.quantity);
      return { error: 'PRODUCT_NOT_ON_SHELF', message: '商品未上架' };
    }
    const lockResult = lockStock(skuId, quantity);
    if (lockResult.error) {
      for (const l of locked) releaseStock(l.skuId, l.quantity);
      return lockResult;
    }
    locked.push({ skuId, quantity });
    lineItems.push({
      skuId,
      spuId: spu.spuId,
      merchantId: spu.merchantId,
      shopName: spu.shopName,
      title: spu.title,
      price: sku.price,
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

  const order = await orderRepo.createOrderRecord({
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
  return serializeOrder(order, { includeSubOrders: true });
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
    for (const item of order.items) releaseStock(item.skuId, item.quantity);
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
    const r = deductStock(item.skuId, item.quantity);
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
  for (const item of order.items) releaseStock(item.skuId, item.quantity);
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
  const updatedSub = updated.subOrders.find((s) => s.subOrderId === subOrderId);
  const activeSubs = updated.subOrders.filter((s) => s.status !== 'CANCELLED');
  let orderStatus = updated.status;
  if (activeSubs.length > 0 && activeSubs.every((s) => s.status === 'SHIPPED' || s.status === 'COMPLETED')) {
    orderStatus = 'SHIPPED';
  } else if (updated.status === 'PENDING_SHIPMENT' && activeSubs.some((s) => s.status === 'SHIPPED')) {
    orderStatus = 'SHIPPED';
  }
  if (orderStatus !== updated.status) {
    await orderRepo.updateOrder(order.orderId, { status: orderStatus });
  }

  return { subOrder: updatedSub, orderId: order.orderId, orderStatus };
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

  const updated = await afterSaleRepo.updateAudit(afterSaleId, {
    status: approved ? 'APPROVED' : 'REJECTED',
    auditReason: reason?.trim() || null,
    auditedAt: new Date(),
  });
  return { afterSale: afterSaleRepo.serialize(updated) };
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
  await expirePendingOrders();
  const { total, list } = await afterSaleRepo.listEscalated(page, pageSize);
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
