import { test, expect } from '@playwright/test';
import { mockAuthRoutes, getSessionTokens } from './fixtures/auth.fixtures';
import { mockFacilities } from './fixtures/test-data';
import { login, register, changePassword } from './utils/auth.utils';
import { validCredentials, registrationData } from './fixtures/users.fixtures';
import { mockBookingsRoutes } from './utils/navigation.utils';

test.describe('Authentication - error recovery', () => {
  test('shows login error on server failure', async ({ page }) => {
    await mockAuthRoutes(page, {
      login: {
        status: 500,
        body: { message: 'Server error' },
      },
    });

    await login(page, validCredentials.email, validCredentials.password);
    await expect(page.getByRole('alert')).toContainText(
      /server encountered|واجه الخادم/i
    );
    await expect(page).toHaveURL(/\/login/);
  });

  test('shows registration validation error', async ({ page }) => {
    await mockAuthRoutes(page, {
      register: {
        status: 400,
        body: { message: 'Validation failed' },
      },
    });

    await register(page, registrationData);
    await expect(page.getByRole('alert')).toContainText('Validation failed');
    await expect(page).toHaveURL(/\/register/);
  });

  test('shows incorrect current password error', async ({ page }) => {
    await mockAuthRoutes(page, {
      changePassword: {
        status: 401,
        body: { message: 'Current password is incorrect' },
      },
    });

    await mockBookingsRoutes(page);
    await login(page, validCredentials.email, validCredentials.password);
    await expect(page).toHaveURL(/\/dashboard/);
    await changePassword(page, 'WrongPassword1', 'NewPassword123');

    await expect(page.locator('#current-password-error')).toContainText(
      /current password is incorrect|كلمة المرور الحالية غير صحيحة/i
    );
  });

  test('redirects to login when refresh fails', async ({ page }) => {
    await mockAuthRoutes(page, {
      refresh: {
        status: 401,
        body: { message: 'Refresh token expired' },
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
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'Unauthorized' }),
        });
      }
    });

    await login(page, validCredentials.email, validCredentials.password);

    await page.waitForResponse('**/api/v1/auth/refresh');
    await expect(page).toHaveURL(/\/login/);

    const tokens = await getSessionTokens(page);
    expect(tokens.accessToken).toBeNull();
    expect(tokens.refreshToken).toBeNull();
  });
});
