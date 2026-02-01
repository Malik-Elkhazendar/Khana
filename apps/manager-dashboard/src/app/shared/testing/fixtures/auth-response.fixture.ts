import { LoginResponseDto } from '@khana/shared-dtos';
import { createMockUser } from './user.fixture';
import {
  createMockAccessToken,
  createMockRefreshToken,
  MOCK_TOKEN_EXPIRY,
} from './token.fixture';

/**
 * Auth Response Test Fixtures
 *
 * Provides consistent test data for authentication responses.
 */

export const createMockLoginResponse = (
  overrides?: Partial<LoginResponseDto>
): LoginResponseDto => ({
  accessToken: createMockAccessToken(),
  refreshToken: createMockRefreshToken(),
  expiresIn: MOCK_TOKEN_EXPIRY,
  user: createMockUser(),
  tenant: {
    id: 'tenant-456',
    subdomain: 'test-tenant',
    name: 'Test Tenant',
  },
  ...overrides,
});

export const createMockRefreshResponse = (): LoginResponseDto =>
  createMockLoginResponse({
    accessToken: 'new-' + createMockAccessToken(),
    refreshToken: 'new-' + createMockRefreshToken(),
  });
