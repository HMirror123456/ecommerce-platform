/** In-memory store for W1 demo. Replace with DB when ready. */

const ORDER_PAY_TIMEOUT_MS = 15 * 60 * 1000;

export const admins = [
  { id: 1, username: 'operator', password: 'operator123', role: 'OPERATOR' },
  { id: 2, username: 'csagent', password: 'cs123', role: 'CS_AGENT' },
];

export const merchants = [
  { id: 1, username: 'merchant1', password: '123456', shopId: 1, shopName: '数码旗舰店' },
  { id: 2, username: 'merchant2', password: '123456', shopId: 2, shopName: '家居生活馆' },
];

export const users = [
  {
    id: 1,
    phone: '13800138000',
    password: '123456',
    nickname: '演示用户',
    addresses: [
      {
        id: 1,
        receiverName: '张三',
        phone: '13800138000',
        province: '北京市',
        city: '北京市',
        district: '朝阳区',
        detail: '建国路 88 号',
        isDefault: true,
      },
    ],
  },
];

export const spus = [
  {
    spuId: 101,
    shopId: 1,
    shopName: '数码旗舰店',
    merchantId: 1,
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
    title: '机械键盘 87 键',
    description: '青轴，RGB 背光',
    mainImage: 'https://picsum.photos/seed/spu103/200/200',
    status: 'PENDING_AUDIT',
    submittedAt: '2026-08-04T10:00:00.000Z',
    skus: [{ skuId: 1004, specJson: { switch: '青轴' }, price: 449, stock: { available: 30, locked: 0 } }],
  },
];

export const productAudits = [];
export const orders = [];
export const payments = [];
export const afterSales = [
  {
    afterSaleId: 1,
    orderId: 1,
    subOrderId: 1,
    userId: 1,
    merchantId: 1,
    shopName: '数码旗舰店',
    type: 'REFUND_ONLY',
    reason: '商品与描述不符，申请仅退款',
    status: 'ESCALATED',
    appliedAt: '2026-08-05T08:00:00.000Z',
    merchantDeadline: '2026-08-07T08:00:00.000Z',
    escalatedAt: '2026-08-07T09:00:00.000Z',
  },
  {
    afterSaleId: 2,
    orderId: 2,
    subOrderId: 2,
    userId: 1,
    merchantId: 2,
    shopName: '家居生活馆',
    type: 'RETURN_REFUND',
    reason: '收到商品有损坏，申请退货退款',
    status: 'ESCALATED',
    appliedAt: '2026-08-05T10:00:00.000Z',
    merchantDeadline: '2026-08-07T10:00:00.000Z',
    escalatedAt: '2026-08-07T11:00:00.000Z',
  },
];
export const merchantApplications = [
  {
    merchantId: 101,
    shopName: '新锐数码店',
    contactName: '李四',
    contactPhone: '13900139000',
    appliedAt: '2026-08-06T06:00:00.000Z',
    status: 'PENDING',
  },
];

let orderSeq = 0;
let subOrderSeq = 0;
let paymentSeq = 0;

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

