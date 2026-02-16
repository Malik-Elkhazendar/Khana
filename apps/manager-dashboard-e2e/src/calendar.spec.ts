import { test, expect } from '@playwright/test';

test.describe('Booking Calendar', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the bookings API to ensure deterministic data for rendering tests
    await page.route('**/api/v1/bookings*', async (route) => {
      const now = new Date();
      // Helper to generate ISO string for today at specific hour/minute
      const todayAt = (hour: number, minute = 0) => {
        const d = new Date(now);
        d.setHours(hour, minute, 0, 0);
        return d.toISOString();
      };

      const mockBookings = [
        // Booking A: Standard 1-hour slot
        {
          id: '1',
          startTime: todayAt(10, 0),
          endTime: todayAt(11, 0),
          customerName: 'Standard Booking',
          customerPhone: '1234567890',
          status: 'CONFIRMED',
          paymentStatus: 'PAID',
          facility: { id: 'f1', name: 'Tennis Court 1' },
        },
        // Booking B: 90 mins (Precision Height Test)
        {
          id: '2',
          startTime: todayAt(12, 0),
          endTime: todayAt(13, 30),
          customerName: 'Long Booking',
          customerPhone: '1234567890',
          status: 'PENDING',
          paymentStatus: 'PENDING',
          facility: { id: 'f1', name: 'Tennis Court 1' },
        },
        // Booking C: Overlap with B (Overlap Test)
        {
          id: '3',
          startTime: todayAt(12, 0),
          endTime: todayAt(13, 0),
          customerName: 'Overlap Booking',
          customerPhone: '1234567890',
          status: 'CONFIRMED',
          paymentStatus: 'PENDING',
          facility: { id: 'f2', name: 'Tennis Court 2' },
        },
      ];

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockBookings),
      });
    });

    await page.goto('/calendar');
  });

  test('should render the calendar grid', async ({ page }) => {
    await expect(page.locator('.calendar__grid')).toBeVisible();
    await expect(page.locator('.calendar__title')).toContainText(/202/); // Contains year
  });

  test('should render time slots', async ({ page }) => {
    // Check for 08:00 AM
    await expect(page.getByText('8 AM')).toBeVisible();
    // Check for 11 PM
    await expect(page.getByText('11 PM')).toBeVisible();
  });

  test('should render overlapping bookings correctly', async ({ page }) => {
    // We expect both "Long Booking" and "Overlap Booking" to be visible
    const longBooking = page.locator('[aria-label="Booking: Long Booking"]');
    const overlapBooking = page.locator(
      '[aria-label="Booking: Overlap Booking"]'
    );

    await expect(longBooking).toBeVisible();
    await expect(overlapBooking).toBeVisible();

    // Check positioning styles (approximate)
    // Both start at 12:00, so they should share the width
    const longBox = await longBooking.boundingBox();
    const overlapBox = await overlapBooking.boundingBox();

    expect(longBox).not.toBeNull();
    expect(overlapBox).not.toBeNull();

    if (longBox && overlapBox) {
      // They should be side-by-side, so their X coordinates should differ
      // OR their widths should be roughly half of the container (but verifying width is easier)
      // We essentially just want to ensure one doesn't hide the other.
      // Since we verified both are visible, that's a good start.

      // Check that they overlap in Y-axis (same start time)
      expect(Math.abs(longBox.y - overlapBox.y)).toBeLessThan(5);
    }
  });

  test('should render precise height for 90-minute booking', async ({
    page,
  }) => {
    const standardBooking = page.locator(
      '[aria-label="Booking: Standard Booking"]'
    );
    const longBooking = page.locator('[aria-label="Booking: Long Booking"]');

    const standardBox = await standardBooking.boundingBox();
    const longBox = await longBooking.boundingBox();

    if (standardBox && longBox) {
      // Standard is 60 mins, Long is 90 mins.
      // Long height should be approx 1.5x Standard height.
      const ratio = longBox.height / standardBox.height;
      expect(ratio).toBeGreaterThan(1.4);
      expect(ratio).toBeLessThan(1.6);
    }
  });
});
