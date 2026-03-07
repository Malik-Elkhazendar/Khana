import { Tenant, User } from '@khana/data-access';
import {
  DEFAULT_TENANT_TIMEZONE,
  normalizeIanaTimeZone,
  UserDto,
  UserRole,
} from '@khana/shared-dtos';

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role as UserRole,
    isActive: user.isActive,
    onboardingCompleted: user.tenant?.onboardingCompleted ?? false,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    tenantId: user.tenantId || user.tenant?.id || 'unknown',
  };
}

export function toTenantDto(
  tenant?: Pick<Tenant, 'id' | 'name' | 'slug' | 'timezone'> | null
): { id: string; name: string; slug?: string; timezone?: string } | undefined {
  if (!tenant?.id) {
    return undefined;
  }

  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    timezone: normalizeIanaTimeZone(tenant.timezone ?? DEFAULT_TENANT_TIMEZONE),
  };
}
