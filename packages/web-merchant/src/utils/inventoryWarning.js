export const LOW_STOCK_THRESHOLD = 10;

export function getSkuAvailable(sku) {
  const value = Number(sku?.stock?.available ?? sku?.available);
  return Number.isFinite(value) ? value : 0;
}

export function getProductInventoryWarning(product) {
  if (product?.status !== 'ON_SHELF') {
    return {
      level: 'NONE',
      label: '-',
      isOutOfStock: false,
      isLowStock: false,
    };
  }

  const skus = Array.isArray(product?.skus) ? product.skus : [];
  const isOutOfStock = skus.some((sku) => getSkuAvailable(sku) === 0);
  if (isOutOfStock) {
    return {
      level: 'OUT_OF_STOCK',
      label: '缺货',
      isOutOfStock: true,
      isLowStock: false,
    };
  }

  const isLowStock = skus.some((sku) => {
    const available = getSkuAvailable(sku);
    return available > 0 && available < LOW_STOCK_THRESHOLD;
  });
  if (isLowStock) {
    return {
      level: 'LOW_STOCK',
      label: '低库存',
      isOutOfStock: false,
      isLowStock: true,
    };
  }

  return {
    level: 'NORMAL',
    label: '库存正常',
    isOutOfStock: false,
    isLowStock: false,
  };
}
