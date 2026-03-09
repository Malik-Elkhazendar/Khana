import { Injectable } from '@nestjs/common';
import { Booking, User } from '@khana/data-access';
import {
  BookingListItemDto,
  CreateRecurringBookingResponseDto,
} from '@khana/shared-dtos';
import {
  BookingPreviewRequestDto,
  BookingPreviewResponseDto,
  CreateBookingDto,
  CreateRecurringBookingDto,
  UpdateBookingStatusDto,
} from './dto';
import { CreateBookingService } from './internal/create-booking.service';
import { CreateRecurringBookingsService } from './internal/create-recurring-bookings.service';
import { ExpirePendingHoldsService } from './internal/expire-pending-holds.service';
import { GetBookingService } from './internal/get-booking.service';
import { ListBookingFacilitiesService } from './internal/list-booking-facilities.service';
import { ListBookingsService } from './internal/list-bookings.service';
import { PreviewBookingService } from './internal/preview-booking.service';
import { UpdateBookingStatusService } from './internal/update-booking-status.service';

/**
 * Stable bookings facade for controllers, cleanup jobs, and other modules.
 * Each public method delegates immediately to a focused internal workflow.
 */
@Injectable()
export class BookingsService {
  constructor(
    private readonly listBookingsService: ListBookingsService,
    private readonly getBookingService: GetBookingService,
    private readonly expirePendingHoldsService: ExpirePendingHoldsService,
    private readonly previewBookingService: PreviewBookingService,
    private readonly listBookingFacilitiesService: ListBookingFacilitiesService,
    private readonly createBookingService: CreateBookingService,
    private readonly createRecurringBookingsService: CreateRecurringBookingsService,
    private readonly updateBookingStatusService: UpdateBookingStatusService
  ) {}

  findAll(
    tenantId: string,
    user: User,
    facilityId?: string
  ): Promise<BookingListItemDto[]> {
    return this.listBookingsService.execute(tenantId, user, facilityId);
  }

  findOne(
    tenantId: string,
    user: User,
    bookingId: string
  ): Promise<BookingListItemDto> {
    return this.getBookingService.execute(tenantId, user, bookingId);
  }

  expirePendingHolds(now: Date = new Date()): Promise<number> {
    return this.expirePendingHoldsService.execute(now);
  }

  previewBooking(
    dto: BookingPreviewRequestDto,
    tenantId: string
  ): Promise<BookingPreviewResponseDto> {
    return this.previewBookingService.execute(dto, tenantId);
  }

  getFacilities(tenantId: string) {
    return this.listBookingFacilitiesService.execute(tenantId);
  }

  createBooking(
    dto: CreateBookingDto,
    tenantId: string,
    userId: string,
    userRole: string
  ): Promise<Booking> {
    return this.createBookingService.execute(dto, tenantId, userId, userRole);
  }

  createRecurringBookings(
    dto: CreateRecurringBookingDto,
    tenantId: string,
    userId: string,
    userRole: string
  ): Promise<CreateRecurringBookingResponseDto> {
    return this.createRecurringBookingsService.execute(
      dto,
      tenantId,
      userId,
      userRole
    );
  }

  updateStatus(
    id: string,
    dto: UpdateBookingStatusDto,
    tenantId: string,
    user: User
  ): Promise<Booking> {
    return this.updateBookingStatusService.execute(id, dto, tenantId, user);
  }
}
