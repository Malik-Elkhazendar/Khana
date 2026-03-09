import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AuditLog,
  Booking,
  Customer,
  Facility,
  PromoCode,
  PromoCodeRedemption,
  User,
  WaitingListEntry,
} from '@khana/data-access';
import { AuthModule } from '../auth/auth.module';
import { BookingsController } from './bookings.controller';
import { BookingHoldCleanupService } from './booking-hold-cleanup.service';
import { BookingsService } from './bookings.service';
import { WaitlistCleanupService } from './waitlist/waitlist-cleanup.service';
import { WaitlistController } from './waitlist/waitlist.controller';
import { WaitlistService } from './waitlist/waitlist.service';
import { GoalsModule } from '../goals/goals.module';
import { CustomersModule } from '../customers/customers.module';
import { BookingWriteSupportService } from './internal/booking-write-support.service';
import { CreateBookingService } from './internal/create-booking.service';
import { CreateRecurringBookingsService } from './internal/create-recurring-bookings.service';
import { ExpirePendingHoldsService } from './internal/expire-pending-holds.service';
import { GetBookingService } from './internal/get-booking.service';
import { ListBookingFacilitiesService } from './internal/list-booking-facilities.service';
import { ListBookingsService } from './internal/list-bookings.service';
import { PreviewBookingService } from './internal/preview-booking.service';
import { UpdateBookingStatusService } from './internal/update-booking-status.service';

@Module({
  imports: [
    AuthModule,
    GoalsModule,
    CustomersModule,
    TypeOrmModule.forFeature([
      Booking,
      Facility,
      User,
      Customer,
      PromoCode,
      PromoCodeRedemption,
      AuditLog,
      WaitingListEntry,
    ]),
  ],
  controllers: [WaitlistController, BookingsController],
  providers: [
    BookingsService,
    BookingWriteSupportService,
    BookingHoldCleanupService,
    ListBookingsService,
    GetBookingService,
    PreviewBookingService,
    ListBookingFacilitiesService,
    CreateBookingService,
    CreateRecurringBookingsService,
    UpdateBookingStatusService,
    ExpirePendingHoldsService,
    WaitlistService,
    WaitlistCleanupService,
  ],
  exports: [BookingsService],
})
export class BookingsModule {}
