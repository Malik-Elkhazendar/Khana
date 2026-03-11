import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { BookingStatus } from '@khana/shared-dtos';
import { RecurrenceRuleDto } from './recurrence-rule.dto';

export class CreateRecurringBookingDto {
  @ApiProperty({
    description: 'Facility identifier for the recurring booking series.',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  facilityId!: string;

  @ApiProperty({
    description: 'Start time for the first booking instance.',
    example: '2026-03-15T18:00:00.000Z',
  })
  @IsDateString()
  @IsNotEmpty()
  startTime!: string;

  @ApiProperty({
    description: 'End time for the first booking instance.',
    example: '2026-03-15T19:00:00.000Z',
  })
  @IsDateString()
  @IsNotEmpty()
  endTime!: string;

  @ApiProperty({
    description: 'Customer name stored on each created booking.',
    example: 'Fahad Alharbi',
  })
  @IsString()
  @IsNotEmpty()
  customerName!: string;

  @ApiProperty({
    description: 'Customer phone number used for dedupe and notifications.',
    example: '+966500000000',
  })
  @IsString()
  @IsNotEmpty()
  customerPhone!: string;

  @ApiPropertyOptional({
    description:
      'Optional booking status override. Only pending holds are accepted from the API.',
    enum: [BookingStatus.PENDING],
    example: BookingStatus.PENDING,
  })
  @IsIn([BookingStatus.PENDING])
  @IsOptional()
  status?: BookingStatus;

  @ApiProperty({
    description: 'Recurrence rule that expands the booking series.',
    type: () => RecurrenceRuleDto,
  })
  @IsObject()
  @ValidateNested()
  @Type(() => RecurrenceRuleDto)
  recurrenceRule!: RecurrenceRuleDto;
}
