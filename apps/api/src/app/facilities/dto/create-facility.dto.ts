import { Type } from 'class-transformer';
import {
  IsNumber,
  IsObject,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

const HH_MM_24H_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateFacilityConfigDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  pricePerHour!: number;

  @IsString()
  @Matches(HH_MM_24H_REGEX)
  openTime!: string;

  @IsString()
  @Matches(HH_MM_24H_REGEX)
  closeTime!: string;
}

export class CreateFacilityDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(80)
  type!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => CreateFacilityConfigDto)
  config!: CreateFacilityConfigDto;
}
