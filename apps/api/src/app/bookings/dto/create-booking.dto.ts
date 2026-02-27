import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { BookingStatus } from '@khana/shared-dtos';

export class CreateBookingDto {
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
}
