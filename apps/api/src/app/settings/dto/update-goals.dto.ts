import { Type } from 'class-transformer';
import { IsBoolean, IsNumber, Max, Min, ValidateIf } from 'class-validator';
import { UpdateGoalsRequestDto } from '@khana/shared-dtos';

export class UpdateGoalsDto implements UpdateGoalsRequestDto {
  @ValidateIf((_obj, value) => value !== undefined && value !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monthlyRevenueTarget?: number | null;

  @ValidateIf((_obj, value) => value !== undefined && value !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  monthlyOccupancyTarget?: number | null;

  @ValidateIf((_obj, value) => value !== undefined)
  @IsBoolean()
  markNudgeShown?: boolean;

  @ValidateIf((_obj, value) => value !== undefined)
  @IsBoolean()
  dismissNudge?: boolean;
}
