import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuditAction, Facility, User } from '@khana/data-access';
import { FacilityManagementItemDto, UserRole } from '@khana/shared-dtos';

export const ACCESS_DENIED_MESSAGE =
  'Access denied: You do not have permission to access this resource.';
export const RESOURCE_NOT_FOUND_MESSAGE = 'Resource not found';
export const INVALID_CONFIG_MESSAGE =
  'Facility config is invalid. Provide a positive price and valid operating hours.';
const SUPPORTED_FACILITY_TYPES = new Set([
  'PADEL',
  'FOOTBALL',
  'CHALET',
  'RESORT',
  'CAMP',
  'PADEL_COURT',
  'FOOTBALL_FIELD',
  'BASKETBALL_COURT',
  'TENNIS_COURT',
  'RESORT_UNIT',
  'OTHER',
]);
const HH_MM_24H_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export type Actor = Pick<User, 'id' | 'role' | 'tenantId'>;

export type FacilityConfig = {
  pricePerHour: number;
  openTime: string;
  closeTime: string;
};

export type AuditLogParams = {
  tenantId: string;
  userId?: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  description?: string;
  changes?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
};

export function requireTenantId(tenantId?: string): string {
  const normalized = tenantId?.trim();
  if (!normalized) {
    throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
  }
  return normalized;
}

export function requireUserRole(role?: string): UserRole {
  if (
    role === UserRole.OWNER ||
    role === UserRole.MANAGER ||
    role === UserRole.STAFF ||
    role === UserRole.VIEWER
  ) {
    return role;
  }
  throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
}

export function canManageRole(role: UserRole): boolean {
  return role === UserRole.OWNER || role === UserRole.MANAGER;
}

export function assertManageRole(role: UserRole): void {
  if (!canManageRole(role)) {
    throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
  }
}

export function normalizeFacilityType(rawType: string): string {
  const type = rawType.trim().toUpperCase();
  if (!type || !SUPPORTED_FACILITY_TYPES.has(type)) {
    throw new BadRequestException('Facility type is invalid.');
  }
  return type;
}

export function normalizeConfig(
  rawConfig: Partial<FacilityConfig>
): FacilityConfig {
  const pricePerHour = Number(rawConfig.pricePerHour);
  const openTime = `${rawConfig.openTime ?? ''}`.trim();
  const closeTime = `${rawConfig.closeTime ?? ''}`.trim();

  if (!Number.isFinite(pricePerHour) || pricePerHour <= 0) {
    throw new BadRequestException(INVALID_CONFIG_MESSAGE);
  }

  if (!HH_MM_24H_REGEX.test(openTime) || !HH_MM_24H_REGEX.test(closeTime)) {
    throw new BadRequestException(INVALID_CONFIG_MESSAGE);
  }

  if (toMinutes(openTime) >= toMinutes(closeTime)) {
    throw new BadRequestException(
      'Facility operating hours are invalid. Open time must be before close time.'
    );
  }

  return {
    pricePerHour,
    openTime,
    closeTime,
  };
}

export function toDto(facility: Facility): FacilityManagementItemDto {
  const config = facility.config as FacilityConfig;

  return {
    id: facility.id,
    tenantId: facility.tenant?.id,
    name: facility.name,
    type: facility.type,
    isActive: facility.isActive,
    config: {
      pricePerHour: Number(config.pricePerHour),
      openTime: config.openTime,
      closeTime: config.closeTime,
    },
    createdAt: facility.createdAt.toISOString(),
    updatedAt: facility.updatedAt.toISOString(),
  };
}

export function auditSnapshot(facility: Facility): Record<string, unknown> {
  const config = facility.config as FacilityConfig;

  return {
    id: facility.id,
    name: facility.name,
    type: facility.type,
    isActive: facility.isActive,
    config: {
      pricePerHour: Number(config.pricePerHour),
      openTime: config.openTime,
      closeTime: config.closeTime,
    },
  };
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map((value) => Number(value));
  return hours * 60 + minutes;
}
