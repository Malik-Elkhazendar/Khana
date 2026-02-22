import { test, expect } from '@playwright/test';
import { mockAuthRoutes } from './fixtures/auth.fixtures';
import { mockBookingsRoutes } from './utils/navigation.utils';
import {
  login,
  logout,
  getAccessToken,
  getRefreshToken,
  expectProtectedAccess,
} from './utils/auth.utils';
import {
  validCredentials,
  invalidCredentials,
} from './fixtures/users.fixtures';
import { mockLoginResponse } from './fixtures/test-data';

test.describe('Authentication - core flows', () => {
  test('login, reach dashboard, and logout', async ({ page }) => {
    await mockAuthRoutes(page);
    await mockBookingsRoutes(page);

    await login(page, validCredentials.email, validCredentials.password);
    await expect(page).toHaveURL(/\/dashboard/);

    expect(await getAccessToken(page)).toBe(mockLoginResponse.accessToken);
    expect(await getRefreshToken(page)).toBe(mockLoginResponse.refreshToken);

    await logout(page);
    await expect(page).toHaveURL(/\/login/);

    expect(await getAccessToken(page)).toBeNull();
    expect(await getRefreshToken(page)).toBeNull();
  });

  test('invalid login shows error', async ({ page }) => {
    await mockAuthRoutes(page, {
      login: {
        status: 401,
        body: { message: 'Invalid credentials' },
      },
    });

    await login(page, invalidCredentials.email, invalidCredentials.password);

    await expect(page.getByRole('alert')).toContainText(
      /invalid credentials|بيانات الاعتماد/i
    );
    await expect(page).toHaveURL(/\/login/);
  });

  test('protected routes redirect to login when unauthenticated', async ({
    page,
  }) => {
    await expectProtectedAccess(page);
  });
});
