import { test, expect } from '@playwright/test';

test.describe('Authentication RTL & Internationalization', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('Login page should render correctly in Arabic (RTL)', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /switch to arabic/i }).click();

    const htmlDir = await page.locator('html').getAttribute('dir');
    const htmlLang = await page.locator('html').getAttribute('lang');

    expect(htmlDir).toBe('rtl');
    expect(htmlLang).toBe('ar');

    await expect(page.locator('h1.login-title')).toContainText('تسجيل الدخول');

    await expect(page.locator('body')).toHaveClass(/lang-ar/);
  });

  test('Register page should render correctly in Arabic (RTL)', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /switch to arabic/i }).click();
    await page.getByRole('link', { name: /سجل هنا/i }).click();

    const htmlDir = await page.locator('html').getAttribute('dir');
    expect(htmlDir).toBe('rtl');

    await expect(page.locator('h1.register-title')).toContainText('إنشاء حساب');

    await expect(page.locator('body')).toHaveClass(/lang-ar/);
  });
});
