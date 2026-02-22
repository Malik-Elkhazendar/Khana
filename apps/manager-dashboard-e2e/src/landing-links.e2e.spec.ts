import { expect, Page, test } from '@playwright/test';

async function assertNoPlaceholderFooterLinks(
  footerSelector: string,
  pageUrl: string,
  page: Page
): Promise<void> {
  await page.goto(pageUrl);
  const links = page.locator(`${footerSelector} .nav-link`);
  const count = await links.count();

  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i += 1) {
    const href = await links.nth(i).getAttribute('href');
    expect(href).toBeTruthy();
    expect(href).not.toBe('#');
    expect(href).not.toBe('/#');
  }
}

test.describe('Landing Focused QA', () => {
  test('EN landing header/footer/hero links are valid', async ({ page }) => {
    await page.goto('/');

    await expect(
      page.getByRole('link', { name: 'Log in to your account' }).first()
    ).toHaveAttribute('href', '/login');

    await expect(
      page.getByRole('link', { name: 'Start your free trial' }).first()
    ).toHaveAttribute('href', '/register');

    await expect(
      page
        .getByRole('link', {
          name: /Start your free trial - no credit card required/i,
        })
        .first()
    ).toHaveAttribute('href', '/register');

    await assertNoPlaceholderFooterLinks(
      'app-landing-footer footer',
      '/',
      page
    );
  });

  test('AR landing links stay on /ar and do not leak to /#...', async ({
    page,
  }) => {
    await page.goto('/ar');
    const footer = page.locator('app-landing-footer-ar footer');

    await footer.getByRole('link', { name: 'الميزات' }).click();
    await expect(page).toHaveURL(/\/ar#features$/);

    await footer.getByRole('link', { name: 'كيف تعمل خانة' }).click();
    await expect(page).toHaveURL(/\/ar#how-it-works$/);

    await footer.getByRole('link', { name: 'آراء العملاء' }).click();
    await expect(page).toHaveURL(/\/ar#testimonials$/);

    await footer.getByRole('link', { name: 'ابدأ مجاناً' }).click();
    await expect(page).toHaveURL(/\/ar#cta$/);

    await assertNoPlaceholderFooterLinks(
      'app-landing-footer-ar footer',
      '/ar',
      page
    );
  });

  test('Language switch works on / and /ar', async ({ page }) => {
    await page.goto('/');
    await page
      .locator('app-landing-header app-language-switcher button')
      .first()
      .click();
    await expect(page).toHaveURL(/\/ar$/);

    await page
      .locator('app-landing-header-ar app-language-switcher button')
      .first()
      .click();
    await expect(page).toHaveURL(/\/$/);
  });
});
