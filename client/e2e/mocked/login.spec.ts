import { test, expect, fixtures } from "../support/api-mock";

test.describe("login", () => {
  test.beforeEach(async ({ api }) => {
    api.on("GET /api/auth/me", fixtures.meSignedOut());
  });

  test("empty submit is blocked by required-field validation and sends no credentials", async ({ page, api }) => {
    await page.goto("/login");
    const email = page.locator('input[type="email"]');
    await expect(email).toBeVisible();

    await page.getByRole("button", { name: "Log In" }).click();

    // The browser's constraint validation stops the submit: the field is
    // invalid with a message, and no login request leaves the page.
    expect(await email.evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true);
    expect(await email.evaluate((el: HTMLInputElement) => el.validationMessage)).not.toBe("");
    expect(api.calls("POST /api/auth/login")).toHaveLength(0);
    await expect(page).toHaveURL(/\/login$/);
  });

  test("a malformed email is rejected before any request is sent", async ({ page, api }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("not-an-email");
    await page.locator('input[type="password"]').fill("irrelevant");
    await page.getByRole("button", { name: "Log In" }).click();

    expect(await page.locator('input[type="email"]').evaluate((el: HTMLInputElement) => el.validity.typeMismatch)).toBe(true);
    expect(api.calls("POST /api/auth/login")).toHaveLength(0);
  });

  test("wrong credentials show the server's error and stay on /login", async ({ page, api }) => {
    api.on("POST /api/auth/login", { status: 400, json: { ok: false, error: "Invalid credentials" } });
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("buyer@e2e.test");
    await page.locator('input[type="password"]').fill("wrong-password");
    await page.getByRole("button", { name: "Log In" }).click();

    await expect(page.getByText("Invalid credentials")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    const [request] = api.calls("POST /api/auth/login");
    expect(request.postDataJSON()).toEqual({ email: "buyer@e2e.test", password: "wrong-password" });
  });

  test("successful login navigates to the creator dashboard", async ({ page, api }) => {
    api.on("POST /api/auth/login", { status: 200, json: { ok: true, user: fixtures.buyer } });
    let signedIn = false;
    api.on("GET /api/auth/me", () => (signedIn ? fixtures.meSignedIn() : fixtures.meSignedOut()));
    api.on("GET /api/creator/products", { status: 200, json: { ok: true, products: [] } });

    await page.goto("/login");
    await page.locator('input[type="email"]').fill("buyer@e2e.test");
    await page.locator('input[type="password"]').fill("correct-password");
    signedIn = true;
    await page.getByRole("button", { name: "Log In" }).click();

    await expect(page).toHaveURL(/\/dashboard\/products$/);
    expect(api.calls("POST /api/auth/login")).toHaveLength(1);
  });

  test("an already signed-in user is sent from /login to the dashboard", async ({ page, api }) => {
    api.on("GET /api/auth/me", fixtures.meSignedIn());
    api.on("GET /api/creator/products", { status: 200, json: { ok: true, products: [] } });

    await page.goto("/login");

    await expect(page).toHaveURL(/\/dashboard\/products$/);
  });
});
