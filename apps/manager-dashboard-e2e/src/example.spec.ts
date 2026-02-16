import { test, expect } from '@playwright/test';

test('shows the bookings heading', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Bookings'
  );
});
