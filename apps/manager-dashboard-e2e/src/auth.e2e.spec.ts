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
import { mockLoginResponse, mockTenant, mockUser } from './fixtures/test-data';

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
      /invalid credentials|بيانات الاعتماد/i,
    );
    await expect(page).toHaveURL(/\/login/);
  });

  test('protected routes redirect to login when unauthenticated', async ({
    page,
  }) => {
    await expectProtectedAccess(page);
    await expect(page).toHaveURL(/\/login/);
  });

  test('switch-account mode keeps the newer login when stale restore-session hydration resolves later', async ({
    page,
  }) => {
    const staleTenant = {
      ...mockTenant,
      id: '11111111-1111-4111-8111-111111111111',
      slug: 'admin-workspace',
      subdomain: 'admin-workspace',
      name: 'Admin Workspace',
    };
    const freshTenant = {
      ...mockTenant,
      id: '22222222-2222-4222-8222-222222222222',
      slug: 'manager-workspace',
      subdomain: 'manager-workspace',
      name: 'Manager Workspace',
    };
    const staleUser = {
      ...mockUser,
      id: 'user-stale',
      tenantId: staleTenant.id,
      email: 'admin@khana.com',
      name: 'Admin User',
    };
    const freshUser = {
      ...mockUser,
      id: 'user-fresh',
      tenantId: freshTenant.id,
      email: 'manager@khana.com',
      name: 'Manager User',
    };
    const freshResponse = {
      ...mockLoginResponse,
      accessToken: 'fresh-access-token',
      refreshToken: 'fresh-refresh-token',
      user: freshUser,
      tenant: freshTenant,
    };

    await page.addInitScript(() => {
      sessionStorage.setItem('khana_access_token', 'stale-access-token');
      sessionStorage.setItem('khana_refresh_token', 'stale-refresh-token');
      sessionStorage.setItem(
        'khana_tenant_id',
        '11111111-1111-4111-8111-111111111111',
      );
    });

    await page.route('**/api/v1/auth/tenant**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: freshTenant.id,
          name: freshTenant.name,
          slug: freshTenant.slug,
          timezone: freshTenant.timezone,
        }),
      });
    });

    await page.route('**/api/v1/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(freshResponse),
      });
    });

    await page.route('**/api/v1/auth/me', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(staleUser),
      });
    });

    await page.route('**/api/v1/auth/logout', async (route) => {
      await route.fulfill({ status: 204 });
    });

    await mockBookingsRoutes(page);

    await page.goto('/login?switch=1');
    await expect(page).toHaveURL(/\/login\?switch=1$/);

    await page.fill('#email', freshUser.email);
    await page.fill('#password', 'Password123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('.user-name')).toHaveText(freshUser.name);

    await page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/auth/me') && response.status() === 200,
    );

    await expect(page.locator('.user-name')).toHaveText(freshUser.name);
    await expect
      .poll(async () =>
        page.evaluate(() => ({
          accessToken: sessionStorage.getItem('khana_access_token'),
          tenantId: sessionStorage.getItem('khana_tenant_id'),
        })),
      )
      .toEqual({
        accessToken: 'fresh-access-token',
        tenantId: freshTenant.id,
      });
  });
});
