import { test, expect } from '@playwright/test';
import {
  mockAuthRoutes,
  seedSessionTokens,
  getSessionTokens,
} from './fixtures/auth.fixtures';
import {
  mockBookings,
  mockFacilities,
  mockRefreshResponse,
  mockTokens,
} from './fixtures/test-data';
import { login } from './utils/auth.utils';
import { validCredentials } from './fixtures/users.fixtures';
import { mockBookingsRoutes } from './utils/navigation.utils';

test.describe('Authentication - session management', () => {
  test('refreshes access token on 401 and retries request', async ({
    page,
  }) => {
    let bookingCalls = 0;
    let refreshCalls = 0;

    page.on('request', (request) => {
      if (request.url().includes('/api/v1/auth/refresh')) {
        refreshCalls += 1;
      }
    });

    await mockAuthRoutes(page, {
      refresh: {
        status: 200,
        body: mockRefreshResponse,
      },
    });

    await page.route('**/api/v1/bookings**', async (route) => {
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
        bookingCalls += 1;
        if (bookingCalls === 1) {
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ message: 'Unauthorized' }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockBookings),
          });
        }
      }
    });

    await login(page, validCredentials.email, validCredentials.password);

    await page.waitForResponse('**/api/v1/auth/refresh');

    expect(refreshCalls).toBe(1);
    expect(bookingCalls).toBeGreaterThanOrEqual(1);
    await expect(page).toHaveURL(/\/dashboard/);

    const tokens = await getSessionTokens(page);
    expect(tokens.accessToken).toBe(mockRefreshResponse.accessToken);
    expect(tokens.refreshToken).toBe(mockRefreshResponse.refreshToken);
  });

  test('restores session after page refresh', async ({ page }) => {
    await mockAuthRoutes(page);
    await mockBookingsRoutes(page);
    await seedSessionTokens(page, mockTokens);

    await page.goto('/dashboard/bookings');
    await expect(page).toHaveURL(/\/dashboard/);

    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);

    const tokens = await getSessionTokens(page);
    expect(tokens.accessToken).toBe(mockTokens.accessToken);
    expect(tokens.refreshToken).toBe(mockTokens.refreshToken);
  });

  test('restores session in a new tab with seeded tokens', async ({
    context,
  }) => {
    const page = await context.newPage();
    await mockAuthRoutes(page);
    await mockBookingsRoutes(page);
    await seedSessionTokens(page, mockTokens);

    await page.goto('/dashboard/bookings');
    await expect(page).toHaveURL(/\/dashboard/);

    const tokens = await getSessionTokens(page);
    expect(tokens.accessToken).toBe(mockTokens.accessToken);
    expect(tokens.refreshToken).toBe(mockTokens.refreshToken);
  });
});
