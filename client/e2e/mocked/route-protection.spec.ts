import { test, expect, fixtures } from "../support/api-mock";

/**
 * Access policy as implemented in the client (there is no Next.js middleware):
 * each of these pages calls GET /api/auth/me on mount and, when it returns no
 * user, navigates to /login before requesting any page data.
 */
const PROTECTED = [
  { path: "/discover", dataRoute: "GET /api/products", login: /\/login$/ },
  // The library page may carry the buyer back after login (?next=/library),
  // so a pending purchase is confirmed once the session exists.
  { path: "/library", dataRoute: "GET /api/library", login: /\/login(\?next=(\/|%2F)library)?$/ },
  { path: "/dashboard/products", dataRoute: "GET /api/creator/products", login: /\/login$/ },
];

for (const { path, dataRoute, login } of PROTECTED) {
  test(`${path} sends a signed-out visitor to /login without loading data`, async ({ page, api }) => {
    api.on("GET /api/auth/me", fixtures.meSignedOut());

    await page.goto(path);

    await expect(page).toHaveURL(login);
    expect(api.calls("GET /api/auth/me").length).toBeGreaterThanOrEqual(1);
    expect(api.calls(dataRoute)).toHaveLength(0);
  });
}
