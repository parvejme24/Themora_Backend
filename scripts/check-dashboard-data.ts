/**
 * Signs in as the two demo accounts from the login page and calls every GET
 * endpoint the dashboard uses, reporting the status and how much data comes
 * back. Anything EMPTY means a dashboard page would show an empty state.
 *
 *   npx ts-node scripts/check-dashboard-data.ts            (against http://localhost:5050)
 *   API_URL=https://themora-backend.vercel.app/api/v1 npx ts-node scripts/check-dashboard-data.ts
 */
const API = (process.env.API_URL ?? "http://localhost:5050/api/v1").replace(/\/+$/, "");

const ACCOUNTS = {
  admin: { email: "admin@themora.test", password: "Admin@Themora2026!" },
  customer: { email: "sarah.user@themora.test", password: "User@Themora2026!" },
} as const;

type Role = keyof typeof ACCOUNTS;

// Endpoints each dashboard page loads, by who opens it. {id}-style params are
// filled from the first item of the listed endpoint.
const ENDPOINTS: Record<Role, string[]> = {
  admin: [
    "/auth/me",
    "/me/preferences",
    "/dashboard/overview",
    "/admin/analytics/overview?days=30",
    "/admin/products",
    "/admin/products/{product}",
    "/admin/products/{product}/versions",
    "/template-categories",
    "/template-categories/stats",
    "/admin/orders",
    "/admin/orders/{order}",
    "/orders/stats",
    "/admin/refund-requests",
    "/admin/tickets",
    "/tickets/{ticket}",
    "/admin/subscriptions",
    "/admin/reviews",
    "/admin/coupons",
    "/admin/affiliates",
    "/admin/affiliate-payouts",
    "/admin/audit-logs",
    "/auth/users",
    "/auth/users/stats",
    "/admin/pricing",
    "/blogs?limit=10",
    "/blogs/drafts",
    "/blogs/stats",
    "/blog-categories",
    "/newsletter",
    "/newsletter/stats",
    "/contacts",
    "/contacts/stats",
    "/me/notifications",
  ],
  customer: [
    "/auth/me",
    "/me/preferences",
    "/me/orders",
    "/me/orders/{myOrder}",
    "/me/downloads",
    "/me/licenses",
    "/me/subscription",
    "/me/wishlist",
    "/me/tickets",
    "/tickets/{myTicket}",
    "/me/notifications",
    "/me/reviews",
    "/me/recently-viewed",
    "/me/affiliate",
    "/me/affiliate/referrals",
    "/me/affiliate/payouts",
    "/me/cart",
    "/contacts/email/{email}",
  ],
};

// Where to take an id from for each placeholder
const SOURCES: Record<string, { from: string; field?: string }> = {
  product: { from: "/admin/products" },
  order: { from: "/admin/orders" },
  ticket: { from: "/admin/tickets" },
  contact: { from: "/contacts" },
  myOrder: { from: "/me/orders" },
  myTicket: { from: "/me/tickets" },
};

const login = async (role: Role) => {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ACCOUNTS[role]),
  });
  const body = (await res.json()) as any;
  const token = body?.data?.nextAuthSecret;
  if (!res.ok || !token) throw new Error(`${role} sign-in failed (${res.status}): ${body?.message}`);
  return token as string;
};

const LIST_KEYS = ["items", "users", "contacts", "blogs", "subscribers", "newsletters", "orders", "templates", "categories"];

// Empty is a normal state here, not a missing-data problem
const MAY_BE_EMPTY = new Set(["/me/cart"]);

// "12 items", "object", "EMPTY"...
const describe = (body: any): { size: string; empty: boolean; items: any[] } => {
  const data = body?.data;
  const total = body?.pagination?.total;
  // Some legacy endpoints wrap lists: { users: [...] }, { contacts: [...] }
  const wrapped = data && typeof data === "object" ? LIST_KEYS.find((key) => Array.isArray(data[key])) : undefined;
  const list = Array.isArray(data) ? data : wrapped ? data[wrapped] : undefined;
  if (Array.isArray(list)) {
    const count = typeof total === "number" ? total : list.length;
    return { size: `${count} item${count === 1 ? "" : "s"}`, empty: count === 0, items: list };
  }
  if (data === null || data === undefined) return { size: "null", empty: true, items: [] };
  if (typeof data === "object") return { size: `object (${Object.keys(data).length} keys)`, empty: Object.keys(data).length === 0, items: [] };
  return { size: String(data), empty: false, items: [] };
};

async function check(role: Role) {
  const token = await login(role);
  const firstIds: Record<string, string> = { email: encodeURIComponent(ACCOUNTS[role].email) };
  const rows: { path: string; status: number | string; size: string; flag: string }[] = [];

  for (const template of ENDPOINTS[role]) {
    const missing = [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).find((key) => !firstIds[key]);
    if (missing) {
      rows.push({ path: template, status: "-", size: `no ${missing} to open`, flag: "SKIPPED" });
      continue;
    }
    const path = template.replace(/\{(\w+)\}/g, (_, key) => firstIds[key]);
    const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
    const body = await res.json().catch(() => null);
    const { size, empty, items } = describe(body);
    rows.push({ path: template, status: res.status, size, flag: res.status >= 400 ? "FAILED" : empty && !MAY_BE_EMPTY.has(template) ? "EMPTY" : "ok" });

    for (const [key, source] of Object.entries(SOURCES)) {
      if (source.from === template.split("?")[0] && items[0]?.id) firstIds[key] = items[0].id;
    }
  }
  return rows;
}

async function main() {
  let problems = 0;
  for (const role of Object.keys(ACCOUNTS) as Role[]) {
    console.log(`\n${role.toUpperCase()} (${ACCOUNTS[role].email})`);
    for (const row of await check(role)) {
      if (row.flag !== "ok") problems += 1;
      console.log(`  ${row.flag.padEnd(7)} ${String(row.status).padEnd(4)} ${row.path.padEnd(42)} ${row.size}`);
    }
  }
  console.log(`\n${problems ? `${problems} endpoints need attention` : "Every endpoint returned data"}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
