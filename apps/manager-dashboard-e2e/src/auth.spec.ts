import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test('should login successfully, access dashboard, and logout', async ({
    page,
  }) => {
    // Debug: Log all console messages
    page.on('console', (msg) => console.log(`BROWSER: ${msg.text()}`));
    page.on('response', (response) => {
      if (response.status() >= 400) {
        console.log(`HTTP ERROR: ${response.status()} ${response.url()}`);
      }
    });

    // 1. Login Flow
    await page.goto('/login');

    await page.fill('#email', 'admin@khana.com');
    await page.fill('#password', 'Password123!');
    await page.click('button.btn-primary');

    // Verify redirect to dashboard
    await expect(page).toHaveURL(/\/dashboard/);

    // Verify tokens in localStorage
    const accessToken = await page.evaluate(() =>
      localStorage.getItem('accessToken')
    );
    const refreshToken = await page.evaluate(() =>
      localStorage.getItem('refreshToken')
    );
    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();

    // 2. Dashboard Access
    // Verify dashboard content loads
    // await expect(page.locator('h1')).not.toBeEmpty();

    // 3. Token Refresh (Hard to simulate easily in strict E2E without mocking, skipping for basic success flow)

    // 4. Logout
    // Open user menu first
    await page.click('button.user-button');
    // Click logout button
    await page.getByText('Logout').click();
    await expect(page).toHaveURL(/\/login/);

    const accessTokenAfterLogout = await page.evaluate(() =>
      localStorage.getItem('accessToken')
    );
    expect(accessTokenAfterLogout).toBeFalsy();
  });

  test('should protect dashboard route', async ({ page }) => {
    // 5. Protected Route Guard
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
