import { test, expect } from '@playwright/test';
import { mockAuthRoutes } from './fixtures/auth.fixtures';
import { validCredentials } from './fixtures/users.fixtures';
import { login } from './utils/auth.utils';

test.describe('Booking Actions', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthRoutes(page);

    await page.route('**/api/v1/bookings/facilities', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'f1',
            name: 'Test Facility',
            openTime: '08:00',
            closeTime: '22:00',
            slotDurationMinutes: 60,
            basePrice: 150,
            currency: 'SAR',
          },
        ]),
      });
    });

    await page.route(/\/api\/v1\/bookings(?:\?.*)?$/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'test-booking-1',
            startTime: new Date().toISOString(),
            endTime: new Date(Date.now() + 3600000).toISOString(),
            customerName: 'Test Customer',
            customerPhone: '1234567890',
            status: 'CONFIRMED',
            paymentStatus: 'PENDING',
            facility: { id: 'f1', name: 'Test Facility' },
          },
        ]),
      });
    });

    await page.route(
      '**/api/v1/bookings/test-booking-1/status',
      async (route) => {
        const method = route.request().method();
        const postData = route.request().postDataJSON();

        if (method === 'PATCH' && postData.status === 'CANCELLED') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'test-booking-1',
              startTime: new Date().toISOString(),
              endTime: new Date(Date.now() + 3600000).toISOString(),
              customerName: 'Test Customer',
              customerPhone: '1234567890',
              status: 'CANCELLED',
              paymentStatus: 'PENDING',
              facility: { id: 'f1', name: 'Test Facility' },
            }),
          });
          return;
        }

        await route.fallback();
      }
    );

    await login(page, validCredentials.email, validCredentials.password);
    await expect(page).toHaveURL(/\/dashboard\/bookings/);
  });

  test('should allow cancelling a booking', async ({ page }) => {
    const bookingRow = page.locator('.data-table tbody tr', {
      hasText: 'Test Customer',
    });
    await expect(bookingRow).toBeVisible();
    await expect(bookingRow).toContainText(/Confirmed|مؤكد/i);

    const cancelButton = bookingRow.getByRole('button', {
      name: /cancel booking for test customer|إلغاء الحجز للعميل/i,
    });
    await expect(cancelButton).toBeVisible();
    await cancelButton.click();

    const dialog = page.locator('.confirmation-dialog');
    await expect(dialog).toBeVisible();
    await dialog
      .locator('textarea.cancel-form__input')
      .fill('Customer requested cancellation');

    await dialog
      .getByRole('button', { name: /cancel booking|إلغاء الحجز/i })
      .click();

    await expect(bookingRow).toContainText(/Cancelled|ملغي/i);
    await expect(
      bookingRow.getByRole('button', {
        name: /cancel booking for test customer|إلغاء الحجز للعميل/i,
      })
    ).toHaveCount(0);
  });
});
