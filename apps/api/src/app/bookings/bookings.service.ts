import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, MoreThan, Repository } from 'typeorm';
import {
  previewBooking,
  BookingPreviewResult,
  detectConflicts,
  calculatePrice,
} from '@khana/booking-engine';
import { Booking, Facility } from '@khana/data-access';
import { BookingStatus, PaymentStatus, SlotStatus } from '@khana/shared-dtos';
import { addMinutes, generateBookingReference } from '@khana/shared-utils';
import {
  BookingPreviewRequestDto,
  BookingPreviewResponseDto,
  CreateBookingDto,
  UpdateBookingStatusDto,
} from './dto';

const PENDING_HOLD_MINUTES = 15;
const AUTO_CANCEL_REASON = 'Auto-cancelled: hold expired';

/**
 * Bookings Service
 *
 * Thin service layer that orchestrates domain logic.
 * Business logic lives in @khana/booking-engine.
 */
@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Facility)
    private readonly facilityRepository: Repository<Facility>
  ) {}

  async findAll(facilityId?: string): Promise<Booking[]> {
    const now = new Date();
    await this.bookingRepository.update(
      { status: BookingStatus.PENDING, holdUntil: LessThanOrEqual(now) },
      {
        status: BookingStatus.CANCELLED,
        holdUntil: null,
        cancellationReason: AUTO_CANCEL_REASON,
      }
    );

    return this.bookingRepository.find({
      where: facilityId ? { facility: { id: facilityId } } : {},
      relations: { facility: true },
      order: { startTime: 'DESC' },
    });
  }

  /**
   * Preview a booking
   *
   * Validates input, calls domain logic, and returns formatted response.
   */
  async previewBooking(
    dto: BookingPreviewRequestDto
  ): Promise<BookingPreviewResponseDto> {
    const now = new Date();
    const facility = await this.facilityRepository.findOne({
      where: { id: dto.facilityId },
      relations: { tenant: true },
    });

    if (!facility) {
      throw new NotFoundException(`Facility ${dto.facilityId} not found`);
    }

    const facilityConfig = {
      id: facility.id,
      name: facility.name,
      openTime: facility.config.openTime,
      closeTime: facility.config.closeTime,
      slotDurationMinutes: 60,
      pricing: {
        basePrice: facility.config.pricePerHour,
        currency: 'SAR',
      },
    };

    // Load actual bookings for this facility
    const existingBookings = await this.bookingRepository.find({
      where: [
        { facility: { id: dto.facilityId }, status: BookingStatus.CONFIRMED },
        {
          facility: { id: dto.facilityId },
          status: BookingStatus.PENDING,
          holdUntil: MoreThan(now),
        },
      ],
    });

    const occupiedSlots = existingBookings.map((booking) => ({
      id: booking.id,
      facilityId: dto.facilityId,
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: SlotStatus.BOOKED,
      bookingReference: booking.bookingReference ?? booking.id,
    }));

    // Call domain logic
    const result: BookingPreviewResult = previewBooking(
      {
        facilityId: dto.facilityId,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
        promoCode: dto.promoCode,
      },
      facilityConfig,
      occupiedSlots
    );

    // Transform to response DTO (convert dates to ISO strings for JSON)
    return this.transformToResponseDto(result);
  }

  /**
   * Get all available facilities
   */
  async getFacilities() {
    const facilities = await this.facilityRepository.find({
      order: { name: 'ASC' },
    });

    return facilities.map((facility) => ({
      id: facility.id,
      name: facility.name,
      openTime: facility.config.openTime,
      closeTime: facility.config.closeTime,
      slotDurationMinutes: 60,
      basePrice: facility.config.pricePerHour,
      currency: 'SAR',
    }));
  }

  /**
   * Create a booking
   *
   * Pattern: Repository → Domain Engine → Repository
   * 1. Fetch facility and conflicting bookings from DB
   * 2. Use domain logic to check availability and calculate price
   * 3. Save booking to DB if available
   */
  async createBooking(dto: CreateBookingDto): Promise<Booking> {
    const now = new Date();
    // 1. Fetch facility with config
    const facility = await this.facilityRepository.findOne({
      where: { id: dto.facilityId },
      relations: { tenant: true },
    });

    if (!facility) {
      throw new NotFoundException(`Facility ${dto.facilityId} not found`);
    }

    // 2. Fetch all confirmed bookings for this facility
    const existingBookings = await this.bookingRepository.find({
      where: [
        { facility: { id: dto.facilityId }, status: BookingStatus.CONFIRMED },
        {
          facility: { id: dto.facilityId },
          status: BookingStatus.PENDING,
          holdUntil: MoreThan(now),
        },
      ],
    });

    const occupiedSlots = existingBookings.map((booking) => ({
      id: booking.id,
      facilityId: dto.facilityId,
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: SlotStatus.BOOKED,
      bookingReference: booking.bookingReference ?? booking.id,
    }));

    // 3. Guard: Check availability using domain engine
    const conflictResult = detectConflicts({
      facilityId: dto.facilityId,
      requestedStart: new Date(dto.startTime),
      requestedEnd: new Date(dto.endTime),
      occupiedSlots,
    });

    if (conflictResult.hasConflict) {
      throw new BadRequestException({
        message: conflictResult.message,
        conflictType: conflictResult.conflictType,
        conflictingSlots: conflictResult.conflictingSlots,
      });
    }

    // 4. Calculate price using domain engine (Server-Side Authority)
    const facilityConfig = {
      id: facility.id,
      name: facility.name,
      openTime: facility.config.openTime,
      closeTime: facility.config.closeTime,
      slotDurationMinutes: 60,
      pricing: {
        basePrice: facility.config.pricePerHour,
        currency: 'SAR',
      },
    };

    const priceBreakdown = calculatePrice({
      startTime: new Date(dto.startTime),
      endTime: new Date(dto.endTime),
      pricingConfig: facilityConfig.pricing,
    });

    const bookingSequence = (await this.bookingRepository.count()) + 1;
    const bookingReference = generateBookingReference(bookingSequence);
    const status = dto.status ?? BookingStatus.CONFIRMED;
    const holdUntil =
      status === BookingStatus.PENDING
        ? addMinutes(now, PENDING_HOLD_MINUTES)
        : null;

    // 5. Map & Save: Create booking entity
    const booking = this.bookingRepository.create({
      facility,
      startTime: new Date(dto.startTime),
      endTime: new Date(dto.endTime),
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      status,
      paymentStatus: dto.paymentStatus ?? PaymentStatus.PENDING,
      bookingReference,
      totalAmount: priceBreakdown.total,
      currency: priceBreakdown.currency,
      priceBreakdown,
      holdUntil,
    });

    // 6. Return saved booking
    return await this.bookingRepository.save(booking);
  }

  /**
   * Update booking status
   */
  async updateStatus(
    id: string,
    dto: UpdateBookingStatusDto
  ): Promise<Booking> {
    const booking = await this.bookingRepository.findOne({
      where: { id },
      relations: { facility: true },
    });
    if (!booking) {
      throw new NotFoundException(`Booking ${id} not found`);
    }

    const effectiveStatus = dto.status ?? booking.status;
    const trimmedReason = dto.cancellationReason?.trim();
    if (dto.status === BookingStatus.CANCELLED && !trimmedReason) {
      throw new BadRequestException('Cancellation reason is required.');
    }
    if (trimmedReason && effectiveStatus !== BookingStatus.CANCELLED) {
      throw new BadRequestException(
        'Cancellation reason is only allowed when cancelling a booking.'
      );
    }

    if (dto.status) {
      booking.status = dto.status;
      if (dto.status === BookingStatus.PENDING) {
        booking.holdUntil = addMinutes(new Date(), PENDING_HOLD_MINUTES);
      } else {
        booking.holdUntil = null;
      }
    }
    if (dto.paymentStatus) {
      booking.paymentStatus = dto.paymentStatus;
    }
    if (effectiveStatus === BookingStatus.CANCELLED) {
      booking.cancellationReason =
        trimmedReason ?? booking.cancellationReason ?? null;
    } else if (dto.status && dto.status !== BookingStatus.CANCELLED) {
      booking.cancellationReason = null;
    }

    await this.bookingRepository.save(booking);
    return booking;
  }

  /**
   * Transform domain result to API response DTO
   */
  private transformToResponseDto(
    result: BookingPreviewResult
  ): BookingPreviewResponseDto {
    const response: BookingPreviewResponseDto = {
      canBook: result.canBook,
      priceBreakdown: result.priceBreakdown,
    };

    if (result.validationErrors && result.validationErrors.length > 0) {
      response.validationErrors = result.validationErrors;
    }

    if (result.conflict) {
      response.conflict = {
        hasConflict: result.conflict.hasConflict,
        conflictType: result.conflict.conflictType,
        message: result.conflict.message,
        conflictingSlots: result.conflict.conflictingSlots.map((slot) => ({
          startTime: slot.startTime.toISOString(),
          endTime: slot.endTime.toISOString(),
          status: slot.status,
          bookingReference: slot.bookingReference,
        })),
      };
    }

    if (
      result.suggestedAlternatives &&
      result.suggestedAlternatives.length > 0
    ) {
      response.suggestedAlternatives = result.suggestedAlternatives.map(
        (alt) => ({
          startTime: alt.startTime.toISOString(),
          endTime: alt.endTime.toISOString(),
          price: alt.price,
          currency: alt.currency,
        })
      );
    }

    return response;
  }
}
