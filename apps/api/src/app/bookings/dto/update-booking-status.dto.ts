import { BookingStatus, PaymentStatus } from '@khana/shared-dtos';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateBookingStatusDto {
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsString()
  @MinLength(5)
  cancellationReason?: string;
}
