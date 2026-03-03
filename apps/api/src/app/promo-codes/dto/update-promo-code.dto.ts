import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { PromoDiscountType, PromoFacilityScope } from '@khana/shared-dtos';

const PROMO_CODE_REGEX = /^[A-Za-z0-9][A-Za-z0-9_-]{2,39}$/;

export class UpdatePromoCodeDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(PROMO_CODE_REGEX)
  code?: string;

  @IsOptional()
  @IsEnum(PromoDiscountType)
  discountType?: PromoDiscountType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  discountValue?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(1)
  maxUses?: number | null;

  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @IsOptional()
  @IsEnum(PromoFacilityScope)
  facilityScope?: PromoFacilityScope;

  @IsOptional()
  @IsUUID()
  facilityId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
