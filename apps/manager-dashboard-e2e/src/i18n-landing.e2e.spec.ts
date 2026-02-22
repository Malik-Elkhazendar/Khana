import { test, expect } from '@playwright/test';
import {
  assertNoPlaceholderLinks,
  getDocumentDir,
  getDocumentLang,
  clickLanguageSwitcher,
  LANDING_SECTION_IDS,
  EN_NAV_LABELS,
  AR_NAV_LABELS,
} from './helpers/landing.helpers';

test.describe('Landing Page i18n & Routing', () => {
  test.describe('EN Landing — Route /', () => {
    test('renders LTR direction with English lang attribute', async ({
      page,
    }) => {
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    });

    test('displays English nav labels in desktop header', async ({ page }) => {
      await page.goto('/');
      const nav = page.locator(
        'app-landing-header nav[aria-label="Primary navigation"]'
      );
      await expect(nav).toBeVisible();

      for (const label of EN_NAV_LABELS) {
        await expect(
          nav.getByRole('button', { name: new RegExp(label, 'i') })
        ).toBeVisible();
      }
    });

    test('has correct section anchor IDs', async ({ page }) => {
      await page.goto('/');
      for (const sectionId of LANDING_SECTION_IDS) {
        await expect(page.locator(`#${sectionId}`)).toBeAttached();
      }
    });

    test('header CTA links point to /login and /register', async ({ page }) => {
      await page.goto('/');
      await expect(
        page.getByRole('link', { name: 'Log in to your account' }).first()
      ).toHaveAttribute('href', '/login');

      await expect(
        page.getByRole('link', { name: 'Start your free trial' }).first()
      ).toHaveAttribute('href', '/register');
    });

    test('footer links have no placeholder "#" hrefs', async ({ page }) => {
      await page.goto('/');
      await assertNoPlaceholderLinks(page, 'app-landing-footer footer');
    });

    test('does not accidentally redirect to /ar', async ({ page }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/^http:\/\/localhost:\d+\/$/);
    });
  });

  test.describe('AR Landing — Route /ar', () => {
    test('renders RTL direction with Arabic lang attribute', async ({
      page,
    }) => {
      await page.goto('/ar');
      // AR landing wraps content in dir="rtl" lang="ar" container
      await expect(page.locator('.landing-rtl')).toHaveAttribute('dir', 'rtl');
      await expect(page.locator('.landing-rtl')).toHaveAttribute('lang', 'ar');
    });

    test('displays Arabic nav labels in desktop header', async ({ page }) => {
      await page.goto('/ar');
      const nav = page.locator(
        'app-landing-header-ar nav[aria-label="التنقل الرئيسي"]'
      );
      await expect(nav).toBeVisible();

      for (const label of AR_NAV_LABELS) {
        await expect(
          nav.getByRole('button', { name: new RegExp(label) })
        ).toBeVisible();
      }
    });

    test('has correct section anchor IDs', async ({ page }) => {
      await page.goto('/ar');
      for (const sectionId of LANDING_SECTION_IDS) {
        await expect(page.locator(`#${sectionId}`)).toBeAttached();
      }
    });

    test('AR footer links stay on /ar and do not leak to EN anchors', async ({
      page,
    }) => {
      await page.goto('/ar');
      const footer = page.locator('app-landing-footer-ar footer');

      // Click AR footer section links and verify they remain on /ar#...
      await footer.getByRole('link', { name: 'الميزات' }).click();
      await expect(page).toHaveURL(/\/ar#features$/);

      await footer.getByRole('link', { name: 'كيف تعمل خانة' }).click();
      await expect(page).toHaveURL(/\/ar#how-it-works$/);

      await footer.getByRole('link', { name: 'آراء العملاء' }).click();
      await expect(page).toHaveURL(/\/ar#testimonials$/);
    });

    test('footer links have no placeholder "#" hrefs', async ({ page }) => {
      await page.goto('/ar');
      await assertNoPlaceholderLinks(page, 'app-landing-footer-ar footer');
    });

    test('does not leak to EN route "/"', async ({ page }) => {
      await page.goto('/ar');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/ar$/);
    });
  });

  test.describe('Language Switch — Landing Pages', () => {
    test('switching from EN to AR navigates to /ar and sets RTL', async ({
      page,
    }) => {
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

      await clickLanguageSwitcher(page, 'app-landing-header');

      await expect(page).toHaveURL(/\/ar$/);
      // After navigation to /ar, the AR landing sets direction via container
      await expect(page.locator('.landing-rtl')).toHaveAttribute('dir', 'rtl');
    });

    test('switching from AR to EN navigates to / and sets LTR', async ({
      page,
    }) => {
      await page.goto('/ar');
      await expect(page.locator('.landing-rtl')).toHaveAttribute('dir', 'rtl');

      await clickLanguageSwitcher(page, 'app-landing-header-ar');

      await expect(page).toHaveURL(/\/$/);
      await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
    });

    test('round-trip EN→AR→EN preserves correct state', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

      // EN → AR
      await clickLanguageSwitcher(page, 'app-landing-header');
      await expect(page).toHaveURL(/\/ar$/);
      await expect(page.locator('.landing-rtl')).toHaveAttribute('dir', 'rtl');

      // AR → EN
      await clickLanguageSwitcher(page, 'app-landing-header-ar');
      await expect(page).toHaveURL(/\/$/);
      await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
      await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    });
  });

  test.describe('Placeholder Link Audit', () => {
    test('EN landing has no dead "#" links in header', async ({ page }) => {
      await page.goto('/');
      await assertNoPlaceholderLinks(page, 'app-landing-header');
    });

    test('AR landing has no dead "#" links in header', async ({ page }) => {
      await page.goto('/ar');
      await assertNoPlaceholderLinks(page, 'app-landing-header-ar');
    });

    test('EN landing actionable CTA links are not bare "#"', async ({
      page,
    }) => {
      await page.goto('/');
      // Check all links with class containing "btn" are real
      const ctaLinks = page.locator(
        '.landing-main a.btn, .landing-main a[routerLink]'
      );
      const count = await ctaLinks.count();
      for (let i = 0; i < count; i += 1) {
        const href = await ctaLinks.nth(i).getAttribute('href');
        if (href) {
          expect(href).not.toBe('#');
        }
      }
    });
  });
});
