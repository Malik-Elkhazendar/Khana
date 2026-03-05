import { expect, Page, test } from '@playwright/test';
import { setupAuthenticatedDashboard } from './helpers/dashboard.helpers';

async function mockAnalyticsRoutes(page: Page): Promise<void> {
  await page.route('**/api/v1/analytics/summary**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        totalBookings: 8,
        totalRevenue: 1440,
        totalCancellations: 1,
        cancellationRate: 12.5,
        avgBookingValue: 180,
        revenueComparison: {
          currentPeriodValue: 1440,
          previousPeriodValue: 1200,
          percentageChange: 20,
        },
        bookingsComparison: {
          currentPeriodValue: 8,
          previousPeriodValue: 6,
          percentageChange: 33.33,
        },
        goalProgress: {
          period: {
            monthStart: '2026-03-01T00:00:00.000Z',
            monthEnd: '2026-03-31T23:59:59.999Z',
            timeZone: 'Asia/Riyadh',
          },
          revenue: { target: 24000, actual: 1440, pct: 6, reached: false },
          occupancy: { target: 70, actual: 42.5, pct: 60.71, reached: false },
        },
        goalMilestones: [],
      }),
    });
  });

  await page.route('**/api/v1/analytics/occupancy**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        overallOccupancyRate: 42.5,
        facilities: [
          {
            facilityId: 'facility-1',
            facilityName: 'Main Hall',
            occupiedMinutes: 420,
            availableMinutes: 900,
            occupancyRate: 46.67,
            daily: [
              {
                date: '2026-03-01',
                occupiedMinutes: 210,
                availableMinutes: 450,
                occupancyRate: 46.67,
                bookingCount: 4,
              },
            ],
          },
        ],
      }),
    });
  });

  await page.route('**/api/v1/analytics/revenue**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        groupBy: 'day',
        trend: [
          {
            periodStart: '2026-03-01T00:00:00.000Z',
            periodLabel: '2026-03-01',
            revenue: 720,
            bookings: 4,
          },
        ],
        facilityPerformance: [
          {
            facilityId: 'facility-1',
            facilityName: 'Main Hall',
            totalBookings: 8,
            revenue: 1440,
            occupancyRate: 46.67,
            cancellationRate: 12.5,
          },
        ],
      }),
    });
  });

  await page.route('**/api/v1/analytics/peak-hours**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        peakTimeRange: '19:00-21:00',
        mostBookedFacility: 'Main Hall',
        mostBookedCourt: null,
      }),
    });
  });
}

test.describe('Analytics trends', () => {
  test('renders non-empty trend structure for sparse data', async ({
    page,
  }) => {
    await setupAuthenticatedDashboard(page);
    await mockAnalyticsRoutes(page);

    await page.goto('/dashboard/analytics');
    await expect(page).toHaveURL(/\/dashboard\/analytics$/);
    await expect(page.locator('app-analytics')).toBeVisible();

    await expect(
      page.locator('.analytics-filters__presets button')
    ).toHaveCount(5);
    await expect(page.locator('.analytics-kpis .kpi-card')).toHaveCount(5);
    await expect(page.locator('.analytics-grid .analytics-card')).toHaveCount(
      3
    );
    await expect(page.locator('.trend-chart')).toHaveCount(2);
    await expect(page.locator('.trend-chart__marker--last')).toHaveCount(2);
    await expect(page.locator('.trend-chart__ticks')).toHaveCount(2);
    await expect(page.locator('.trend-state-hint').first()).toBeVisible();

    const toggle = page.locator('.trend-details-toggle').first();
    await toggle.click();
    await expect(page.locator('.trend-data-table').first()).toBeVisible();
    await expect(
      page.locator('.analytics-card--insights .insights-list dt')
    ).toHaveCount(3);
    await expect(
      page.locator('.analytics-card--insights .insights-list dd').first()
    ).toBeVisible();
  });

  test('supports analytics chart layout on mobile viewport', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await setupAuthenticatedDashboard(page);
    await mockAnalyticsRoutes(page);

    await page.goto('/dashboard/analytics');
    await expect(page).toHaveURL(/\/dashboard\/analytics$/);
    await expect(page.locator('.trend-chart').first()).toBeVisible();
    await expect(page.locator('.trend-chart__tick')).toHaveCount(2);
  });

  test('keeps analytics usable after switching to Arabic RTL', async ({
    page,
  }) => {
    await setupAuthenticatedDashboard(page);
    await mockAnalyticsRoutes(page);

    await page.goto('/dashboard/analytics');
    await expect(page).toHaveURL(/\/dashboard\/analytics$/);

    const switcher = page.locator('app-language-switcher button').first();
    await expect(switcher).toBeVisible();
    await switcher.click();

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('.trend-chart').first()).toBeVisible();
  });
});
