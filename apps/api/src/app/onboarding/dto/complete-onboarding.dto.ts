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
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  type!: string;

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

export class CompleteOnboardingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  businessName!: string;

  @IsEnum(OnboardingBusinessTypeDto)
  businessType!: OnboardingBusinessTypeDto;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  contactEmail?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  contactPhone?: string;

  @ValidateNested()
  @Type(() => CompleteOnboardingFacilityDto)
  facility!: CompleteOnboardingFacilityDto;
}
