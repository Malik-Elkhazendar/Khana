import { test, expect } from '@playwright/test';
import { setupAuthenticatedDashboard } from './helpers/dashboard.helpers';
import { mockAuthRoutes, seedSessionTokens } from './fixtures/auth.fixtures';
import { mockUser } from './fixtures/test-data';
import { mockBookingsRoutes } from './utils/navigation.utils';

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

      const facilityBox = await page
        .locator('app-header #dashboard-facility-switcher')
        .boundingBox();
      const languageBox = await page
        .locator('app-header app-language-switcher button')
        .boundingBox();
      const userBox = await page
        .locator('app-header .user-button')
        .boundingBox();

      expect(facilityBox).not.toBeNull();
      expect(languageBox).not.toBeNull();
      expect(userBox).not.toBeNull();

      expect(
        Math.abs((facilityBox?.y ?? 0) - (languageBox?.y ?? 0))
      ).toBeLessThan(8);
      expect(Math.abs((facilityBox?.y ?? 0) - (userBox?.y ?? 0))).toBeLessThan(
        8
      );
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

    test('/dashboard/facilities loads correctly', async ({ page }) => {
      await page.goto('/dashboard/facilities');
      await expect(page).toHaveURL(/\/dashboard\/facilities/);
      await expect(page.locator('h1.dashboard-page__title')).toContainText(
        /Facilities|المرافق/i
      );

      const titleBox = await page
        .locator('h1.dashboard-page__title')
        .boundingBox();
      expect(titleBox).not.toBeNull();
      expect(titleBox!.y).toBeLessThan(260);

      const breadcrumbCurrent = page.locator(
        'app-dashboard-breadcrumbs [aria-current="page"]'
      );
      await expect(breadcrumbCurrent).toBeVisible();

      const breadcrumbBox = await breadcrumbCurrent.boundingBox();
      expect(breadcrumbBox).not.toBeNull();
      expect(
        Math.abs((breadcrumbBox?.x ?? 0) - (titleBox?.x ?? 0))
      ).toBeLessThan(120);

      await expect(page.locator('app-header .header-actions')).toBeVisible();
    });

    test('/dashboard/team and /dashboard/settings load for allowed roles', async ({
      page,
    }) => {
      const meRequest = page.waitForResponse('**/api/v1/auth/me');
      await page.goto('/dashboard/bookings');
      await meRequest;
      await expect(page).toHaveURL(/\/dashboard\/bookings/);
      await expect(
        page.locator('a[href="/dashboard/team"]').first()
      ).toBeVisible();

      await page.goto('/dashboard/team');
      await expect(page).toHaveURL(/\/dashboard\/team/);

      await page.goto('/dashboard/settings');
      await expect(page).toHaveURL(/\/dashboard\/settings/);
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

  test.describe('Facility Context', () => {
    test('global facility selection persists across dashboard routes', async ({
      page,
    }) => {
      await page.goto('/dashboard/bookings');
      await page.selectOption(
        'app-header #dashboard-facility-switcher',
        'facility-2'
      );

      await expect(
        page.locator('app-header #dashboard-facility-switcher')
      ).toHaveValue('facility-2');

      await page.goto('/dashboard/calendar');
      await expect(
        page.locator('app-header #dashboard-facility-switcher')
      ).toHaveValue('facility-2');

      await page.goto('/dashboard/new');
      await expect(
        page.locator('app-header #dashboard-facility-switcher')
      ).toHaveValue('facility-2');
    });
  });

  test.describe('Breadcrumbs', () => {
    test('breadcrumbs are visible in LTR and RTL', async ({ page }) => {
      await page.goto('/dashboard/bookings');
      await expect(page.locator('app-dashboard-breadcrumbs nav')).toBeVisible();
      await expect(
        page.locator('app-dashboard-breadcrumbs [aria-current="page"]')
      ).toBeVisible();

      await page.locator('app-header app-language-switcher button').click();
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
      await expect(page.locator('app-dashboard-breadcrumbs nav')).toBeVisible();
    });
  });
});

test('team/settings are blocked for VIEWER role', async ({ page }) => {
  await seedSessionTokens(page);
  await mockAuthRoutes(page, {
    me: {
      status: 200,
      body: {
        ...mockUser,
        role: 'VIEWER',
      },
    },
  });
  await mockBookingsRoutes(page);

  const meRequest = page.waitForResponse('**/api/v1/auth/me');
  await page.goto('/dashboard/bookings');
  await meRequest;
  await expect(page).toHaveURL(/\/dashboard\/bookings/);
  await expect(page.locator('a[href="/dashboard/team"]')).toHaveCount(0);
  await expect(page.locator('a[href="/dashboard/settings"]')).toHaveCount(0);

  await page.goto('/dashboard/team');
  await expect(page).toHaveURL(/\/403$/);

  await page.goto('/dashboard/settings');
  await expect(page).toHaveURL(/\/403$/);
});
