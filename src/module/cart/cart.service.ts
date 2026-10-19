import { LicenseType } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError } from "../../utils/AppError";
import { withActiveSale } from "../../utils/pricing";
import { normalizeCode } from "../coupon/coupon.service";
import { checkoutService } from "../payment/checkout.service";
import { productCardSelect, userOwnsProduct } from "../product/product.service";

interface CartUser {
  id: string;
  email: string;
  fullName: string;
}

const getOrCreateCart = (userId: string) =>
  prisma.cart.upsert({ where: { userId }, create: { userId }, update: {}, select: { id: true, couponCode: true } });

export class CartService {
  // Cart with live prices. An invalid saved coupon is reported, not fatal.
  async get(user: CartUser) {
    const cart = await prisma.cart.findUnique({
      where: { userId: user.id },
      include: { items: { orderBy: { createdAt: "asc" }, include: { product: { select: { ...productCardSelect, status: true } } } } },
    });
    const empty = { items: [], unavailable: [], couponCode: null, couponError: null, subtotal: 0, discountTotal: 0, totalAmount: 0 };
    if (!cart || cart.items.length === 0) return { ...empty, couponCode: cart?.couponCode ?? null };

    const available = cart.items.filter((item) => item.product.status === "PUBLISHED");
    const unavailable = cart.items.filter((item) => item.product.status !== "PUBLISHED").map((item) => ({ productId: item.productId, title: item.product.title }));
    if (available.length === 0) return { ...empty, unavailable, couponCode: cart.couponCode };

    const lineItems = available.map((item) => ({ productId: item.productId, licenseType: item.licenseType }));
    const customer = { userId: user.id, email: user.email };
    let couponError: string | null = null;
    let quote;
    try {
      quote = await checkoutService.quote(lineItems, cart.couponCode ?? undefined, customer);
    } catch (error) {
      if (!cart.couponCode || !(error instanceof AppError)) throw error;
      couponError = error.message;
      quote = await checkoutService.quote(lineItems, undefined, customer);
    }

    return {
      items: available.map((item, i) => {
        const { status, ...product } = item.product;
        return {
          productId: item.productId,
          licenseType: item.licenseType,
          product: withActiveSale(product),
          unitPrice: quote.items[i].unitPrice,
          discount: quote.items[i].discount,
          total: quote.items[i].total,
        };
      }),
      unavailable,
      couponCode: couponError ? null : cart.couponCode,
      couponError,
      subtotal: quote.subtotal,
      discountTotal: quote.discountTotal,
      totalAmount: quote.totalAmount,
    };
  }

  async addItem(user: CartUser, productId: string, licenseType: LicenseType) {
    await this.putItem(user, productId, licenseType);
    return this.get(user);
  }

  // Validates and saves one item without re-pricing the cart (callers price it once)
  private async putItem(user: CartUser, productId: string, licenseType: LicenseType) {
    const product = await prisma.template.findFirst({
      where: { id: productId, status: "PUBLISHED" },
      select: { id: true, extendedPrice: true, isFree: true },
    });
    if (!product) throw AppError.notFound("Product not found");
    if (await userOwnsProduct(user.id, productId)) throw AppError.conflict("You already own this product. Find it in your purchases");
    if (licenseType === "EXTENDED" && (product.extendedPrice == null || product.isFree)) {
      throw AppError.badRequest("This product is not sold with an extended licence");
    }

    const cart = await getOrCreateCart(user.id);
    // A changed cart may get a new reminder later
    await prisma.cart.update({ where: { id: cart.id }, data: { reminderSentAt: null } });
    await prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId } },
      create: { cartId: cart.id, productId, licenseType },
      update: { licenseType },
    });
  }

  async removeItem(user: CartUser, productId: string) {
    await prisma.cartItem.deleteMany({ where: { cart: { userId: user.id }, productId } });
    return this.get(user);
  }

  async clear(user: CartUser) {
    await prisma.cart.updateMany({ where: { userId: user.id }, data: { couponCode: null } });
    await prisma.cartItem.deleteMany({ where: { cart: { userId: user.id } } });
    return this.get(user);
  }

  // Merges a guest cart (kept in the browser) after sign-in. Items that are
  // unavailable or already owned are skipped silently.
  async merge(user: CartUser, items: { productId: string; licenseType: LicenseType }[]) {
    const skipped: string[] = [];
    for (const item of items) {
      try {
        await this.putItem(user, item.productId, item.licenseType);
      } catch (error) {
        if (!(error instanceof AppError)) throw error;
        skipped.push(item.productId);
      }
    }
    return { ...(await this.get(user)), skipped };
  }

  async applyCoupon(user: CartUser, code: string) {
    const cart = await this.get(user);
    if (cart.items.length === 0) throw AppError.badRequest("Add something to your cart before applying a coupon");
    // Throws a descriptive 400 when the coupon does not apply
    await checkoutService.quote(
      cart.items.map((item) => ({ productId: item.productId, licenseType: item.licenseType })),
      code,
      { userId: user.id, email: user.email }
    );
    await prisma.cart.update({ where: { userId: user.id }, data: { couponCode: normalizeCode(code) } });
    return this.get(user);
  }

  async removeCoupon(user: CartUser) {
    await prisma.cart.updateMany({ where: { userId: user.id }, data: { couponCode: null } });
    return this.get(user);
  }

  async checkout(user: CartUser, gateway: "stripe" | "sslcommerz", phone?: string, referralCode?: string) {
    const cart = await this.get(user);
    if (cart.items.length === 0) throw AppError.badRequest("Your cart is empty");
    if (cart.couponError) throw AppError.badRequest(`Your coupon can no longer be used: ${cart.couponError}`);
    return checkoutService.createCheckout(
      {
        items: cart.items.map((item) => ({ productId: item.productId, licenseType: item.licenseType })),
        gateway,
        couponCode: cart.couponCode ?? undefined,
        referralCode,
        customer: { phone },
      },
      user
    );
  }
}

export const cartService = new CartService();
