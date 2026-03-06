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
    BookingHoldCleanupService,
    WaitlistService,
    WaitlistCleanupService,
  ],
  exports: [BookingsService],
})
export class BookingsModule {}
