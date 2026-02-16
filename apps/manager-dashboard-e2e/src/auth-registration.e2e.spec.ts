import { test, expect } from '@playwright/test';
import { mockAuthRoutes } from './fixtures/auth.fixtures';
import { mockBookingsRoutes } from './utils/navigation.utils';
import { register, getAccessToken, getRefreshToken } from './utils/auth.utils';
import { registrationData } from './fixtures/users.fixtures';
import { mockLoginResponse } from './fixtures/test-data';

test.describe('Authentication - registration', () => {
  test('registers and auto login', async ({ page }) => {
    await mockAuthRoutes(page);
    await mockBookingsRoutes(page);

    await register(page, registrationData);
    await expect(page).toHaveURL(/\/dashboard/);

    expect(await getAccessToken(page)).toBe(mockLoginResponse.accessToken);
    expect(await getRefreshToken(page)).toBe(mockLoginResponse.refreshToken);
  });

  test('shows duplicate email error on 409', async ({ page }) => {
    await mockAuthRoutes(page, {
      register: {
        status: 409,
        body: { message: 'Email already in use' },
      },
    });

    await register(page, registrationData);

    await expect(page).toHaveURL(/\/register/);
    await expect(page.locator('#email-error')).toContainText(
      'Email already in use'
    );
  });
});
