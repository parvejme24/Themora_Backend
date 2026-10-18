import { env } from "../../config/env";

const frontend = () => env.FRONTEND_URL.replace(/\/+$/, "");

// Where the buyer's browser lands after paying, failing or cancelling
export const checkoutReturnUrls = (orderId: string) => ({
  success: `${frontend()}/purchase/success?order_id=${orderId}`,
  failed: `${frontend()}/checkout/failed?order_id=${orderId}`,
  cancelled: `${frontend()}/checkout/cancelled?order_id=${orderId}`,
});
