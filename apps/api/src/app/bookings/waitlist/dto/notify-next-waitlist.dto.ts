import { IsDateString, IsNotEmpty, IsUUID } from 'class-validator';

export class NotifyNextWaitlistDto {
  @IsUUID()
  @IsNotEmpty()
  facilityId!: string;

  @IsDateString()
  @IsNotEmpty()
  desiredStartTime!: string;

  @IsDateString()
  @IsNotEmpty()
  desiredEndTime!: string;
}
