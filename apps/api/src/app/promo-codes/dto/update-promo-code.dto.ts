import { ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiPropertyOptional({
    description: 'Updated promo code string.',
    maxLength: 40,
    example: 'SAVE15',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(PROMO_CODE_REGEX)
  code?: string;

  @ApiPropertyOptional({
    description: 'Updated discount calculation mode.',
    enum: PromoDiscountType,
  })
  @IsOptional()
  @IsEnum(PromoDiscountType)
  discountType?: PromoDiscountType;

  @ApiPropertyOptional({
    description: 'Updated discount value interpreted by the selected type.',
    example: 15,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  discountValue?: number;

  @ApiPropertyOptional({
    description: 'Updated usage cap for the promo code.',
    nullable: true,
    example: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(1)
  maxUses?: number | null;

  @ApiPropertyOptional({
    description: 'Updated expiry timestamp for the promo code.',
    nullable: true,
    example: '2026-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @ApiPropertyOptional({
    description: 'Updated facility scope for the promo code.',
    enum: PromoFacilityScope,
  })
  @IsOptional()
  @IsEnum(PromoFacilityScope)
  facilityScope?: PromoFacilityScope;

  @ApiPropertyOptional({
    description:
      'Updated facility identifier when the code is facility-scoped.',
    nullable: true,
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  facilityId?: string | null;

  @ApiPropertyOptional({
    description: 'Updated active state for the promo code.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
