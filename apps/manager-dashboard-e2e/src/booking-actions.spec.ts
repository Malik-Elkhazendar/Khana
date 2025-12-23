import { test, expect } from '@playwright/test';

test.describe('Booking Actions', () => {
  test.beforeEach(async ({ page }) => {
    // Mock facilities list
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

    // Mock the bookings list
    await page.route(/\/api\/v1\/bookings(?:\?.*)?$/, async (route) => {
      // Return a single confirmed booking
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

    // Mock the update endpoint
    await page.route(
      '**/api/v1/bookings/test-booking-1/status',
      async (route) => {
        const method = route.request().method();
        const postData = route.request().postDataJSON();

        if (method === 'PATCH' && postData.status === 'CANCELLED') {
          // Successful cancellation
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'test-booking-1',
              startTime: new Date().toISOString(),
              endTime: new Date(Date.now() + 3600000).toISOString(),
              customerName: 'Test Customer',
              customerPhone: '1234567890',
              status: 'CANCELLED', // Updated status
              paymentStatus: 'PENDING',
              facility: { id: 'f1', name: 'Test Facility' },
            }),
          });
        } else {
          await route.fallback();
        }
      }
    );

    await page.goto('/bookings');
  });

  test('should allow cancelling a booking', async ({ page }) => {
    // 1. Verify initial state
    const bookingRow = page.getByRole('row', { name: /Test Customer/ });
    await expect(bookingRow).toBeVisible();
    await expect(bookingRow).toContainText('Confirmed');

    // 2. Find and click cancel button
    // Note: The button has a title "Cancel Booking"
    const cancelButton = page.getByTitle('Cancel Booking');
    await expect(cancelButton).toBeVisible();

    // Setup dialog handler for confirm()
    page.on('dialog', (dialog) => dialog.accept());

    await cancelButton.click();

    // 3. Verify optimistic update (Status should change to Cancelled)
    await expect(page.getByText('Cancelled')).toBeVisible();

    // 4. Verify the button is gone (or logic hides it)
    await expect(cancelButton).not.toBeVisible();
  });
});
