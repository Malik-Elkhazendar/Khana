export const mockTenant = {
  id: 'tenant-123',
  subdomain: 'test-tenant',
  name: 'Test Tenant',
};

export const mockUser = {
  id: 'user-123',
  tenantId: 'tenant-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'OWNER',
  isActive: true,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

export const mockTokens = {
  accessToken: 'access-token-123',
  refreshToken: 'refresh-token-123',
  expiresIn: 900,
};

export const mockLoginResponse = {
  ...mockTokens,
  user: mockUser,
  tenant: mockTenant,
};

export const mockRefreshResponse = {
  accessToken: 'access-token-456',
  refreshToken: 'refresh-token-456',
  expiresIn: 900,
  user: mockUser,
  tenant: mockTenant,
};

export const mockFacilities = [
  {
    id: 'facility-1',
    name: 'Main Hall',
    openTime: '08:00',
    closeTime: '22:00',
    slotDurationMinutes: 60,
    basePrice: 100,
    currency: 'SAR',
  },
];

export const mockBookings = [];
