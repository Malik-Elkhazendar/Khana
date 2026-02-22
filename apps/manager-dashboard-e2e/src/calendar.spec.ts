import { test, expect } from '@playwright/test';
import { mockAuthRoutes } from './fixtures/auth.fixtures';
import { validCredentials } from './fixtures/users.fixtures';
import { login } from './utils/auth.utils';

test.describe('Booking Calendar', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthRoutes(page);

    await page.route('**/api/v1/bookings/facilities', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'f1',
            name: 'Tennis Court 1',
            openTime: '08:00',
            closeTime: '23:00',
            slotDurationMinutes: 60,
            basePrice: 200,
            currency: 'SAR',
          },
          {
            id: 'f2',
            name: 'Tennis Court 2',
            openTime: '08:00',
            closeTime: '23:00',
            slotDurationMinutes: 60,
            basePrice: 200,
            currency: 'SAR',
          },
        ]),
      });
    });

    await page.route(/\/api\/v1\/bookings(?:\?.*)?$/, async (route) => {
      const now = new Date();
      const todayAt = (hour: number, minute = 0) => {
        const date = new Date(now);
        date.setHours(hour, minute, 0, 0);
        return date.toISOString();
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
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
        ]),
      });
    });

    await login(page, validCredentials.email, validCredentials.password);
    await expect(page).toHaveURL(/\/dashboard\/bookings/);

    await page.goto('/dashboard/calendar');
    await expect(page).toHaveURL(/\/dashboard\/calendar/);
  });

  test('should render the calendar grid', async ({ page }) => {
    await expect(page.locator('.calendar__grid')).toBeVisible();
    await expect(page.locator('h1.dashboard-page__title')).toBeVisible();
  });

  test('should render time slots', async ({ page }) => {
    const timeLabels = page.locator('.calendar__time-label');
    await expect(timeLabels.first()).toBeVisible();
    await expect(timeLabels.last()).toBeVisible();
  });

  test('should render overlapping bookings correctly', async ({ page }) => {
    const longBooking = page.locator('.calendar__booking', {
      hasText: 'Long Booking',
    });
    const overlapBooking = page.locator('.calendar__booking', {
      hasText: 'Overlap Booking',
    });

    await expect(longBooking).toBeVisible();
    await expect(overlapBooking).toBeVisible();

    const longBox = await longBooking.boundingBox();
    const overlapBox = await overlapBooking.boundingBox();

    expect(longBox).not.toBeNull();
    expect(overlapBox).not.toBeNull();

    if (longBox && overlapBox) {
      expect(Math.abs(longBox.y - overlapBox.y)).toBeLessThan(8);
    }
  });

  test('should render precise height for 90-minute booking', async ({
    page,
  }) => {
    const standardBooking = page.locator('.calendar__booking', {
      hasText: 'Standard Booking',
    });
    const longBooking = page.locator('.calendar__booking', {
      hasText: 'Long Booking',
    });

    await expect(standardBooking).toBeVisible();
    await expect(longBooking).toBeVisible();

    const standardBox = await standardBooking.boundingBox();
    const longBox = await longBooking.boundingBox();

    if (standardBox && longBox) {
      const ratio = longBox.height / standardBox.height;
      expect(ratio).toBeGreaterThan(1.35);
      expect(ratio).toBeLessThan(1.7);
    }
  });
});
