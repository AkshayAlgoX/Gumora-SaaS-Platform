import { test, expect, fixtures } from "../support/api-mock";

test.describe("discover catalog (signed in)", () => {
  test.beforeEach(async ({ api }) => {
    api.on("GET /api/auth/me", fixtures.meSignedIn());
  });

  test("renders each product from GET /api/products with its price and detail link", async ({ page, api }) => {
    api.on(
      "GET /api/products",
      fixtures.products([
        { _id: "665f0000000000000000a001", title: "Icon Pack", price: 199, slug: "icon-pack", coverUrl: null },
        { _id: "665f0000000000000000a002", title: "UI Kit", price: 499.5, slug: "ui-kit", coverUrl: null },
      ])
    );

    await page.goto("/discover");

    const iconPack = page.getByRole("link", { name: "Icon Pack" });
    await expect(iconPack).toBeVisible();
    await expect(iconPack).toHaveAttribute("href", "/discover/icon-pack");
    await expect(page.getByText("₹199", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "UI Kit" })).toHaveAttribute("href", "/discover/ui-kit");
    await expect(page.getByText("₹499.5", { exact: true })).toBeVisible();
    expect(api.calls("GET /api/products")).toHaveLength(1);
  });

  test("shows the empty state when no products are published", async ({ page, api }) => {
    api.on("GET /api/products", fixtures.products([]));

    await page.goto("/discover");

    await expect(page.getByText("No published products yet.")).toBeVisible();
  });
});
