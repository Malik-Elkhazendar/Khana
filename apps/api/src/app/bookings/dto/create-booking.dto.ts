import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  IsUUID,
} from 'class-validator';
import { BookingStatus } from '@khana/shared-dtos';

const PROMO_CODE_REGEX = /^[A-Za-z0-9][A-Za-z0-9_-]{2,39}$/;

export class CreateBookingDto {
  @IsUUID()
  @IsNotEmpty()
  facilityId!: string;

  @IsDateString()
  @IsNotEmpty()
  startTime!: string;

  @IsDateString()
  @IsNotEmpty()
  endTime!: string;

  @IsString()
  @IsNotEmpty()
  customerName!: string;

  @IsString()
  @IsNotEmpty()
  customerPhone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(PROMO_CODE_REGEX)
  promoCode?: string;

  @IsIn([BookingStatus.PENDING])
  @IsOptional()
  status?: BookingStatus;
}
