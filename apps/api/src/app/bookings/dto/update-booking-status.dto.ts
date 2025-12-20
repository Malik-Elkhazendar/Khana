import { BookingStatus, PaymentStatus } from '@khana/shared-dtos';
import { IsEnum, IsOptional } from 'class-validator';

export class UpdateBookingStatusDto {
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;
}
