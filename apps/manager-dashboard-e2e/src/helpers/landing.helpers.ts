import { Page, expect } from '@playwright/test';

/**
 * Asserts that all .nav-link elements within a container have valid href attributes
 * (not placeholder '#' or '/#' values).
 */
export async function assertNoPlaceholderLinks(
  page: Page,
  containerSelector: string
): Promise<void> {
  const links = page.locator(`${containerSelector} a[href]`);
  const count = await links.count();

  for (let i = 0; i < count; i += 1) {
    const href = await links.nth(i).getAttribute('href');
    expect(
      href,
      `Link ${i} in ${containerSelector} should not be empty`
    ).toBeTruthy();
    expect(
      href,
      `Link ${i} in ${containerSelector} should not be bare "#"`
    ).not.toBe('#');
  }
}

/**
 * Gets the document direction attribute.
 */
export async function getDocumentDir(page: Page): Promise<string | null> {
  return page.locator('html').getAttribute('dir');
}

/**
 * Gets the document lang attribute.
 */
export async function getDocumentLang(page: Page): Promise<string | null> {
  return page.locator('html').getAttribute('lang');
}

/**
 * Clicks the language switcher within a given container.
 */
export async function clickLanguageSwitcher(
  page: Page,
  containerSelector: string
): Promise<void> {
  await page
    .locator(`${containerSelector} app-language-switcher button`)
    .first()
    .click();
}

/**
 * Section IDs expected on both EN and AR landing pages.
 */
export const LANDING_SECTION_IDS = [
  'hero',
  'problem-solution',
  'features',
  'how-it-works',
  'testimonials',
  'cta',
] as const;

/**
 * EN landing nav labels (desktop header).
 */
export const EN_NAV_LABELS = ['Features', 'How It Works', 'Testimonials'];

/**
 * AR landing nav labels (desktop header).
 */
export const AR_NAV_LABELS = ['الميزات', 'كيف تعمل', 'آراء العملاء'];
