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
  @IsUUID()
  @IsNotEmpty()
  facilityId!: string;

  @IsDateString()
  @IsNotEmpty()
  startTime!: string;

  @IsDateString()
  @IsNotEmpty()
  endTime!: string;

  @IsString()
  @IsNotEmpty()
  customerName!: string;

  @IsString()
  @IsNotEmpty()
  customerPhone!: string;

  @IsIn([BookingStatus.PENDING])
  @IsOptional()
  status?: BookingStatus;

  @IsObject()
  @ValidateNested()
  @Type(() => RecurrenceRuleDto)
  recurrenceRule!: RecurrenceRuleDto;
}
