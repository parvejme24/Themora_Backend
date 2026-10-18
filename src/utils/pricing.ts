// A sale price applies only while its sale is running (no end date = until removed)
export const activeSalePrice = (
  product: { salePrice: number | null; saleEndsAt: Date | null },
  now = new Date()
): number | null => {
  if (product.salePrice == null) return null;
  if (product.saleEndsAt && product.saleEndsAt <= now) return null;
  return product.salePrice;
};

// Hides expired sales from API responses
export const withActiveSale = <T extends { salePrice: number | null; saleEndsAt: Date | null }>(product: T): T => {
  const salePrice = activeSalePrice(product);
  return salePrice === product.salePrice ? product : { ...product, salePrice, saleEndsAt: null };
};
