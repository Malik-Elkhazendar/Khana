import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuditAction, User } from '@khana/data-access';
import { PromoCodeItemDto } from '@khana/shared-dtos';
import { LOG_EVENTS } from '../../logging';
import { CreatePromoCodeDto, UpdatePromoCodeDto } from '../dto';
import {
  ACCESS_DENIED_MESSAGE,
  canManagePromoCodes,
  ensurePromoCodeDoesNotExist,
  findPromoCodeForActor,
  INVALID_PROMO_CODE_MESSAGE,
  logPromoAudit,
  MAX_USES_BELOW_CURRENT_USES_MESSAGE,
  normalizeCode,
  parseOptionalDate,
  PromoCodeDependencies,
  PROMO_CODE_REGEX,
  requirePromoActorRole,
  requireTenantId,
  requireUserId,
  resolveScopedFacilityId,
  toPromoCodeItemDto,
  validateDiscountValue,
  validateMaxUses,
} from './promo-codes.internal';

export const createPromoCodeWorkflow = async (
  deps: PromoCodeDependencies,
  dto: CreatePromoCodeDto,
  tenantId: string,
  actor: User,
): Promise<PromoCodeItemDto> => {
  const resolvedTenantId = requireTenantId(tenantId);
  const actorRole = requirePromoActorRole(actor?.role);
  const actorUserId = requireUserId(actor?.id);

  if (!canManagePromoCodes(actorRole)) {
    throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
  }

  const normalizedCode = normalizeCode(dto.code);
  if (!PROMO_CODE_REGEX.test(normalizedCode)) {
    throw new BadRequestException(INVALID_PROMO_CODE_MESSAGE);
  }

  validateDiscountValue(dto.discountType, dto.discountValue);
  validateMaxUses(dto.maxUses ?? null);

  const scope = dto.facilityScope;
  const facilityId = await resolveScopedFacilityId(
    deps,
    scope,
    dto.facilityId ?? null,
    resolvedTenantId,
  );
  const expiresAt = parseOptionalDate(dto.expiresAt);

  await ensurePromoCodeDoesNotExist(deps, resolvedTenantId, normalizedCode);

  const entity = deps.promoCodeRepository.create({
    tenantId: resolvedTenantId,
    facilityScope: scope,
    facilityId,
    code: normalizedCode,
    discountType: dto.discountType,
    discountValue: dto.discountValue,
    maxUses: dto.maxUses ?? null,
    currentUses: 0,
    expiresAt,
    isActive: dto.isActive ?? true,
    createdByUserId: actorUserId,
    updatedByUserId: actorUserId,
  });

  const saved = await deps.promoCodeRepository.save(entity);

  await logPromoAudit(deps, {
    tenantId: resolvedTenantId,
    userId: actorUserId,
    action: AuditAction.CREATE,
    entityId: saved.id,
    description: `Promo code created: ${saved.code}`,
    changes: {
      after: {
        code: saved.code,
        facilityScope: saved.facilityScope,
        facilityId: saved.facilityId,
        discountType: saved.discountType,
        discountValue: Number(saved.discountValue),
        maxUses: saved.maxUses,
        expiresAt: saved.expiresAt?.toISOString() ?? null,
        isActive: saved.isActive,
      },
    },
  });

  deps.appLogger.info(
    LOG_EVENTS.PROMO_CODE_CREATE_SUCCESS,
    'Promo code created',
    {
      promoCodeId: saved.id,
      tenantId: resolvedTenantId,
      code: saved.code,
    },
  );

  return toPromoCodeItemDto(saved);
};

export const updatePromoCodeWorkflow = async (
  deps: PromoCodeDependencies,
  id: string,
  dto: UpdatePromoCodeDto,
  tenantId: string,
  actor: User,
): Promise<PromoCodeItemDto> => {
  const resolvedTenantId = requireTenantId(tenantId);
  const actorRole = requirePromoActorRole(actor?.role);
  const actorUserId = requireUserId(actor?.id);

  if (!canManagePromoCodes(actorRole)) {
    throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
  }

  const existing = await findPromoCodeForActor(deps, id, resolvedTenantId);
  const before = toPromoCodeItemDto(existing);

  if (typeof dto.code === 'string') {
    const normalizedCode = normalizeCode(dto.code);
    if (!PROMO_CODE_REGEX.test(normalizedCode)) {
      throw new BadRequestException(INVALID_PROMO_CODE_MESSAGE);
    }
    if (normalizedCode !== existing.code) {
      await ensurePromoCodeDoesNotExist(
        deps,
        resolvedTenantId,
        normalizedCode,
        existing.id,
      );
    }
    existing.code = normalizedCode;
  }

  const nextDiscountType = dto.discountType ?? existing.discountType;
  const nextDiscountValue = dto.discountValue ?? Number(existing.discountValue);
  validateDiscountValue(nextDiscountType, nextDiscountValue);
  existing.discountType = nextDiscountType;
  existing.discountValue = nextDiscountValue;

  if (Object.prototype.hasOwnProperty.call(dto, 'maxUses')) {
    validateMaxUses(dto.maxUses ?? null);
    const nextMaxUses = dto.maxUses ?? null;
    if (
      typeof nextMaxUses === 'number' &&
      nextMaxUses < Number(existing.currentUses)
    ) {
      throw new BadRequestException(MAX_USES_BELOW_CURRENT_USES_MESSAGE);
    }
    existing.maxUses = nextMaxUses;
  }

  if (Object.prototype.hasOwnProperty.call(dto, 'expiresAt')) {
    existing.expiresAt = parseOptionalDate(dto.expiresAt ?? null);
  }

  if (typeof dto.isActive === 'boolean') {
    existing.isActive = dto.isActive;
  }

  const nextScope = dto.facilityScope ?? existing.facilityScope;
  const providedFacilityId = Object.prototype.hasOwnProperty.call(
    dto,
    'facilityId',
  )
    ? (dto.facilityId ?? null)
    : existing.facilityId;

  existing.facilityScope = nextScope;
  existing.facilityId = await resolveScopedFacilityId(
    deps,
    nextScope,
    providedFacilityId,
    resolvedTenantId,
  );

  existing.updatedByUserId = actorUserId;
  const saved = await deps.promoCodeRepository.save(existing);
  const after = toPromoCodeItemDto(saved);

  await logPromoAudit(deps, {
    tenantId: resolvedTenantId,
    userId: actorUserId,
    action: AuditAction.UPDATE,
    entityId: saved.id,
    description: `Promo code updated: ${saved.code}`,
    changes: { before, after },
  });

  deps.appLogger.info(
    LOG_EVENTS.PROMO_CODE_UPDATE_SUCCESS,
    'Promo code updated',
    {
      promoCodeId: saved.id,
      tenantId: resolvedTenantId,
    },
  );

  return after;
};
