import { test, expect } from '@playwright/test';

test.describe('Reset Password Route', () => {
  test('renders form correctly with token in query string', async ({
    page,
  }) => {
    await page.goto('/reset-password?token=test-reset-token-abc123');

    // Form should be visible with password fields
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Password input fields should be present
    const newPasswordInput = page.locator('#newPassword');
    await expect(newPasswordInput).toBeVisible();
    await expect(newPasswordInput).toHaveAttribute('type', 'password');

    const confirmPasswordInput = page.locator('#confirmPassword');
    await expect(confirmPasswordInput).toBeVisible();
    await expect(confirmPasswordInput).toHaveAttribute('type', 'password');

    // Submit button should be enabled (valid token present)
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
    await expect(submitButton).toBeEnabled();
  });

  test('does not require manual token input — reads from URL', async ({
    page,
  }) => {
    await page.goto('/reset-password?token=valid-token-xyz');

    // There should be no visible text input for the token
    const tokenInput = page.locator('input[name="token"], input#token');
    await expect(tokenInput).toHaveCount(0);

    // Submit button should be enabled since token is auto-read
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeEnabled();
  });

  test('shows error when token is missing', async ({ page }) => {
    await page.goto('/reset-password');

    // Should show an error alert about invalid/missing link
    const errorAlert = page.locator('[role="alert"]');
    await expect(errorAlert).toBeVisible();

    // Submit button should be disabled without valid token
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeDisabled();
  });

  test('shows error when token is empty', async ({ page }) => {
    await page.goto('/reset-password?token=');

    // Should show error since empty token is invalid
    const errorAlert = page.locator('[role="alert"]');
    await expect(errorAlert).toBeVisible();

    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeDisabled();
  });

  test('has "Back to login" link pointing to /login', async ({ page }) => {
    await page.goto('/reset-password?token=test-token');

    const loginLink = page.getByRole('link', { name: /sign in/i });
    await expect(loginLink).toBeVisible();
    await expect(loginLink).toHaveAttribute('href', '/login');
  });

  test('legacy route /auth/reset-password also works', async ({ page }) => {
    await page.goto('/auth/reset-password?token=legacy-token');

    // Form should render (same component)
    const newPasswordInput = page.locator('#newPassword');
    await expect(newPasswordInput).toBeVisible();

    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeEnabled();
  });
});
