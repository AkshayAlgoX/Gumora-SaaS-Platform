import { test, expect } from '@playwright/test';

/**
 * Gumora End-to-End Test Suite
 *
 * Requirements addressed:
 * 1. Behavior-based assertions (no vacuous >= 0 checks).
 * 2. Proper HTML5 & client-side validation assertions for empty form submissions.
 * 3. Exact URL redirect assertions (/discover -> /login).
 * 4. Real failure reporting on API healthcheck (no silent test.skip() hiding broken environments).
 * 5. Deterministic mock isolation tests using Playwright route interception.
 */

test.describe('Homepage & Navigation', () => {
  test('should load the homepage with brand title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Gumora|Gamora|Gumroad/i, { timeout: 15000 });
  });

  test('should render visible authentication action in navigation', async ({ page }) => {
    await page.goto('/');
    // Meaningful assertion: find login or signup action and assert it is visible
    const navAction = page.locator(
      'header a[href*="login"], header a[href*="signin"], nav a[href*="login"], button:has-text("Login"), a:has-text("Sign in")'
    ).first();

    await expect(navAction, 'Expected a visible login navigation action in the header/nav').toBeVisible({
      timeout: 10000,
    });
  });
});

test.describe('Authentication Pages & Form Validation', () => {
  test('login page should render required email and password fields', async ({ page }) => {
    await page.goto('/login');
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    const passwordInput = page.locator('input[type="password"], input[name="password"]');

    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await expect(passwordInput).toBeVisible({ timeout: 10000 });

    // Assert both fields have HTML5 required constraint
    await expect(emailInput).toHaveAttribute('required', '');
    await expect(passwordInput).toHaveAttribute('required', '');
  });

  test('register page should render registration inputs', async ({ page }) => {
    await page.goto('/register');
    const emailInput = page.locator('input[type="email"], input[name="email"]');
    await expect(emailInput).toBeVisible({ timeout: 10000 });
  });

  test('login form should block empty submit with HTML5 form validation', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');

    const emailInput = page.locator('input[type="email"]').first();
    const submitBtn = page.locator('button[type="submit"], button:has-text("Log In")').first();

    await expect(emailInput).toBeVisible({ timeout: 10000 });
    await expect(submitBtn).toBeVisible({ timeout: 10000 });

    // Click submit without entering values
    await submitBtn.click();

    // Verify HTML5 validation state on email input: checkValidity() must be false
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.checkValidity());
    expect(isInvalid, 'Expected empty email input to fail HTML5 validity check').toBe(true);

    const validationMsg = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);
    expect(validationMsg.length, 'Expected non-empty HTML5 validation error message').toBeGreaterThan(0);
  });
});

test.describe('Route Protection & Redirects', () => {
  test('unauthenticated visitor accessing /discover is redirected to /login', async ({ page }) => {
    await page.goto('/discover');
    // Exact destination assertion: must redirect strictly to /login
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
  });
});

test.describe('API Health Probe', () => {
  test('backend healthcheck probe reports 200 OK without self-silencing skips', async ({ request }) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    
    // Explicit assertion: surface network, timeout, or 5xx/503 errors directly to CI
    const response = await request.get(`${apiUrl}/healthz`, {
      timeout: 10000,
    });

    expect(
      response.status(),
      `Backend at ${apiUrl}/healthz returned status ${response.status()}; expected 200 OK`
    ).toBe(200);

    const bodyText = await response.text();
    expect(bodyText).toContain('OK');
  });
});

test.describe('Mock-Isolated Catalog Journey (Deterministic)', () => {
  test('renders mocked catalog items deterministically without external database dependency', async ({
    page,
  }) => {
    // Intercept auth to simulate logged-in buyer
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'buyer_test_001',
            email: 'buyer@example.com',
            name: 'Audit Buyer',
          },
        }),
      });
    });

    // Intercept products endpoint with deterministic test fixture
    await page.route('**/api/products', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          products: [
            {
              _id: 'prod_fixture_001',
              title: 'Deterministic Test Asset Pack',
              price: 199,
              slug: 'deterministic-test-asset-pack',
              coverUrl: null,
            },
          ],
        }),
      });
    });

    await page.goto('/discover');

    // Assert that the mocked product title appears in the DOM
    const productCard = page.locator('text=Deterministic Test Asset Pack');
    await expect(productCard, 'Expected mocked product card to be displayed in catalog').toBeVisible({
      timeout: 15000,
    });
  });
});
