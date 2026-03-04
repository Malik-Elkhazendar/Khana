import { test, expect } from '@playwright/test';

test.describe('Authentication RTL & Internationalization', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('Login page should render correctly in Arabic (RTL)', async ({
    page,
  }) => {
    await page.goto('/login');
    await expect(page.locator('h1.login-title')).toBeVisible();
    await page.getByRole('button', { name: /switch to arabic/i }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');

    await expect(page.locator('h1.login-title')).toContainText('تسجيل الدخول');

    await expect(page.locator('body')).toHaveClass(/lang-ar/);
  });

  test('Register page should render correctly in Arabic (RTL)', async ({
    page,
  }) => {
    await page.goto('/login');
    await expect(page.locator('h1.login-title')).toBeVisible();
    await page.getByRole('button', { name: /switch to arabic/i }).click();
    await page.getByRole('link', { name: /سجل هنا/i }).click();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

    await expect(page.locator('h1.register-title')).toContainText('إنشاء حساب');

    await expect(page.locator('body')).toHaveClass(/lang-ar/);
  });
});
