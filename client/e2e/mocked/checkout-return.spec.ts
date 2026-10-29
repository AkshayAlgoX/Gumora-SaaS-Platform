import { test, expect, fixtures } from "../support/api-mock";

/**
 * Return from Cashfree to /library?db_order_id=..., with the session model
 * from docs/authentication.md: the JWT exists only as an HttpOnly cookie and
 * the client never fetches, stores or replays it. No handler is registered
 * for /api/auth/token or /api/auth/refresh-session, so any call to them
 * fails the test (unmocked requests are recorded by the fixture).
 */

const ORDER_ID = "665f000000000000000000aa";

async function seedLegacyToken(page: import("@playwright/test").Page) {
  // A bearer copy left behind by an older build.
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem("session_token", "legacy.jwt.value");
      sessionStorage.setItem("seeded", "1");
    }
  });
}

test("signed-out return keeps the order, drops the legacy token and goes to login", async ({ page, api }) => {
  api.on("GET /api/auth/me", fixtures.meSignedOut());
  await seedLegacyToken(page);

  await page.goto(`/library?db_order_id=${ORDER_ID}`);

  await expect(page).toHaveURL(/\/login\?next=(\/|%2F)library$/);
  expect(await page.evaluate(() => localStorage.getItem("session_token"))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("pending_order_id"))).toBe(ORDER_ID);
  expect(api.calls("POST /api/checkout/confirm")).toHaveLength(0);
});

test("signed-in return confirms through the authenticated endpoint once", async ({ page, api }) => {
  api.on("GET /api/auth/me", fixtures.meSignedIn());
  api.on("POST /api/checkout/confirm", { status: 200, json: { ok: true, code: "SETTLED", orderId: ORDER_ID, retryable: false } });
  api.on("GET /api/library", {
    status: 200,
    json: { ok: true, items: [{ productId: "665f000000000000000000bb", title: "Icon Pack", price: 249, currency: "INR", paidAt: "2026-10-29T10:00:00.000Z" }] },
  });
  await seedLegacyToken(page);

  await page.goto(`/library?db_order_id=${ORDER_ID}`);

  await expect(page.getByText("Icon Pack")).toBeVisible();
  await expect(page).toHaveURL(/\/library$/); // order id removed from the URL
  const confirms = api.calls("POST /api/checkout/confirm");
  expect(confirms).toHaveLength(1);
  expect(confirms[0].postDataJSON()).toEqual({ orderId: ORDER_ID });
  expect(await page.evaluate(() => localStorage.getItem("pending_order_id"))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("session_token"))).toBeNull();
});

test("a retryable outcome keeps the pending order for the next visit", async ({ page, api }) => {
  api.on("GET /api/auth/me", fixtures.meSignedIn());
  api.on("POST /api/checkout/confirm", { status: 409, json: { ok: false, code: "PAYMENT_NOT_PAID", orderId: ORDER_ID, retryable: true } });
  api.on("GET /api/library", { status: 200, json: { ok: true, items: [] } });

  await page.goto(`/library?db_order_id=${ORDER_ID}`);

  await expect(page).toHaveURL(/\/library$/);
  await expect.poll(() => api.calls("GET /api/library").length).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem("pending_order_id"))).toBe(ORDER_ID);
});

test("login returns the buyer to /library, and next cannot leave the site", async ({ page, api }) => {
  let signedIn = false;
  api.on("GET /api/auth/me", () => (signedIn ? fixtures.meSignedIn() : fixtures.meSignedOut()));
  api.on("POST /api/auth/login", () => {
    signedIn = true;
    return { status: 200, json: { ok: true, user: fixtures.buyer } };
  });
  api.on("GET /api/library", { status: 200, json: { ok: true, items: [] } });
  api.on("GET /api/creator/products", { status: 200, json: { ok: true, products: [] } });

  await page.goto("/login?next=/library");
  await page.locator('input[type="email"]').fill("buyer@e2e.test");
  await page.locator('input[type="password"]').fill("correct-password");
  await page.getByRole("button", { name: "Log In" }).click();
  await expect(page).toHaveURL(/\/library$/);

  signedIn = false;
  await page.goto("/login?next=//evil.example/steal");
  await page.locator('input[type="email"]').fill("buyer@e2e.test");
  await page.locator('input[type="password"]').fill("correct-password");
  await page.getByRole("button", { name: "Log In" }).click();
  await expect(page).toHaveURL(/^http:\/\/[^/]+\/dashboard\/products$/);
});
