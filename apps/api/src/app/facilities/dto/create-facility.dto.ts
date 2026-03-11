import { ApiProperty } from '@nestjs/swagger';
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
  @ApiProperty({
    description: 'Hourly price configured for the facility.',
    example: 180,
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  pricePerHour!: number;

  @ApiProperty({
    description: 'Opening time in 24-hour HH:mm format.',
    example: '08:00',
  })
  @IsString()
  @Matches(HH_MM_24H_REGEX)
  openTime!: string;

  @ApiProperty({
    description: 'Closing time in 24-hour HH:mm format.',
    example: '23:00',
  })
  @IsString()
  @Matches(HH_MM_24H_REGEX)
  closeTime!: string;
}

export class CreateFacilityDto {
  @ApiProperty({
    description: 'Display name for the facility.',
    maxLength: 120,
    example: 'Court 1',
  })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    description: 'Facility type label used by the tenant.',
    maxLength: 80,
    example: 'PADEL',
  })
  @IsString()
  @MaxLength(80)
  type!: string;

  @ApiProperty({
    description: 'Pricing and operating-hours configuration for the facility.',
    type: () => CreateFacilityConfigDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => CreateFacilityConfigDto)
  config!: CreateFacilityConfigDto;
}
