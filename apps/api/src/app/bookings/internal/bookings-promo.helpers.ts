import { ConflictException } from '@nestjs/common';
import { PromoCode } from '@khana/data-access';
import {
  PriceBreakdown,
  PromoDiscountType,
  PromoFacilityScope,
  PromoValidationDto,
  PromoValidationReason,
} from '@khana/shared-dtos';
import { isValidSaudiPhone, normalizeSaudiPhone } from '@khana/shared-utils';
import { Repository } from 'typeorm';

const PROMO_CODE_FORMAT_REGEX = /^[A-Z0-9][A-Z0-9_-]{2,39}$/;

export type PromoValidationResult = {
  validation: PromoValidationDto;
  promoCode?: PromoCode;
};

export function normalizePromoCode(
  promoCode?: string | null
): string | undefined {
  const normalized = (promoCode ?? '').trim().toUpperCase();
  return normalized.length > 0 ? normalized : undefined;
}

export function normalizeCustomerPhone(phone?: string | null): string | null {
  const compact = phone?.replace(/\s+/g, '').trim() ?? '';
  if (!compact) {
    return null;
  }

  if (!isValidSaudiPhone(compact)) {
    return null;
  }

  return normalizeSaudiPhone(compact);
}

export async function resolvePromoForPreview(params: {
  promoCodeRepository: Repository<PromoCode>;
  tenantId: string;
  facilityId: string;
  promoCode?: string;
  now: Date;
}): Promise<PromoValidationResult | undefined> {
  if (!params.promoCode) {
    return undefined;
  }

  if (!PROMO_CODE_FORMAT_REGEX.test(params.promoCode)) {
    return {
      validation: {
        code: params.promoCode,
        isValid: false,
        reason: PromoValidationReason.INVALID_FORMAT,
      },
    };
  }

  const promoCode = await params.promoCodeRepository.findOne({
    where: {
      tenantId: params.tenantId,
      code: params.promoCode,
    },
  });

  const validation = validatePromoAvailability({
    code: params.promoCode,
    promoCode,
    facilityId: params.facilityId,
    now: params.now,
  });

  return {
    validation,
    promoCode: validation.isValid ? promoCode ?? undefined : undefined,
  };
}

export async function resolvePromoForCreate(params: {
  promoCodeRepository: Repository<PromoCode>;
  tenantId: string;
  facilityId: string;
  promoCode?: string;
  now: Date;
}): Promise<PromoValidationResult | undefined> {
  if (!params.promoCode) {
    return undefined;
  }

  if (!PROMO_CODE_FORMAT_REGEX.test(params.promoCode)) {
    throw new ConflictException(
      promoCreateConflictMessage(PromoValidationReason.INVALID_FORMAT)
    );
  }

  const promoCode = await params.promoCodeRepository
    .createQueryBuilder('promo')
    .where('promo.tenantId = :tenantId', { tenantId: params.tenantId })
    .andWhere('promo.code = :code', { code: params.promoCode })
    .setLock('pessimistic_write')
    .getOne();

  const validation = validatePromoAvailability({
    code: params.promoCode,
    promoCode,
    facilityId: params.facilityId,
    now: params.now,
  });

  if (!validation.isValid || !promoCode) {
    throw new ConflictException(promoCreateConflictMessage(validation.reason));
  }

  return { validation, promoCode };
}

export function applyPromoToPriceBreakdown(
  baseBreakdown: PriceBreakdown,
  promoCode: string,
  discountType: PromoDiscountType,
  discountValue: number
): PriceBreakdown {
  const subtotal = Number(baseBreakdown.subtotal);
  const existingDiscount = Number(baseBreakdown.discountAmount);
  const rawPromoDiscount =
    discountType === PromoDiscountType.PERCENTAGE
      ? (subtotal * discountValue) / 100
      : discountValue;
  const maxApplicableDiscount = Math.max(subtotal - existingDiscount, 0);
  const promoDiscount = roundMoney(
    Math.min(Math.max(rawPromoDiscount, 0), maxApplicableDiscount)
  );
  const discountAmount = roundMoney(existingDiscount + promoDiscount);
  const total = roundMoney(Math.max(subtotal - discountAmount, 0));

  return {
    ...baseBreakdown,
    discountAmount,
    promoDiscount,
    promoCode,
    total,
  };
}

function validatePromoAvailability(params: {
  code: string;
  promoCode: PromoCode | null;
  facilityId: string;
  now: Date;
}): PromoValidationDto {
  const invalid = (reason: PromoValidationReason): PromoValidationDto => ({
    code: params.code,
    isValid: false,
    reason,
  });

  const promoCode = params.promoCode;
  if (!promoCode) {
    return invalid(PromoValidationReason.NOT_FOUND);
  }

  if (!promoCode.isActive) {
    return invalid(PromoValidationReason.INACTIVE);
  }

  if (promoCode.expiresAt && promoCode.expiresAt < params.now) {
    return invalid(PromoValidationReason.EXPIRED);
  }

  if (
    promoCode.facilityScope === PromoFacilityScope.SINGLE_FACILITY &&
    promoCode.facilityId !== params.facilityId
  ) {
    return invalid(PromoValidationReason.FACILITY_MISMATCH);
  }

  if (
    typeof promoCode.maxUses === 'number' &&
    Number(promoCode.currentUses) >= promoCode.maxUses
  ) {
    return invalid(PromoValidationReason.USAGE_EXCEEDED);
  }

  return {
    code: promoCode.code,
    isValid: true,
    promoCodeId: promoCode.id,
    discountType: promoCode.discountType,
    discountValue: Number(promoCode.discountValue),
  };
}

function promoCreateConflictMessage(reason?: PromoValidationReason): string {
  switch (reason) {
    case PromoValidationReason.INVALID_FORMAT:
    case PromoValidationReason.NOT_FOUND:
    case PromoValidationReason.EMPTY_CODE:
      return 'Promo code is invalid.';
    case PromoValidationReason.INACTIVE:
      return 'Promo code is inactive.';
    case PromoValidationReason.EXPIRED:
      return 'Promo code has expired.';
    case PromoValidationReason.FACILITY_MISMATCH:
      return 'Promo code is not valid for this facility.';
    case PromoValidationReason.USAGE_EXCEEDED:
      return 'Promo code usage limit has been reached.';
    default:
      return 'Promo code cannot be applied.';
  }
}

function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}
