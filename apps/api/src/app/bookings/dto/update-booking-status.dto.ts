import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  BookingCancellationScope,
  BookingStatus,
  PaymentStatus,
} from '@khana/shared-dtos';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateBookingStatusDto {
  @ApiPropertyOptional({
    description: 'Booking lifecycle status to apply.',
    enum: BookingStatus,
  })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiPropertyOptional({
    description: 'Payment collection status for the booking.',
    enum: PaymentStatus,
  })
  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @ApiPropertyOptional({
    description:
      'Cancellation reason recorded when a booking is cancelled through the API.',
    example: 'Customer requested cancellation',
  })
  @IsOptional()
  @IsString()
  cancellationReason?: string;

  @ApiPropertyOptional({
    description:
      'Cancellation scope used when the booking belongs to a recurring series.',
    enum: BookingCancellationScope,
  })
  @IsOptional()
  @IsEnum(BookingCancellationScope)
  cancellationScope?: BookingCancellationScope;
}
