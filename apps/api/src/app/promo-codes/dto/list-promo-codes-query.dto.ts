import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class ListPromoCodesQueryDto {
  @ApiPropertyOptional({
    description: 'Optional facility filter for promo code listing.',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  facilityId?: string;

  @ApiPropertyOptional({
    description: 'Filter promo codes by active state.',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'boolean'
      ? value
      : typeof value === 'string'
      ? value.toLowerCase() === 'true'
      : value
  )
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Include promo codes that are already expired.',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'boolean'
      ? value
      : typeof value === 'string'
      ? value.toLowerCase() === 'true'
      : value
  )
  @IsBoolean()
  includeExpired?: boolean;

  @ApiPropertyOptional({
    description: 'Page number for the paginated promo code list.',
    minimum: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Page size for the paginated promo code list.',
    minimum: 1,
    maximum: 100,
    example: 25,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(1)
  @Max(100)
  pageSize?: number;
}