function serializeMerchantProduct(spu) {
  const product = {
    spuId: spu.spuId,
    shopId: spu.shopId,
    shopName: spu.shopName,
    merchantId: spu.merchantId,
    categoryId: spu.categoryId,
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
  return {
    spuId: spu.spuId,
    title: spu.title,
    mainImage: spu.mainImage,
    minPrice: prices.length ? Math.min(...prices) : 0,
  };
}

function serializePublicProductDetail(spu) {
  return {
    spuId: spu.spuId,
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

function nextOrderNo() {
  orderSeq += 1;
  const ts = Date.now();
  return `ORD${ts}${String(orderSeq).padStart(4, '0')}`;
}

export function expirePendingOrders() {
  const now = Date.now();
  for (const order of orders) {
    if (order.status !== 'PENDING_PAYMENT') continue;
    if (!order.paymentDeadline || new Date(order.paymentDeadline).getTime() > now) continue;
    for (const item of order.items) {
      releaseStock(item.skuId, item.quantity);
    }
    order.status = 'CANCELLED';
    order.cancelledAt = new Date().toISOString();
    order.cancelReason = 'PAYMENT_TIMEOUT';
    for (const sub of order.subOrders) {
      if (sub.status === 'PENDING_PAYMENT') sub.status = 'CANCELLED';
    }
  }
}

export function findAdmin(username, password) {
  return admins.find((a) => a.username === username && a.password === password);
}

export function findAdminById(id) {
  return admins.find((a) => a.id === id);
}

export function findMerchant(username, password) {
  return merchants.find((m) => m.username === username && m.password === password);
}

export function findMerchantById(id) {
  return merchants.find((m) => m.id === id);
}

export function findUserByPhone(phone) {
  return users.find((u) => u.phone === phone);
}

export function findUserById(id) {
  return users.find((u) => u.id === id);
}

export function findAddressById(userId, addressId) {
  const user = findUserById(userId);
  if (!user) return null;
  return user.addresses.find((a) => a.id === addressId) || null;
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

export function getPendingProducts(page = 1, pageSize = 20) {
  expirePendingOrders();
  const list = spus.filter((s) => s.status === 'PENDING_AUDIT');
  const start = (page - 1) * pageSize;
  return {
    total: list.length,
    list: list.slice(start, start + pageSize).map((s) => ({
      spuId: s.spuId,
      title: s.title,
      shopName: s.shopName,
      merchantId: s.merchantId,
      mainImage: s.mainImage,
      submittedAt: s.submittedAt,
    })),
  };
}

export function getSpuById(spuId) {
  expirePendingOrders();
  return spus.find((s) => s.spuId === spuId);
}

export function getAdminProductDetail(spuId) {
  const spu = getSpuById(spuId);
  if (!spu) return null;
  return serializeMerchantProduct(spu);
}

export function getPublicProducts(page = 1, pageSize = 20, categoryId) {
  expirePendingOrders();
  let list = spus.filter((s) => s.status === 'ON_SHELF');
  if (categoryId != null && categoryId !== '') {
    const cid = Number(categoryId);
    if (Number.isInteger(cid)) list = list.filter((s) => s.categoryId === cid);
  }
  const start = (page - 1) * pageSize;
  return {
    total: list.length,
    list: list.slice(start, start + pageSize).map(serializePublicProductSummary),
  };
}

export function getPublicProductDetail(spuId) {
  const spu = getSpuById(spuId);
  if (!spu || spu.status !== 'ON_SHELF') return null;
  return serializePublicProductDetail(spu);
}

export function getMerchantProducts(merchant) {
  expirePendingOrders();
  const list = spus.filter((spu) => ownsSpu(merchant, spu)).map((spu) => serializeMerchantProduct(spu));
  return { total: list.length, list };
}

export function getMerchantDashboardSummary(merchant) {
  expirePendingOrders();
  const merchantProducts = spus.filter((spu) => ownsSpu(merchant, spu));
  const productCountByStatus = merchantProducts.reduce((countMap, spu) => {
    countMap[spu.status] = (countMap[spu.status] || 0) + 1;
    return countMap;
  }, {});

  let pendingShipmentOrderCount = 0;
  let shippedOrderCount = 0;
  for (const order of orders) {
    for (const sub of order.subOrders) {
      if (sub.merchantId !== merchant.id) continue;
      if (sub.status === 'PENDING_SHIPMENT') pendingShipmentOrderCount += 1;
      if (sub.status === 'SHIPPED') shippedOrderCount += 1;
    }
  }

  return {
    merchantId: merchant.id,
    shopId: merchant.shopId,
    shopName: merchant.shopName,
    productTotal: merchantProducts.length,
    draftProductCount: productCountByStatus.DRAFT || 0,
    pendingAuditProductCount: productCountByStatus.PENDING_AUDIT || 0,
    onShelfProductCount: productCountByStatus.ON_SHELF || 0,
    rejectedProductCount: productCountByStatus.REJECTED || 0,
    offShelfProductCount: productCountByStatus.OFF_SHELF || 0,
    pendingShipmentOrderCount,
    shippedOrderCount,
  };
}

export function createMerchantProduct(merchant, payload) {
  expirePendingOrders();
  const validation = validateCreateMerchantProductInput(payload);
  if (validation.error) return validation;

  const spuId = getNextSpuId();
  let skuId = getNextSkuId();
  const spu = {
    spuId,
    shopId: merchant.shopId,
    shopName: merchant.shopName,
    merchantId: merchant.id,
    categoryId: Number(payload.categoryId),
    title: payload.title.trim(),
    description: payload.description.trim(),
    mainImage: payload.mainImage.trim(),
    status: 'DRAFT',
    skus: payload.skus.map((sku) => ({
      skuId: skuId++,
      specJson: sku.specJson,
      price: Number(sku.price),
      stock: {
        available: Number(sku.stock.available),
        locked: 0,
      },
    })),
  };

  spus.push(spu);
  return { product: serializeMerchantProduct(spu) };
}

export function submitMerchantProductAudit(merchant, spuId) {
  expirePendingOrders();
  const spu = getSpuById(spuId);
  if (!spu) return { error: 'NOT_FOUND', message: 'Product not found' };
  if (!ownsSpu(merchant, spu)) {
    return { error: 'FORBIDDEN', message: 'No permission to operate this product' };
  }
  if (spu.status !== 'DRAFT' && spu.status !== 'REJECTED') {
    return { error: 'INVALID_STATE', message: 'Only draft or rejected products can be submitted' };
  }
  spu.status = 'PENDING_AUDIT';
  spu.submittedAt = new Date().toISOString();
  delete spu.rejectReason;
  return {
    spuId: spu.spuId,
    status: spu.status,
    message: 'Product submitted for audit',
  };
}

export function auditProduct(spuId, adminId, approved, reason) {
  expirePendingOrders();
  const spu = getSpuById(spuId);
  if (!spu) return { error: 'NOT_FOUND', message: '商品不存在' };
  if (spu.status !== 'PENDING_AUDIT') {
    return { error: 'INVALID_STATE', message: '商品不在待审核状态' };
  }
  if (!approved && !reason?.trim()) {
    return { error: 'REASON_REQUIRED', message: '驳回须填写原因' };
  }
  spu.status = approved ? 'ON_SHELF' : 'REJECTED';
  if (approved) {
    delete spu.rejectReason;
  } else {
    spu.rejectReason = reason.trim();
  }
  productAudits.push({
    id: productAudits.length + 1,
    spuId,
    adminId,
    approved,
    reason: reason || null,
    auditedAt: new Date().toISOString(),
  });
  return { spu };
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

export function createOrder(userId, { addressId, items, remark }) {
  expirePendingOrders();
  if (!Array.isArray(items) || items.length === 0) {
    return { error: 'ITEMS_REQUIRED', message: '请选择商品' };
  }
  const address = findAddressById(userId, addressId);
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
  const paymentDeadline = new Date(now.getTime() + ORDER_PAY_TIMEOUT_MS).toISOString();

  const orderId = orders.length + 1;
  const byMerchant = new Map();
  for (const item of lineItems) {
    if (!byMerchant.has(item.merchantId)) {
      byMerchant.set(item.merchantId, {
        merchantId: item.merchantId,
        shopName: item.shopName,
        items: [],
      });
    }
    const group = byMerchant.get(item.merchantId);
    group.items.push({
      skuId: item.skuId,
      title: item.title,
      price: item.price,
      quantity: item.quantity,
    });
  }

  const subOrders = [];
  for (const group of byMerchant.values()) {
    subOrderSeq += 1;
    subOrders.push({
      subOrderId: subOrderSeq,
      merchantId: group.merchantId,
      shopName: group.shopName,
      status: 'PENDING_PAYMENT',
      items: group.items,
      shipment: null,
    });
  }

  const order = {
    orderId,
    orderNo: nextOrderNo(),
    userId,
    status: 'PENDING_PAYMENT',
    totalAmount,
    remark: remark || null,
    addressId,
    addressSnapshot: formatAddressSnapshot(address),
    items: lineItems.map(({ skuId, title, price, quantity }) => ({ skuId, title, price, quantity })),
    subOrders,
    createdAt: now.toISOString(),
    paymentDeadline,
    paidAt: null,
    cancelledAt: null,
    cancelReason: null,
  };
  orders.push(order);
  return { order: serializeOrder(order, { includeSubOrders: true }) };
}

export function getOrdersByUser(userId, status) {
  expirePendingOrders();
  let list = orders.filter((o) => o.userId === userId);
  if (status) list = list.filter((o) => o.status === status);
  list = [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return {
    total: list.length,
    list: list.map((o) => serializeOrder(o)),
  };
}

export function getOrderById(userId, orderId) {
  expirePendingOrders();
  const order = orders.find((o) => o.orderId === orderId && o.userId === userId);
  if (!order) return null;
  return serializeOrder(order, { includeSubOrders: true });
}

export function getAdminOrders({ orderNo, userId, merchantId, status, page = 1, pageSize = 20 } = {}) {
  expirePendingOrders();
  let list = [...orders];
  if (orderNo?.trim()) {
    const q = orderNo.trim();
    list = list.filter((o) => o.orderNo.includes(q));
  }
  if (userId != null && userId !== '') {
    const uid = Number(userId);
    if (Number.isInteger(uid)) list = list.filter((o) => o.userId === uid);
  }
  if (merchantId != null && merchantId !== '') {
    const mid = Number(merchantId);
    if (Number.isInteger(mid)) {
      list = list.filter((o) => o.subOrders.some((s) => s.merchantId === mid));
    }
  }
  if (status) list = list.filter((o) => o.status === status);
  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const start = (page - 1) * pageSize;
  return {
    total: list.length,
    list: list.slice(start, start + pageSize).map((o) => ({
      ...serializeOrder(o),
      userId: o.userId,
    })),
  };
}

export function getAdminOrderById(orderId) {
  expirePendingOrders();
  const order = orders.find((o) => o.orderId === orderId);
  if (!order) return null;
  return {
    ...serializeOrder(order, { includeSubOrders: true }),
    userId: order.userId,
  };
}

export function payOrder(userId, orderId) {
  expirePendingOrders();
  const order = orders.find((o) => o.orderId === orderId && o.userId === userId);
  if (!order) return { error: 'NOT_FOUND', message: '订单不存在' };
  if (order.status !== 'PENDING_PAYMENT') {
    return { error: 'INVALID_STATE', message: '订单状态不允许支付' };
  }
  if (new Date(order.paymentDeadline).getTime() < Date.now()) {
    for (const item of order.items) releaseStock(item.skuId, item.quantity);
    order.status = 'CANCELLED';
    order.cancelledAt = new Date().toISOString();
    order.cancelReason = 'PAYMENT_TIMEOUT';
    return { error: 'PAYMENT_TIMEOUT', message: '订单已超时关闭' };
  }

  for (const item of order.items) {
    const r = deductStock(item.skuId, item.quantity);
    if (r.error) return r;
  }

  paymentSeq += 1;
  const payment = {
    paymentId: paymentSeq,
    orderId: order.orderId,
    userId,
    amount: order.totalAmount,
    channel: 'MOCK',
    status: 'SUCCESS',
    paidAt: new Date().toISOString(),
  };
  payments.push(payment);

  order.status = 'PENDING_SHIPMENT';
  order.paidAt = payment.paidAt;
  for (const sub of order.subOrders) {
    if (sub.status === 'PENDING_PAYMENT') sub.status = 'PENDING_SHIPMENT';
  }

  return { order: serializeOrder(order, { includeSubOrders: true }), payment };
}

export function cancelOrder(userId, orderId) {
  expirePendingOrders();
  const order = orders.find((o) => o.orderId === orderId && o.userId === userId);
  if (!order) return { error: 'NOT_FOUND', message: '订单不存在' };
  if (order.status !== 'PENDING_PAYMENT') {
    return { error: 'INVALID_STATE', message: '仅待支付订单可取消' };
  }
  for (const item of order.items) releaseStock(item.skuId, item.quantity);
  order.status = 'CANCELLED';
  order.cancelledAt = new Date().toISOString();
  order.cancelReason = 'USER_CANCEL';
  for (const sub of order.subOrders) {
    if (sub.status === 'PENDING_PAYMENT') sub.status = 'CANCELLED';
  }
  return { order: serializeOrder(order, { includeSubOrders: true }) };
}

export function getSubOrdersByMerchant(merchantId, status) {
  expirePendingOrders();
  const list = [];
  for (const order of orders) {
    for (const sub of order.subOrders) {
      if (sub.merchantId !== merchantId) continue;
      if (status && sub.status !== status) continue;
      list.push({
        subOrderId: sub.subOrderId,
        orderId: order.orderId,
        orderNo: order.orderNo,
        merchantId: sub.merchantId,
        shopName: sub.shopName,
        status: sub.status,
        items: sub.items,
        addressSnapshot: order.addressSnapshot,
        createdAt: order.createdAt,
        shipment: sub.shipment || null,
      });
    }
  }
  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return { total: list.length, list };
}

export function shipSubOrder(merchantId, subOrderId, { logisticsCompany, trackingNo }) {
  expirePendingOrders();
  if (!logisticsCompany?.trim() || !trackingNo?.trim()) {
    return { error: 'INVALID_INPUT', message: '请填写物流公司与运单号' };
  }
  for (const order of orders) {
    const sub = order.subOrders.find((s) => s.subOrderId === subOrderId);
    if (!sub) continue;
    if (sub.merchantId !== merchantId) {
      return { error: 'FORBIDDEN', message: '无权操作该子订单' };
    }
    if (sub.status !== 'PENDING_SHIPMENT') {
      return { error: 'INVALID_STATE', message: '子订单状态不允许发货' };
    }
    sub.status = 'SHIPPED';
    sub.shipment = {
      logisticsCompany: logisticsCompany.trim(),
      trackingNo: trackingNo.trim(),
      shippedAt: new Date().toISOString(),
    };
    const activeSubs = order.subOrders.filter((s) => s.status !== 'CANCELLED');
    if (activeSubs.length > 0 && activeSubs.every((s) => s.status === 'SHIPPED' || s.status === 'COMPLETED')) {
      order.status = 'SHIPPED';
    } else if (order.status === 'PENDING_SHIPMENT' && activeSubs.some((s) => s.status === 'SHIPPED')) {
      order.status = 'SHIPPED';
    }
    return { subOrder: sub, orderId: order.orderId, orderStatus: order.status };
  }
  return { error: 'NOT_FOUND', message: '子订单不存在' };
}

function serializeAfterSale(item) {
  return {
    afterSaleId: item.afterSaleId,
    orderId: item.orderId,
    subOrderId: item.subOrderId,
    type: item.type,
    reason: item.reason,
    status: item.status,
    appliedAt: item.appliedAt,
    merchantDeadline: item.merchantDeadline,
  };
}

export function getDashboardSummary() {
  expirePendingOrders();
  return {
    pendingProductCount: spus.filter((s) => s.status === 'PENDING_AUDIT').length,
    escalatedAfterSaleCount: afterSales.filter((a) => a.status === 'ESCALATED').length,
    pendingMerchantCount: merchantApplications.filter((m) => m.status === 'PENDING').length,
  };
}

export function getEscalatedAfterSales(page = 1, pageSize = 20) {
  expirePendingOrders();
  const list = afterSales.filter((a) => a.status === 'ESCALATED');
  const start = (page - 1) * pageSize;
  return {
    total: list.length,
    list: list.slice(start, start + pageSize).map(serializeAfterSale),
  };
}

export function getPendingMerchants() {
  expirePendingOrders();
  return merchantApplications
    .filter((m) => m.status === 'PENDING')
    .map(({ merchantId, shopName, contactName, contactPhone, appliedAt }) => ({
      merchantId,
      shopName,
      contactName,
      contactPhone,
      appliedAt,
    }));
}
