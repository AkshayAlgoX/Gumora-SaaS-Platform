import { test, expect } from "@playwright/test";

/**
 * Availability smoke checks against real deployments. Opt-in only:
 *   SMOKE_WEB_URL=https://www.gumora.shop SMOKE_API_URL=https://api.gumora.shop npm run test:e2e:smoke
 * These make read-only GET requests and never sign in or create orders.
 * A failure here reports deployment state; it says nothing about the code
 * under review.
 */

const WEB = process.env.SMOKE_WEB_URL;
const API = process.env.SMOKE_API_URL;

test("frontend serves the Gumora homepage", async ({ request }) => {
  expect(WEB, "set SMOKE_WEB_URL to run smoke checks").toBeTruthy();
  const res = await request.get(WEB!, { timeout: 20_000 });
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain("<title>Gumora</title>");
});

test("backend /healthz returns 200 OK", async ({ request }) => {
  expect(API, "set SMOKE_API_URL to run smoke checks").toBeTruthy();
  const res = await request.get(`${API}/healthz`, { timeout: 20_000 });
  const body = await res.text();
  expect(res.status(), `GET ${API}/healthz -> ${res.status()}: ${body.slice(0, 120)}`).toBe(200);
  expect(body).toBe("OK");
});
