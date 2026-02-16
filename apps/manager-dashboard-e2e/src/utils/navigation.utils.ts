import { Page, Route } from '@playwright/test';
import { mockBookings, mockFacilities } from '../fixtures/test-data';

export async function mockBookingsRoutes(page: Page): Promise<void> {
  await page.route('**/api/v1/bookings**', async (route: Route) => {
    const url = route.request().url();

    if (url.includes('/bookings/facilities')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockFacilities),
      });
      return;
    }

    if (url.includes('/bookings')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockBookings),
      });
      return;
    }

    await route.fulfill({ status: 404 });
  });
}

export async function mockFacilitiesOnly(page: Page): Promise<void> {
  await page.route('**/api/v1/bookings/facilities', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockFacilities),
    });
  });
}
