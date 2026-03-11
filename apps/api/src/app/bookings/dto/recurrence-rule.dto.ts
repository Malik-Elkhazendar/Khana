import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { RecurrenceFrequency } from '@khana/shared-dtos';

export class RecurrenceRuleDto {
  @ApiProperty({
    description: 'Recurrence frequency supported by the bookings workflow.',
    enum: RecurrenceFrequency,
    example: RecurrenceFrequency.WEEKLY,
  })
  @IsEnum(RecurrenceFrequency)
  frequency!: RecurrenceFrequency;

  @ApiProperty({
    description: 'Interval in weeks. Use 1 for weekly and 2 for biweekly.',
    minimum: 1,
    maximum: 2,
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2)
  intervalWeeks!: number;

  @ApiPropertyOptional({
    description: 'Inclusive end date for the recurrence window.',
    example: '2026-04-30',
  })
  @IsOptional()
  @IsDateString()
  endsAtDate?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of recurring instances to create.',
    minimum: 1,
    maximum: 104,
    example: 8,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(104)
  occurrences?: number;
}
