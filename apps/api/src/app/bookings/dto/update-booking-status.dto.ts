import {
  BookingCancellationScope,
  BookingStatus,
  PaymentStatus,
} from '@khana/shared-dtos';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateBookingStatusDto {
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsString()
  cancellationReason?: string;

  @IsOptional()
  @IsEnum(BookingCancellationScope)
  cancellationScope?: BookingCancellationScope;
}
