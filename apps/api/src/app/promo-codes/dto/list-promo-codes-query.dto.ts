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
  @IsOptional()
  @IsUUID()
  facilityId?: string;

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

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 0 })
  @Min(1)
  @Max(100)
  pageSize?: number;
}
