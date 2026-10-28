import { test as base, expect, type Page, type Request } from "@playwright/test";

/**
 * Mock-isolated API for deterministic E2E tests.
 *
 * The app is built with NEXT_PUBLIC_API_URL = E2E_API_URL (see
 * playwright.config.ts), an address where nothing listens. Every browser
 * request to it is answered here. A request without a registered handler is
 * answered with 501 and recorded, and the test fails afterwards, so a test
 * cannot silently depend on an endpoint it did not declare.
 *
 * Response bodies mirror the Express handlers in backend/src (paths and field
 * names are taken from those files, including the `errorr` typo returned by
 * requireAuth).
 */

export const E2E_API_URL = process.env.E2E_API_URL ?? "http://127.0.0.1:59999";

type Json = Record<string, unknown> | unknown[];
type Handler = (req: Request) => { status?: number; json: Json } | Promise<{ status?: number; json: Json }>;

export interface ApiMock {
  /** Register a handler for "METHOD /api/path" (exact path, no query string). */
  on(route: string, handler: Handler | { status?: number; json: Json }): void;
  /** Requests received for a route, in order. */
  calls(route: string): Request[];
  /** Requests that had no handler. */
  unexpected(): string[];
}

/* ---------- contract fixtures (shapes from backend/src) ---------- */

type SessionUser = { id: string; name: string; email: string; isCreator: boolean };

const BUYER: SessionUser = { id: "665f00000000000000000001", name: "E2E Buyer", email: "buyer@e2e.test", isCreator: false };

export const fixtures = {
  buyer: BUYER,
  /** GET /api/auth/me when signed in (routes/auth.ts) */
  meSignedIn(user: SessionUser = BUYER) {
    return { status: 200, json: { ok: true, user } };
  },
  /** GET /api/auth/me without a session cookie (middleware/requireAuth.ts) */
  meSignedOut() {
    return { status: 401, json: { ok: false, errorr: "Unauth user! Please log in." } };
  },
  /** GET /api/products (routes/publicProduct.ts) */
  products(items: Array<{ _id: string; title: string; price: number; slug: string; coverUrl: string | null }>) {
    return {
      status: 200,
      json: { ok: true, products: items.map((p) => ({ creatorId: "665f00000000000000000099", ...p })) },
    };
  },
};

function key(method: string, url: string): string {
  return `${method.toUpperCase()} ${new URL(url).pathname}`;
}

async function installApiMock(page: Page): Promise<ApiMock> {
  const handlers = new Map<string, Handler>();
  const received = new Map<string, Request[]>();
  const unexpected: string[] = [];

  await page.route(`${E2E_API_URL}/**`, async (route) => {
    const req = route.request();
    const origin = (await req.headerValue("origin")) ?? "*";
    const cors = {
      "access-control-allow-origin": origin,
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "content-type",
      "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
    };
    if (req.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }

    const k = key(req.method(), req.url());
    received.set(k, [...(received.get(k) ?? []), req]);
    const handler = handlers.get(k);
    if (!handler) {
      unexpected.push(k);
      await route.fulfill({ status: 501, headers: cors, contentType: "application/json", body: JSON.stringify({ ok: false, error: `unmocked ${k}` }) });
      return;
    }
    const { status = 200, json } = await handler(req);
    await route.fulfill({ status, headers: cors, contentType: "application/json", body: JSON.stringify(json) });
  });

  return {
    on(route, handler) {
      handlers.set(route, typeof handler === "function" ? handler : () => handler);
    },
    calls(route) {
      return received.get(route) ?? [];
    },
    unexpected() {
      return [...unexpected];
    },
  };
}

export const test = base.extend<{ api: ApiMock }>({
  // The fixture callback is named `provide` rather than Playwright's usual
  // `use`, which eslint-plugin-react-hooks mistakes for React's use() hook.
  api: async ({ page }, provide) => {
    const api = await installApiMock(page);
    await provide(api);
    expect(api.unexpected(), "browser called API endpoints the test did not mock").toEqual([]);
  },
});

export { expect };
