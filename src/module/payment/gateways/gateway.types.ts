export interface GatewayOrder {
  id: string;
  orderNumber: string;
  totalAmount: number; // USD
  items: { title: string; total: number }[];
}

export interface GatewayCustomer {
  email: string;
  name: string;
  phone?: string;
}

export interface GatewaySession {
  url: string;
  sessionId: string;
  // What the gateway was asked to charge; webhooks are checked against this
  chargeAmount: number;
  chargeCurrency: string;
}
