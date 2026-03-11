import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({
    description: 'Facility identifier for the preview request.',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  facilityId: string;

  @ApiProperty({
    description: 'Requested booking start time in ISO-8601 format.',
    example: '2026-03-15T18:00:00.000Z',
  })
  @IsDateString()
  @IsNotEmpty()
  startTime: string;

  @ApiProperty({
    description: 'Requested booking end time in ISO-8601 format.',
    example: '2026-03-15T19:00:00.000Z',
  })
  @IsDateString()
  @IsNotEmpty()
  endTime: string;

  @ApiPropertyOptional({
    description: 'Optional promo code to validate during preview.',
    example: 'SAVE10',
  })
  @IsString()
  @IsOptional()
  promoCode?: string;
}
