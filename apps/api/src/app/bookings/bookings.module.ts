import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  AuditLog,
  Booking,
  Facility,
  PromoCode,
  PromoCodeRedemption,
  User,
  WaitingListEntry,
} from '@khana/data-access';
import { AuthModule } from '../auth/auth.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { WaitlistCleanupService } from './waitlist/waitlist-cleanup.service';
import { WaitlistController } from './waitlist/waitlist.controller';
import { WaitlistService } from './waitlist/waitlist.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      Booking,
      Facility,
      User,
      PromoCode,
      PromoCodeRedemption,
      AuditLog,
      WaitingListEntry,
    ]),
  ],
  controllers: [BookingsController, WaitlistController],
  providers: [BookingsService, WaitlistService, WaitlistCleanupService],
  exports: [BookingsService],
})
export class BookingsModule {}
