import { ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiPropertyOptional({
    description: 'Updated hourly price for the facility.',
    example: 200,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  pricePerHour?: number;

  @ApiPropertyOptional({
    description: 'Updated opening time in 24-hour HH:mm format.',
    example: '09:00',
  })
  @IsOptional()
  @IsString()
  @Matches(HH_MM_24H_REGEX)
  openTime?: string;

  @ApiPropertyOptional({
    description: 'Updated closing time in 24-hour HH:mm format.',
    example: '22:00',
  })
  @IsOptional()
  @IsString()
  @Matches(HH_MM_24H_REGEX)
  closeTime?: string;
}

export class UpdateFacilityDto {
  @ApiPropertyOptional({
    description: 'Updated display name for the facility.',
    maxLength: 120,
    example: 'Court 1 - VIP',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({
    description: 'Updated facility type label.',
    maxLength: 80,
    example: 'PADEL',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  type?: string;

  @ApiPropertyOptional({
    description: 'Activate or deactivate the facility.',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Updated pricing and operating-hours configuration.',
    type: () => UpdateFacilityConfigDto,
  })
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateFacilityConfigDto)
  config?: UpdateFacilityConfigDto;
}
