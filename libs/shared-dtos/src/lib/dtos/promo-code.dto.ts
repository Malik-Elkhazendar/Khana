import {
  PromoDiscountType,
  PromoFacilityScope,
  PromoValidationReason,
} from '../enums';

export interface CreatePromoCodeRequestDto {
  code: string;
  discountType: PromoDiscountType;
  discountValue: number;
  maxUses?: number | null;
  expiresAt?: string | null;
  facilityScope: PromoFacilityScope;
  facilityId?: string | null;
  isActive?: boolean;
}

export interface UpdatePromoCodeRequestDto {
  code?: string;
  discountType?: PromoDiscountType;
  discountValue?: number;
  maxUses?: number | null;
  expiresAt?: string | null;
  facilityScope?: PromoFacilityScope;
  facilityId?: string | null;
  isActive?: boolean;
}

export interface PromoCodeListQueryDto {
  facilityId?: string;
  isActive?: boolean;
  includeExpired?: boolean;
  page?: number;
  pageSize?: number;
}

export interface PromoCodeItemDto {
  id: string;
  tenantId: string;
  code: string;
  discountType: PromoDiscountType;
  discountValue: number;
  maxUses: number | null;
  currentUses: number;
  remainingUses: number | null;
  isExhausted: boolean;
  expiresAt: string | null;
  isExpired: boolean;
  facilityScope: PromoFacilityScope;
  facilityId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PromoCodeListResponseDto {
  items: PromoCodeItemDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PromoValidationDto {
  code: string;
  isValid: boolean;
  reason?: PromoValidationReason;
  promoCodeId?: string;
  discountType?: PromoDiscountType;
  discountValue?: number;
  discountAmount?: number;
}
