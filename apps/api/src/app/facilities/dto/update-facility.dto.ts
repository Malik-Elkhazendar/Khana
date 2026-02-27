import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const HH_MM_24H_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class UpdateFacilityConfigDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  pricePerHour?: number;

  @IsOptional()
  @IsString()
  @Matches(HH_MM_24H_REGEX)
  openTime?: string;

  @IsOptional()
  @IsString()
  @Matches(HH_MM_24H_REGEX)
  closeTime?: string;
}

export class UpdateFacilityDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  type?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateFacilityConfigDto)
  config?: UpdateFacilityConfigDto;
}
