import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PromoDiscountType,
  PromoFacilityScope,
  PromoValidationReason,
} from '@khana/shared-dtos';

export class PromoCodeItemDoc {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  tenantId!: string;

  @ApiProperty({ example: 'SAVE10' })
  code!: string;

  @ApiProperty({
    enum: PromoDiscountType,
    example: PromoDiscountType.PERCENTAGE,
  })
  discountType!: PromoDiscountType;

  @ApiProperty({ example: 10 })
  discountValue!: number;

  @ApiPropertyOptional({ nullable: true, example: 100 })
  maxUses!: number | null;

  @ApiProperty({ example: 12 })
  currentUses!: number;

  @ApiPropertyOptional({ nullable: true, example: 88 })
  remainingUses!: number | null;

  @ApiProperty({ example: false })
  isExhausted!: boolean;

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    format: 'date-time',
    example: '2026-12-31T23:59:59.999Z',
  })
  expiresAt!: string | null;

  @ApiProperty({ example: false })
  isExpired!: boolean;

  @ApiProperty({
    enum: PromoFacilityScope,
    example: PromoFacilityScope.ALL_FACILITIES,
  })
  facilityScope!: PromoFacilityScope;

  @ApiPropertyOptional({ nullable: true, format: 'uuid' })
  facilityId!: string | null;

  @ApiProperty({ example: true })
  isActive!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export class PromoCodeListResponseDoc {
  @ApiProperty({ type: () => PromoCodeItemDoc, isArray: true })
  items!: PromoCodeItemDoc[];

  @ApiProperty({ example: 12 })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 25 })
  pageSize!: number;
}

export class PromoValidationDoc {
  @ApiProperty({ example: 'SAVE10' })
  code!: string;

  @ApiProperty({ example: true })
  isValid!: boolean;

  @ApiPropertyOptional({ enum: PromoValidationReason })
  reason?: PromoValidationReason;

  @ApiPropertyOptional({ format: 'uuid' })
  promoCodeId?: string;

  @ApiPropertyOptional({ enum: PromoDiscountType })
  discountType?: PromoDiscountType;

  @ApiPropertyOptional({ example: 10 })
  discountValue?: number;

  @ApiPropertyOptional({ example: 18 })
  discountAmount?: number;
}
