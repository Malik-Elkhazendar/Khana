import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const HH_MM_24H_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export enum OnboardingBusinessTypeDto {
  SPORTS = 'SPORTS',
  RENTAL = 'RENTAL',
}

export class CompleteOnboardingFacilityDto {
  @ApiProperty({
    description:
      'Display name for the first facility created during onboarding.',
    example: 'Court 1',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    description: 'Facility type label created during onboarding.',
    example: 'PADEL',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  type!: string;

  @ApiProperty({
    description: 'Initial hourly price configured for the onboarding facility.',
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

export class CompleteOnboardingDto {
  @ApiProperty({
    description: 'Tenant-facing business name captured during onboarding.',
    example: 'Khana Padel Club',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  businessName!: string;

  @ApiProperty({
    description: 'Business archetype used to seed onboarding defaults.',
    enum: OnboardingBusinessTypeDto,
    example: OnboardingBusinessTypeDto.SPORTS,
  })
  @IsEnum(OnboardingBusinessTypeDto)
  businessType!: OnboardingBusinessTypeDto;

  @ApiPropertyOptional({
    description: 'Optional business contact email.',
    example: 'info@khana.sa',
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  contactEmail?: string;

  @ApiPropertyOptional({
    description: 'Optional business contact phone number.',
    example: '+966500000000',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  contactPhone?: string;

  @ApiProperty({
    description: 'Facility that will be created during onboarding completion.',
    type: () => CompleteOnboardingFacilityDto,
  })
  @ValidateNested()
  @Type(() => CompleteOnboardingFacilityDto)
  facility!: CompleteOnboardingFacilityDto;
}
