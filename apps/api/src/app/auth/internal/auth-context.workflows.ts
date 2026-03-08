import { BadRequestException, NotFoundException } from '@nestjs/common';
import { isUUID } from 'class-validator';
import {
  DEFAULT_TENANT_TIMEZONE,
  normalizeIanaTimeZone,
  TenantResolveResponseDto,
} from '@khana/shared-dtos';
import { AuthDependencies, normalizeAuthTenantSlug } from './auth.internal';
import { LOG_EVENTS } from '../../logging';

export const getAuthTenantContext = async (
  deps: AuthDependencies,
  tenantId?: string
): Promise<{
  id: string;
  name: string;
  slug: string;
  timezone: string;
}> => {
  const normalizedTenantId = tenantId?.trim();

  if (normalizedTenantId) {
    if (!isUUID(normalizedTenantId)) {
      throw new BadRequestException('Invalid tenant ID');
    }

    const tenant = await deps.tenantRepository.findOne({
      where: { id: normalizedTenantId },
      select: ['id', 'name', 'slug', 'timezone'],
    });

    if (!tenant) {
      throw new BadRequestException('Invalid tenant ID');
    }

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      timezone: normalizeIanaTimeZone(tenant.timezone),
    };
  }

  const tenants = await deps.tenantRepository.find({
    select: ['id', 'name', 'slug', 'timezone', 'createdAt'],
    order: { createdAt: 'ASC' },
    take: 2,
  });

  if (tenants.length === 0) {
    throw new NotFoundException('No tenant is configured');
  }

  if (tenants.length > 1) {
    throw new BadRequestException('Tenant ID is required');
  }

  const [tenant] = tenants;

  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    timezone: normalizeIanaTimeZone(tenant.timezone),
  };
};

export const resolveAuthTenantBySlug = async (
  deps: AuthDependencies,
  slug: string,
  ipAddress?: string,
  userAgent?: string
): Promise<TenantResolveResponseDto> => {
  let normalizedSlug: string;
  try {
    normalizedSlug = normalizeAuthTenantSlug(slug);
  } catch (error) {
    deps.appLogger.warn(
      LOG_EVENTS.AUTH_TENANT_RESOLVE_FAILED,
      'Workspace slug resolution rejected',
      {
        slug,
        reason: 'invalid_format',
        ipAddress,
        userAgent,
      }
    );
    throw error;
  }

  const tenant = await deps.tenantRepository.findOne({
    where: { slug: normalizedSlug },
    select: ['id', 'name', 'slug', 'timezone'],
  });

  if (!tenant) {
    deps.appLogger.warn(
      LOG_EVENTS.AUTH_TENANT_RESOLVE_FAILED,
      'Workspace slug resolution failed',
      {
        slug: normalizedSlug,
        reason: 'not_found',
        ipAddress,
        userAgent,
      }
    );
    throw new NotFoundException('Workspace not found');
  }

  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    timezone: normalizeIanaTimeZone(tenant.timezone ?? DEFAULT_TENANT_TIMEZONE),
  };
};
