import { test, expect } from '@playwright/test';
import { setupAuthenticatedDashboard } from './helpers/dashboard.helpers';

test.describe('Visual Sanity — Screenshot Checks', () => {
  test.use({ viewport: { width: 1280, height: 720 } });

  test('EN landing page — no major layout break', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('landing-en-desktop.png', {
      fullPage: false,
      maxDiffPixelRatio: 0.05,
    });
  });

  test('AR landing page — no major layout break', async ({ page }) => {
    await page.goto('/ar');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('landing-ar-desktop.png', {
      fullPage: false,
      maxDiffPixelRatio: 0.05,
    });
  });

  test('EN→AR switch — visual direction change', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Take EN screenshot first
    await expect(page).toHaveScreenshot('landing-before-switch-en.png', {
      fullPage: false,
      maxDiffPixelRatio: 0.05,
    });

    // Switch to AR
    await page
      .locator('app-landing-header app-language-switcher button')
      .first()
      .click();
    await expect(page).toHaveURL(/\/ar$/);
    await page.waitForLoadState('networkidle');

    // Take AR screenshot — should be visually different (RTL)
    await expect(page).toHaveScreenshot('landing-after-switch-ar.png', {
      fullPage: false,
      maxDiffPixelRatio: 0.05,
    });
  });

  test('Dashboard bookings page — layout intact', async ({ page }) => {
    await setupAuthenticatedDashboard(page);
    await page.goto('/dashboard/bookings');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('dashboard-bookings-en.png', {
      fullPage: false,
      maxDiffPixelRatio: 0.05,
    });
  });

  test('Reset password page — form renders correctly', async ({ page }) => {
    await page.goto('/reset-password?token=visual-test-token');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot('reset-password-form.png', {
      fullPage: false,
      maxDiffPixelRatio: 0.05,
    });
  });
});
