import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { mintAdminSession, revokeSession, serverIsUp } from "./helpers/session";

/**
 * HTTP smoke tests against a running dev server.
 *
 * They check that every route actually renders and that the admin area is genuinely
 * closed to signed-out visitors. If the server is not running they skip rather than
 * fail, so `npm test` still works without one.
 */

const BASE = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "studio@carisca.org";

let online = false;
let cookie = "";
let sessionId = "";

beforeAll(async () => {
  online = await serverIsUp(BASE);
  if (!online) return;
  const session = await mintAdminSession(ADMIN_EMAIL);
  cookie = session.cookie;
  sessionId = session.id;
});

afterAll(async () => {
  if (sessionId) await revokeSession(sessionId);
});

async function get(path: string, withAuth = false) {
  return fetch(`${BASE}${path}`, {
    headers: withAuth ? { cookie } : {},
    redirect: "manual",
  });
}

const PUBLIC_PAGES = [
  "/",
  "/book",
  "/packages",
  "/memberships",
  "/studio",
  "/corporate",
  "/faq",
  "/contact",
  "/terms",
  "/privacy",
  "/account",
  "/booking/lookup",
  "/sitemap.xml",
  "/robots.txt",
];

const ADMIN_PAGES = [
  "/admin/dashboard",
  "/admin/bookings",
  "/admin/bookings/new",
  "/admin/calendar",
  "/admin/customers",
  "/admin/memberships",
  "/admin/inquiries",
  "/admin/packages",
  "/admin/addons",
  "/admin/equipment",
  "/admin/discounts",
  "/admin/faqs",
  "/admin/availability",
  "/admin/payments",
  "/admin/settings",
  "/admin/team",
  "/admin/notifications",
  "/admin/audit",
];

describe("public pages", () => {
  it.each(PUBLIC_PAGES)("GET %s renders", async (path) => {
    if (!online) return;
    const response = await get(path);
    expect(response.status, `${path} returned ${response.status}`).toBe(200);
  });
});

describe("admin access control", () => {
  it.each(ADMIN_PAGES)("GET %s redirects when signed out", async (path) => {
    if (!online) return;
    const response = await get(path);
    // `redirect()` from a Server Component surfaces as a 3xx to the login page.
    expect([307, 302, 303]).toContain(response.status);
    expect(response.headers.get("location") ?? "").toContain("/admin/login");
  });

  it.each(ADMIN_PAGES)("GET %s renders when signed in", async (path) => {
    if (!online) return;
    const response = await get(path, true);
    expect(response.status, `${path} returned ${response.status}`).toBe(200);
  });
});

describe("public APIs", () => {
  it("availability rejects a malformed date", async () => {
    if (!online) return;
    const response = await get("/api/availability?date=not-a-date");
    expect(response.status).toBe(400);
  });

  it("availability returns slots for a valid date", async () => {
    if (!online) return;
    const soon = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    const response = await get(`/api/availability?date=${soon}`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { day: { slots: unknown[] } };
    expect(Array.isArray(body.day.slots)).toBe(true);
  });

  it("the quote endpoint rejects a request with no package", async () => {
    if (!online) return;
    const response = await fetch(`${BASE}/api/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addOns: [] }),
    });
    expect(response.status).toBe(400);
  });

  it("the Paystack webhook refuses an unsigned request", async () => {
    if (!online) return;
    const response = await fetch(`${BASE}/api/payments/paystack/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event: "charge.success", data: { reference: "fake" } }),
    });
    // 401 when Paystack is configured, 503 when it is not: never 200.
    expect([401, 503]).toContain(response.status);
  });

  it("the cron endpoint refuses a request without the shared secret", async () => {
    if (!online) return;
    const response = await fetch(`${BASE}/api/cron`, { method: "POST" });
    expect([401, 503]).toContain(response.status);
  });
});

describe("booking privacy", () => {
  it("does not reveal a booking without a valid access token", async () => {
    if (!online) return;
    const response = await fetch(`${BASE}/booking/CAR-STU-20260101-001`, {
      redirect: "manual",
    });
    // Either not found, or the "verify this link" screen: never the booking itself.
    if (response.status === 200) {
      const html = await response.text();
      expect(html).toContain("needs verifying");
    } else {
      expect([404, 307, 302]).toContain(response.status);
    }
  });
});
