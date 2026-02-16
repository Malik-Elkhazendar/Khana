import { Page, Route } from '@playwright/test';
import {
  mockLoginResponse,
  mockRefreshResponse,
  mockUser,
  mockTokens,
} from './test-data';

type RouteConfig = {
  status?: number;
  body?: unknown;
};

export type AuthRouteOverrides = {
  login?: RouteConfig;
  register?: RouteConfig;
  refresh?: RouteConfig;
  me?: RouteConfig;
  changePassword?: RouteConfig;
  logout?: RouteConfig;
};

const defaultRoutes: Required<AuthRouteOverrides> = {
  login: { status: 200, body: mockLoginResponse },
  register: { status: 200, body: mockLoginResponse },
  refresh: { status: 200, body: mockRefreshResponse },
  me: { status: 200, body: mockUser },
  changePassword: { status: 204, body: null },
  logout: { status: 204, body: {} },
};

export async function mockAuthRoutes(
  page: Page,
  overrides: AuthRouteOverrides = {}
): Promise<void> {
  const routes = { ...defaultRoutes, ...overrides };

  await routeJson(page, '**/api/v1/auth/login', routes.login);
  await routeJson(page, '**/api/v1/auth/register', routes.register);
  await routeJson(page, '**/api/v1/auth/refresh', routes.refresh);
  await routeJson(page, '**/api/v1/auth/me', routes.me);
  await routeJson(page, '**/api/v1/auth/change-password', routes.changePassword);
  await routeJson(page, '**/api/v1/auth/logout', routes.logout);
}

export async function seedSessionTokens(
  page: Page,
  tokens = mockTokens
): Promise<void> {
  await page.addInitScript((seed) => {
    sessionStorage.setItem('khana_access_token', seed.accessToken);
    sessionStorage.setItem('khana_refresh_token', seed.refreshToken);
  }, tokens);
}

export async function getSessionTokens(page: Page): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
}> {
  return page.evaluate(() => {
    return {
      accessToken: sessionStorage.getItem('khana_access_token'),
      refreshToken: sessionStorage.getItem('khana_refresh_token'),
    };
  });
}

async function routeJson(
  page: Page,
  url: string,
  config: RouteConfig
): Promise<void> {
  await page.route(url, async (route: Route) => {
    if (config.status === 204) {
      await route.fulfill({ status: 204 });
      return;
    }

    await route.fulfill({
      status: config.status ?? 200,
      contentType: 'application/json',
      body: JSON.stringify(config.body ?? {}),
    });
  });
}
