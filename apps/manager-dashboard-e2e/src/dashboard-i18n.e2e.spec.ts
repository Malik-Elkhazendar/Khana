import { test, expect } from '@playwright/test';
import { setupAuthenticatedDashboard } from './helpers/dashboard.helpers';

test.describe('Dashboard i18n & Route Transitions', () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedDashboard(page);
  });

  test.describe('Language Toggle on Dashboard', () => {
    test('dashboard header has a language switcher', async ({ page }) => {
      await page.goto('/dashboard/bookings');
      const switcher = page.locator('app-header app-language-switcher button');
      await expect(switcher).toBeVisible();
    });

    test('toggling to Arabic sets RTL direction and Arabic labels', async ({
      page,
    }) => {
      await page.goto('/dashboard/bookings');
      await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

      // Click language switcher in dashboard header
      await page.locator('app-header app-language-switcher button').click();

      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
      await expect(page.locator('body')).toHaveClass(/lang-ar/);
    });

    test('toggling back to English restores LTR direction', async ({
      page,
    }) => {
      await page.goto('/dashboard/bookings');

      // Switch to Arabic
      await page.locator('app-header app-language-switcher button').click();
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

      // Switch back to English
      await page.locator('app-header app-language-switcher button').click();
      await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    });

    test('language persists across dashboard page navigation', async ({
      page,
    }) => {
      await page.goto('/dashboard/bookings');

      // Switch to Arabic
      await page.locator('app-header app-language-switcher button').click();
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

      // Navigate to Calendar
      await page
        .getByRole('link', { name: /التقويم/i })
        .first()
        .click();
      await expect(page).toHaveURL(/\/dashboard\/calendar/);
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(page.locator('html')).toHaveAttribute('lang', 'ar');

      // Navigate to New Booking
      await page
        .getByRole('link', { name: /حجز جديد/i })
        .first()
        .click();
      await expect(page).toHaveURL(/\/dashboard\/new/);
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
    });
  });

  test.describe('Dashboard Booking Pages Render', () => {
    test('/dashboard/bookings loads and shows page content', async ({
      page,
    }) => {
      await page.goto('/dashboard/bookings');
      await expect(page).toHaveURL(/\/dashboard\/bookings/);

      // Verify the dashboard layout shell renders
      await expect(page.locator('app-header')).toBeVisible();
      await expect(page.locator('#dashboard-route-content')).toBeVisible();
    });

    test('/dashboard/calendar loads correctly', async ({ page }) => {
      await page.goto('/dashboard/calendar');
      await expect(page).toHaveURL(/\/dashboard\/calendar/);
      await expect(page.locator('app-header')).toBeVisible();
      await expect(page.locator('#dashboard-route-content')).toBeVisible();
    });

    test('/dashboard/new loads correctly', async ({ page }) => {
      await page.goto('/dashboard/new');
      await expect(page).toHaveURL(/\/dashboard\/new/);
      await expect(page.locator('app-header')).toBeVisible();
      await expect(page.locator('#dashboard-route-content')).toBeVisible();
    });
  });

  test.describe('Route Transition Integrity', () => {
    test('navigating from /dashboard/new to EN landing keeps LTR', async ({
      page,
    }) => {
      await page.goto('/dashboard/new');
      await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

      // Click the brand link to go home, or navigate directly
      await page.goto('/');
      await expect(page).toHaveURL(/\/$/);
      await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');

      // Verify landing page structure is intact
      await expect(page.locator('#hero')).toBeVisible();
      await expect(page.locator('#features')).toBeAttached();
    });

    test('navigating from /dashboard/new (AR mode) to /ar keeps RTL', async ({
      page,
    }) => {
      await page.goto('/dashboard/new');

      // Switch to Arabic on dashboard
      await page.locator('app-header app-language-switcher button').click();
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');

      // Navigate to AR landing
      await page.goto('/ar');
      await expect(page).toHaveURL(/\/ar$/);
      await expect(page.locator('.landing-rtl')).toHaveAttribute('dir', 'rtl');
    });
  });
});
