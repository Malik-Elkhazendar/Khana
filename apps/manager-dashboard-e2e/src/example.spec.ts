import { test, expect } from '@playwright/test';

test('shows the landing hero heading', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    /Never Lose|لا تخسر/i
  );
});
