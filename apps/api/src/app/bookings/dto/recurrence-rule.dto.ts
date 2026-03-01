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
  @IsEnum(RecurrenceFrequency)
  frequency!: RecurrenceFrequency;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2)
  intervalWeeks!: number;

  @IsOptional()
  @IsDateString()
  endsAtDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(104)
  occurrences?: number;
}
