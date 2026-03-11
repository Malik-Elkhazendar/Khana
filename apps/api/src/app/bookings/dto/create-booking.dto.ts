import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiProperty({
    description: 'Facility identifier for the booking.',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  facilityId!: string;

  @ApiProperty({
    description: 'Requested booking start time in ISO-8601 format.',
    example: '2026-03-15T18:00:00.000Z',
  })
  @IsDateString()
  @IsNotEmpty()
  startTime!: string;

  @ApiProperty({
    description: 'Requested booking end time in ISO-8601 format.',
    example: '2026-03-15T19:00:00.000Z',
  })
  @IsDateString()
  @IsNotEmpty()
  endTime!: string;

  @ApiProperty({
    description: 'Customer display name recorded on the booking.',
    example: 'Fahad Alharbi',
  })
  @IsString()
  @IsNotEmpty()
  customerName!: string;

  @ApiProperty({
    description: 'Customer phone number used for lookup and notifications.',
    example: '+966500000000',
  })
  @IsString()
  @IsNotEmpty()
  customerPhone!: string;

  @ApiPropertyOptional({
    description: 'Optional promo code to validate and apply during booking.',
    maxLength: 40,
    example: 'SAVE10',
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(PROMO_CODE_REGEX)
  promoCode?: string;

  @ApiPropertyOptional({
    description:
      'Optional booking status override. Only pending holds are accepted from the API.',
    enum: [BookingStatus.PENDING],
    example: BookingStatus.PENDING,
  })
  @IsIn([BookingStatus.PENDING])
  @IsOptional()
  status?: BookingStatus;
}
