import { IsDateString, IsNotEmpty, IsUUID } from 'class-validator';

export class WaitlistStatusQueryDto {
  @IsUUID()
  @IsNotEmpty()
  facilityId!: string;

  @IsDateString()
  @IsNotEmpty()
  startTime!: string;

  @IsDateString()
  @IsNotEmpty()
  endTime!: string;
}
