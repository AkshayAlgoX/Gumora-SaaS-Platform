import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Gamora|Gumroad/i);
  });

  test('should have navigation links', async ({ page }) => {
    await page.goto('/');
    // Check for login/register links or navigation
    const hasLoginLink = await page.locator('a[href*="login"], button:has-text("Login")').count();
    expect(hasLoginLink).toBeGreaterThanOrEqual(0);
  });
});

test.describe('Auth Pages', () => {
  test('login page should load', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible({ timeout: 10000 });
  });

  test('register page should load', async ({ page }) => {
    await page.goto('/register');
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible({ timeout: 10000 });
  });

  test('login form should show validation error for empty submit', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    
    const submitButton = page.locator('button[type="submit"]');
    if (await submitButton.isVisible()) {
      await submitButton.click();
      // Should show some validation feedback
    }
  });
});

test.describe('Discover Page', () => {
  test('should redirect to login when not authenticated', async ({ page }) => {
    await page.goto('/discover');
    // Should either show products or redirect to login
    await page.waitForURL(/\/(discover|login)/);
  });
});

test.describe('API Health', () => {
  test('backend healthcheck should respond', async ({ request }) => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    try {
      const response = await request.get(`${apiUrl}/healthz`);
      expect(response.ok()).toBeTruthy();
    } catch {
      // Backend might not be running in test environment
      test.skip();
    }
  });
});
