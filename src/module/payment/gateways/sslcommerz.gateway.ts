import { env } from "../../../config/env";
import { AppError } from "../../../utils/AppError";
import { GatewayCustomer, GatewayOrder, GatewaySession } from "./gateway.types";

const baseUrl = () => (env.SSLCOMMERZ_SANDBOX ? "https://sandbox.sslcommerz.com" : "https://securepay.sslcommerz.com");

const credentials = () => {
  if (!env.SSLCOMMERZ_STORE_ID || !env.SSLCOMMERZ_STORE_PASSWORD) {
    throw new AppError(503, "bKash / Nagad / local card payments (SSLCommerz) are not configured yet");
  }
  return { store_id: env.SSLCOMMERZ_STORE_ID, store_passwd: env.SSLCOMMERZ_STORE_PASSWORD };
};

const apiUrl = (path: string) => `${env.BACKEND_URL.replace(/\/+$/, "")}/api/v1${path}`;

export const usdToBdt = (usd: number) => Math.round(usd * env.USD_TO_BDT_RATE * 100) / 100;

// Fields from the SSLCommerz Validation API that we rely on
export interface SslcommerzValidation {
  status: string; // VALID | VALIDATED | INVALID_TRANSACTION
  tran_id: string;
  val_id: string;
  bank_tran_id?: string;
  currency_type: string;
  currency_amount: string;
  risk_level?: string;
  value_a?: string;
}

export const sslcommerzGateway = {
  async createSession(order: GatewayOrder, customer: GatewayCustomer): Promise<GatewaySession> {
    const chargeAmount = usdToBdt(order.totalAmount);
    const body = new URLSearchParams({
      ...credentials(),
      total_amount: chargeAmount.toFixed(2),
      currency: "BDT",
      tran_id: order.orderNumber,
      success_url: apiUrl("/payments/sslcommerz/success"),
      fail_url: apiUrl("/payments/sslcommerz/fail"),
      cancel_url: apiUrl("/payments/sslcommerz/cancel"),
      ipn_url: apiUrl("/webhooks/sslcommerz"),
      cus_name: customer.name,
      cus_email: customer.email,
      cus_phone: customer.phone || "N/A",
      cus_add1: "N/A",
      cus_city: "N/A",
      cus_country: "Bangladesh",
      shipping_method: "NO",
      num_of_item: String(order.items.length),
      product_name: order.items.map((item) => item.title).join(", ").slice(0, 255),
      product_category: "Digital Goods",
      product_profile: "non-physical-goods",
      value_a: order.id,
    });

    const response = await fetch(`${baseUrl()}/gwprocess/v4/api.php`, { method: "POST", body });
    const data = (await response.json().catch(() => ({}))) as {
      status?: string;
      GatewayPageURL?: string;
      sessionkey?: string;
      failedreason?: string;
    };
    if (data.status !== "SUCCESS" || !data.GatewayPageURL) {
      throw new AppError(502, `SSLCommerz could not start the payment: ${data.failedreason || "unknown error"}`);
    }
    return { url: data.GatewayPageURL, sessionId: data.sessionkey ?? order.orderNumber, chargeAmount, chargeCurrency: "BDT" };
  },

  // Never trust the browser redirect or IPN body alone: always ask SSLCommerz
  async validate(valId: string): Promise<SslcommerzValidation> {
    const params = new URLSearchParams({ val_id: valId, ...credentials(), v: "1", format: "json" });
    const response = await fetch(`${baseUrl()}/validator/api/validationserverAPI.php?${params}`);
    if (!response.ok) throw new AppError(502, "SSLCommerz validation request failed");
    return (await response.json()) as SslcommerzValidation;
  },

  async refund(bankTranId: string, amount: number, reason: string) {
    const params = new URLSearchParams({
      bank_tran_id: bankTranId,
      refund_amount: amount.toFixed(2),
      refund_remarks: reason.slice(0, 255),
      ...credentials(),
      v: "1",
      format: "json",
    });
    const response = await fetch(`${baseUrl()}/validator/api/merchantTransIDvalidationAPI.php?${params}`);
    return (await response.json()) as { APIConnect?: string; status?: string; refund_ref_id?: string; errorReason?: string };
  },
};
