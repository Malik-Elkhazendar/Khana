import { Page } from '@playwright/test';
import { mockAuthRoutes, seedSessionTokens } from '../fixtures/auth.fixtures';
import { mockBookingsRoutes } from '../utils/navigation.utils';

/**
 * Seeds an authenticated session and sets up all required API mocks
 * for dashboard pages. Must be called BEFORE navigating to a dashboard route.
 */
export async function setupAuthenticatedDashboard(page: Page): Promise<void> {
  await seedSessionTokens(page);
  await mockAuthRoutes(page);
  await mockBookingsRoutes(page);
}
