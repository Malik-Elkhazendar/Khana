import { test, expect } from '@playwright/test';
import { mockAuthRoutes, seedSessionTokens } from './fixtures/auth.fixtures';

test.describe('Booking Calendar', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthRoutes(page);
    await seedSessionTokens(page);

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

    await page.route(/\/api\/v1\/bookings\/[^/]+$/, async (route) => {
      const now = new Date();
      const todayAt = (hour: number, minute = 0) => {
        const date = new Date(now);
        date.setHours(hour, minute, 0, 0);
        return date.toISOString();
      };

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: '1',
          bookingReference: 'BK-001',
          startTime: todayAt(10, 0),
          endTime: todayAt(11, 0),
          customerName: 'Standard Booking',
          customerPhone: '1234567890',
          status: 'CONFIRMED',
          paymentStatus: 'PAID',
          currency: 'SAR',
          priceBreakdown: {
            basePrice: 200,
            timeMultiplier: 1,
            dayMultiplier: 1,
            durationDiscount: 0,
            subtotal: 200,
            discountAmount: 20,
            promoDiscount: 20,
            promoCode: 'SAVE20',
            total: 180,
            currency: 'SAR',
          },
          facility: { id: 'f1', name: 'Tennis Court 1' },
        }),
      });
    });

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard\/(bookings|analytics)/);

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
    const longRect = longBox as NonNullable<typeof longBox>;
    const overlapRect = overlapBox as NonNullable<typeof overlapBox>;
    expect(Math.abs(longRect.y - overlapRect.y)).toBeLessThan(8);
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

    expect(standardBox).not.toBeNull();
    expect(longBox).not.toBeNull();
    const standardRect = standardBox as NonNullable<typeof standardBox>;
    const longRect = longBox as NonNullable<typeof longBox>;
    const ratio = longRect.height / standardRect.height;
    expect(ratio).toBeGreaterThan(1.35);
    expect(ratio).toBeLessThan(1.7);
  });

  test('should jump to a selected date and return to today', async ({
    page,
  }) => {
    const jumpDateInput = page.locator('#calendar-jump-date');
    const weekLabel = page.locator('.dashboard-page__subtitle');
    const todayButton = page.locator('.calendar__today-btn');

    await expect(jumpDateInput).toBeVisible();
    await expect(todayButton).toBeVisible();

    const initialWeekLabel = await weekLabel.textContent();
    const todayValue = await page.evaluate(() => {
      const date = new Date();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${date.getFullYear()}-${month}-${day}`;
    });
    const futureValue = await page.evaluate(() => {
      const date = new Date();
      date.setMonth(date.getMonth() + 2);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${date.getFullYear()}-${month}-${day}`;
    });

    await jumpDateInput.fill(futureValue);
    await jumpDateInput.dispatchEvent('change');

    await expect(jumpDateInput).toHaveValue(futureValue);
    await expect(weekLabel).not.toHaveText(initialWeekLabel ?? '');

    await expect(todayButton).toBeEnabled();
    await todayButton.click();

    await expect(jumpDateInput).toHaveValue(todayValue);
  });

  test('opens inline booking detail panel without navigating away', async ({
    page,
  }) => {
    const bookingCard = page.locator('.calendar__booking', {
      hasText: 'Standard Booking',
    });

    await expect(bookingCard).toBeVisible();
    await bookingCard.click();

    await expect(page).toHaveURL(/\/dashboard\/calendar/);
    await expect(page.locator('.calendar-detail-panel')).toBeVisible();
    await expect(page.locator('.calendar-detail-panel')).toContainText(
      'Standard Booking'
    );
  });

  test('navigates to full details page from inline panel', async ({ page }) => {
    const bookingCard = page.locator('.calendar__booking', {
      hasText: 'Standard Booking',
    });
    await bookingCard.click();

    const fullDetails = page.locator('.calendar-detail-panel__full-link');
    await expect(fullDetails).toBeVisible();
    await fullDetails.click();

    await expect(page).toHaveURL(/\/dashboard\/bookings\/1$/);
    await expect(page.locator('h1.dashboard-page__title')).toContainText(
      'Booking details'
    );
  });
});
