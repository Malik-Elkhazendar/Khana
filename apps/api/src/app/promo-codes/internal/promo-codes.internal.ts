import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  AuditLog,
  Facility,
  PromoCode,
  User,
} from '@khana/data-access';
import {
  PromoCodeItemDto,
  PromoDiscountType,
  PromoFacilityScope,
  UserRole,
} from '@khana/shared-dtos';
import { Repository } from 'typeorm';
import { AppLoggerService } from '../../logging';

export const ACCESS_DENIED_MESSAGE =
  'Access denied: You do not have permission to access this resource.';
export const RESOURCE_NOT_FOUND_MESSAGE = 'Resource not found';
export const PROMO_CODE_EXISTS_MESSAGE =
  'Promo code already exists for this tenant.';
export const INVALID_PROMO_CODE_MESSAGE =
  'Promo code format is invalid. Use 3-40 chars: A-Z, 0-9, dash, underscore.';
export const INVALID_DISCOUNT_VALUE_MESSAGE =
  'Discount value is invalid for the selected discount type.';
export const INVALID_MAX_USES_MESSAGE = 'maxUses must be greater than zero.';
export const MAX_USES_BELOW_CURRENT_USES_MESSAGE =
  'maxUses cannot be lower than current uses.';
export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
export const PROMO_CODE_REGEX = /^[A-Z0-9][A-Z0-9_-]{2,39}$/;

export type PromoCodeDependencies = {
  promoCodeRepository: Repository<PromoCode>;
  facilityRepository: Repository<Facility>;
  auditLogRepository: Repository<AuditLog>;
  appLogger: AppLoggerService;
};

export const requireTenantId = (tenantId?: string): string => {
  if (!tenantId?.trim()) {
    throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
  }
  return tenantId;
};

export const requireUserId = (userId?: string): string => {
  if (!userId?.trim()) {
    throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
  }
  return userId;
};

export const requirePromoActorRole = (role?: string): UserRole => {
  if (
    role === UserRole.OWNER ||
    role === UserRole.MANAGER ||
    role === UserRole.STAFF ||
    role === UserRole.VIEWER
  ) {
    return role;
  }

  throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
};

export const canManagePromoCodes = (role: UserRole): boolean => {
  return role === UserRole.OWNER || role === UserRole.MANAGER;
};

export const normalizeCode = (code: string): string => {
  return code.trim().toUpperCase();
};

export const validateDiscountValue = (
  discountType: PromoDiscountType,
  discountValue: number
): void => {
  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    throw new BadRequestException(INVALID_DISCOUNT_VALUE_MESSAGE);
  }

  if (discountType === PromoDiscountType.PERCENTAGE && discountValue > 100) {
    throw new BadRequestException(INVALID_DISCOUNT_VALUE_MESSAGE);
  }
};

export const validateMaxUses = (maxUses: number | null): void => {
  if (maxUses === null) return;
  if (!Number.isInteger(maxUses) || maxUses <= 0) {
    throw new BadRequestException(INVALID_MAX_USES_MESSAGE);
  }
};

export const parseOptionalDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException('expiresAt must be a valid ISO date-time.');
  }
  return parsed;
};

export const validateFacilityOwnership = async (
  deps: PromoCodeDependencies,
  facilityId: string,
  tenantId: string
): Promise<Facility> => {
  const facility = await deps.facilityRepository.findOne({
    where: { id: facilityId },
    relations: { tenant: true },
  });

  if (!facility) {
    throw new NotFoundException(RESOURCE_NOT_FOUND_MESSAGE);
  }

  if (facility.tenant.id !== tenantId) {
    throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
  }

  return facility;
};

export const resolveScopedFacilityId = async (
  deps: PromoCodeDependencies,
  scope: PromoFacilityScope,
  requestedFacilityId: string | null,
  tenantId: string
): Promise<string | null> => {
  if (scope === PromoFacilityScope.ALL_FACILITIES) {
    return null;
  }

  if (!requestedFacilityId?.trim()) {
    throw new BadRequestException(
      'facilityId is required when facilityScope is SINGLE_FACILITY.'
    );
  }

  const facility = await validateFacilityOwnership(
    deps,
    requestedFacilityId,
    tenantId
  );
  return facility.id;
};

export const findPromoCodeForActor = async (
  deps: PromoCodeDependencies,
  id: string,
  tenantId: string
): Promise<PromoCode> => {
  const promo = await deps.promoCodeRepository.findOne({
    where: { id },
  });

  if (!promo) {
    throw new NotFoundException(RESOURCE_NOT_FOUND_MESSAGE);
  }

  if (promo.tenantId !== tenantId) {
    throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
  }

  return promo;
};

export const toPromoCodeItemDto = (
  promoCode: PromoCode,
  referenceDate: Date = new Date()
): PromoCodeItemDto => {
  const maxUses = promoCode.maxUses;
  const currentUses = Number(promoCode.currentUses ?? 0);
  const remainingUses =
    typeof maxUses === 'number' ? Math.max(maxUses - currentUses, 0) : null;
  const isExpired = Boolean(
    promoCode.expiresAt && promoCode.expiresAt < referenceDate
  );
  const isExhausted =
    typeof maxUses === 'number' ? currentUses >= maxUses : false;

  return {
    id: promoCode.id,
    tenantId: promoCode.tenantId,
    code: promoCode.code,
    discountType: promoCode.discountType,
    discountValue: Number(promoCode.discountValue),
    maxUses: maxUses ?? null,
    currentUses,
    remainingUses,
    isExhausted,
    expiresAt: promoCode.expiresAt?.toISOString() ?? null,
    isExpired,
    facilityScope: promoCode.facilityScope,
    facilityId: promoCode.facilityId ?? null,
    isActive: promoCode.isActive,
    createdAt: promoCode.createdAt.toISOString(),
    updatedAt: promoCode.updatedAt.toISOString(),
  };
};

export const ensurePromoCodeDoesNotExist = async (
  deps: PromoCodeDependencies,
  tenantId: string,
  code: string,
  existingId?: string
): Promise<void> => {
  const existing = await deps.promoCodeRepository.findOne({
    where: { tenantId, code },
    select: ['id'],
  });
  if (existing && existing.id !== existingId) {
    throw new ConflictException(PROMO_CODE_EXISTS_MESSAGE);
  }
};

export const logPromoAudit = async (
  deps: PromoCodeDependencies,
  params: {
    tenantId: string;
    userId?: string;
    action: AuditAction;
    entityId: string;
    description?: string;
    changes?: Record<string, unknown>;
  }
): Promise<void> => {
  const audit = deps.auditLogRepository.create({
    tenantId: params.tenantId,
    userId: params.userId,
    action: params.action,
    entityType: 'PromoCode',
    entityId: params.entityId,
    description: params.description,
    changes: params.changes,
  });
  await deps.auditLogRepository.save(audit);
};
