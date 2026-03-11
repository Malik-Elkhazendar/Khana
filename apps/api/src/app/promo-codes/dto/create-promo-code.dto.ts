import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNotEmpty,
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

export class CreatePromoCodeDto {
  @ApiProperty({
    description: 'Unique promo code string entered by staff or customers.',
    maxLength: 40,
    example: 'SAVE10',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  @Matches(PROMO_CODE_REGEX)
  code!: string;

  @ApiProperty({
    description: 'Discount calculation mode used by the promo code.',
    enum: PromoDiscountType,
  })
  @IsEnum(PromoDiscountType)
  discountType!: PromoDiscountType;

  @ApiProperty({
    description: 'Discount value interpreted by the selected discount type.',
    example: 10,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  discountValue!: number;

  @ApiPropertyOptional({
    description: 'Optional maximum number of times the promo code can be used.',
    nullable: true,
    example: 100,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(1)
  maxUses?: number | null;

  @ApiPropertyOptional({
    description: 'Optional expiry timestamp for the promo code.',
    nullable: true,
    example: '2026-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @ApiProperty({
    description:
      'Whether the promo code applies to all facilities or one facility.',
    enum: PromoFacilityScope,
  })
  @IsEnum(PromoFacilityScope)
  facilityScope!: PromoFacilityScope;

  @ApiPropertyOptional({
    description:
      'Facility identifier when the promo code is scoped to a single facility.',
    nullable: true,
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  facilityId?: string | null;

  @ApiPropertyOptional({
    description: 'Initial activation flag for the promo code.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
