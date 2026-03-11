import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class DesiredTimeSlotDto {
  @ApiProperty({
    description: 'Desired waitlist slot start time in ISO-8601 format.',
    example: '2026-03-15T18:00:00.000Z',
  })
  @IsDateString()
  @IsNotEmpty()
  startTime!: string;

  @ApiProperty({
    description: 'Desired waitlist slot end time in ISO-8601 format.',
    example: '2026-03-15T19:00:00.000Z',
  })
  @IsDateString()
  @IsNotEmpty()
  endTime!: string;
}

export class JoinWaitlistDto {
  @ApiProperty({
    description: 'Facility identifier for the waitlist request.',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  facilityId!: string;

  @ApiProperty({
    description: 'Desired time slot for the waitlist entry.',
    type: () => DesiredTimeSlotDto,
  })
  @ValidateNested()
  @Type(() => DesiredTimeSlotDto)
  desiredTimeSlot!: DesiredTimeSlotDto;
}
