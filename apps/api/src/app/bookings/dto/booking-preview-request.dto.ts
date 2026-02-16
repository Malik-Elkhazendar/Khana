import {
  IsString,
  IsDateString,
  IsOptional,
  IsNotEmpty,
  IsUUID,
} from 'class-validator';

/**
 * Request DTO for booking preview
 * Validates incoming API requests
 */
export class BookingPreviewRequestDto {
  @IsUUID()
  @IsNotEmpty()
  facilityId: string;

  @IsDateString()
  @IsNotEmpty()
  startTime: string;

  @IsDateString()
  @IsNotEmpty()
  endTime: string;

  @IsString()
  @IsOptional()
  promoCode?: string;
}
