import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, Max, Min, ValidateIf } from 'class-validator';
import { UpdateGoalsRequestDto } from '@khana/shared-dtos';

export class UpdateGoalsDto implements UpdateGoalsRequestDto {
  @ApiPropertyOptional({
    description: 'Monthly revenue target for the tenant.',
    nullable: true,
    example: 25000,
  })
  @ValidateIf((_obj, value) => value !== undefined && value !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monthlyRevenueTarget?: number | null;

  @ApiPropertyOptional({
    description: 'Monthly occupancy target percentage.',
    nullable: true,
    example: 72.5,
    maximum: 100,
  })
  @ValidateIf((_obj, value) => value !== undefined && value !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  monthlyOccupancyTarget?: number | null;

  @ApiPropertyOptional({
    description: 'Mark the goals nudge as shown to the user.',
    example: true,
  })
  @ValidateIf((_obj, value) => value !== undefined)
  @IsBoolean()
  markNudgeShown?: boolean;

  @ApiPropertyOptional({
    description: 'Dismiss the goals nudge for the current tenant.',
    example: true,
  })
  @ValidateIf((_obj, value) => value !== undefined)
  @IsBoolean()
  dismissNudge?: boolean;
}
