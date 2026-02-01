/**
 * Token Test Fixtures
 *
 * Provides consistent test data for JWT tokens.
 */

/**
 * Mock JWT access token (valid for 15 minutes)
 */
export const createMockAccessToken = (): string =>
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsImlhdCI6MTcwNjE4NDAwMCwiZXhwIjoxNzA2MTg0OTAwfQ.test-access-token';

/**
 * Mock JWT refresh token (valid for 7 days)
 */
export const createMockRefreshToken = (): string =>
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsInR5cGUiOiJyZWZyZXNoIiwiaWF0IjoxNzA2MTg0MDAwLCJleHAiOjE3MDY3ODg4MDB9.test-refresh-token';

/**
 * Mock expired access token
 */
export const createExpiredAccessToken = (): string =>
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImVtYWlsIjoidGVzdEBleGFtcGxlLmNvbSIsImlhdCI6MTcwNjE4NDAwMCwiZXhwIjoxNzA2MTg0MDAxfQ.expired-token';

/**
 * Mock token expiry time (in seconds)
 */
export const MOCK_TOKEN_EXPIRY = 900; // 15 minutes
