import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsUUID } from 'class-validator';

export class NotifyNextWaitlistDto {
  @ApiProperty({
    description: 'Facility identifier for the slot that became available.',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  facilityId!: string;

  @ApiProperty({
    description: 'Desired slot start time in ISO-8601 format.',
    example: '2026-03-15T18:00:00.000Z',
  })
  @IsDateString()
  @IsNotEmpty()
  desiredStartTime!: string;

  @ApiProperty({
    description: 'Desired slot end time in ISO-8601 format.',
    example: '2026-03-15T19:00:00.000Z',
  })
  @IsDateString()
  @IsNotEmpty()
  desiredEndTime!: string;
}
