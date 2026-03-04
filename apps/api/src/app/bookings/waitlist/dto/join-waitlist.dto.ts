import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class DesiredTimeSlotDto {
  @IsDateString()
  @IsNotEmpty()
  startTime!: string;

  @IsDateString()
  @IsNotEmpty()
  endTime!: string;
}

export class JoinWaitlistDto {
  @IsUUID()
  @IsNotEmpty()
  facilityId!: string;

  @ValidateNested()
  @Type(() => DesiredTimeSlotDto)
  desiredTimeSlot!: DesiredTimeSlotDto;
}
