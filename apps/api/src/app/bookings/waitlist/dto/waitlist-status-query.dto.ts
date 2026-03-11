import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsUUID } from 'class-validator';

export class WaitlistStatusQueryDto {
  @ApiProperty({
    description: 'Facility identifier for the slot being checked.',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  facilityId!: string;

  @ApiProperty({
    description: 'Requested slot start time in ISO-8601 format.',
    example: '2026-03-15T18:00:00.000Z',
  })
  @IsDateString()
  @IsNotEmpty()
  startTime!: string;

  @ApiProperty({
    description: 'Requested slot end time in ISO-8601 format.',
    example: '2026-03-15T19:00:00.000Z',
  })
  @IsDateString()
  @IsNotEmpty()
  endTime!: string;
}
