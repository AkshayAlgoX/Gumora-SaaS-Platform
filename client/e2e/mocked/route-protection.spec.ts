import { test, expect, fixtures } from "../support/api-mock";

/**
 * Access policy as implemented in the client (there is no Next.js middleware):
 * each of these pages calls GET /api/auth/me on mount and, when it returns no
 * user, navigates to /login before requesting any page data.
 */
const PROTECTED = [
  { path: "/discover", dataRoute: "GET /api/products" },
  { path: "/library", dataRoute: "GET /api/library" },
  { path: "/dashboard/products", dataRoute: "GET /api/creator/products" },
];

for (const { path, dataRoute } of PROTECTED) {
  test(`${path} sends a signed-out visitor to /login without loading data`, async ({ page, api }) => {
    api.on("GET /api/auth/me", fixtures.meSignedOut());

    await page.goto(path);

    await expect(page).toHaveURL(/\/login$/);
    expect(api.calls("GET /api/auth/me").length).toBeGreaterThanOrEqual(1);
    expect(api.calls(dataRoute)).toHaveLength(0);
  });
}
