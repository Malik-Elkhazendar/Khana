import { UserDto } from '@khana/shared-dtos';
import { UserRole } from '@khana/shared-dtos';

/**
 * User Test Fixtures
 *
 * Provides consistent test data for user-related tests.
 */

export const createMockUser = (overrides?: Partial<UserDto>): UserDto => ({
  id: 'user-123',
  tenantId: 'tenant-456',
  email: 'test@example.com',
  name: 'Test User',
  phone: '+1234567890',
  role: UserRole.MANAGER,
  isActive: true,
  lastLoginAt: new Date('2024-01-15T10:30:00Z'),
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-15T10:30:00Z'),
  ...overrides,
});

export const createOwnerUser = (): UserDto =>
  createMockUser({
    id: 'owner-123',
    email: 'owner@example.com',
    name: 'Owner User',
    role: UserRole.OWNER,
  });

export const createManagerUser = (): UserDto =>
  createMockUser({
    id: 'manager-123',
    email: 'manager@example.com',
    name: 'Manager User',
    role: UserRole.MANAGER,
  });

export const createStaffUser = (): UserDto =>
  createMockUser({
    id: 'staff-123',
    email: 'staff@example.com',
    name: 'Staff User',
    role: UserRole.STAFF,
  });

export const createViewerUser = (): UserDto =>
  createMockUser({
    id: 'viewer-123',
    email: 'viewer@example.com',
    name: 'Viewer User',
    role: UserRole.VIEWER,
  });

export const createInactiveUser = (): UserDto =>
  createMockUser({
    id: 'inactive-123',
    email: 'inactive@example.com',
    name: 'Inactive User',
    isActive: false,
  });
