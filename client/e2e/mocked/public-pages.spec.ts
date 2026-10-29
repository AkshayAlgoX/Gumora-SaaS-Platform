import { test, expect } from "../support/api-mock";

test.describe("public pages", () => {
  test("homepage has the Gumora title, a Login link and a Start Selling call to action", async ({ page, api }) => {
    await page.goto("/");

    await expect(page).toHaveTitle("Gumora");
    const login = page.getByRole("link", { name: "Login", exact: true });
    await expect(login).toBeVisible();
    await expect(login).toHaveAttribute("href", "/login");
    await expect(page.getByRole("link", { name: "Start Selling" })).toHaveAttribute("href", "/dashboard/products");
    // The homepage renders without calling the API.
    expect(api.unexpected()).toEqual([]);
  });

  test("register page shows required name, email and password inputs", async ({ page, api }) => {
    api.on("GET /api/auth/me", { status: 401, json: { ok: false } });
    await page.goto("/register");

    const email = page.locator('input[type="email"]');
    const password = page.locator('input[type="password"]');
    await expect(email).toBeVisible();
    await expect(email).toHaveAttribute("required", "");
    await expect(password).toHaveAttribute("required", "");
  });
});
