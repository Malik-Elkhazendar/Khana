import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { previewBooking, BookingPreviewResult, detectConflicts, calculatePrice } from '@khana/booking-engine';
import { Booking, Facility } from '@khana/data-access';
import { BookingStatus, PaymentStatus, SlotStatus } from '@khana/shared-dtos';
import { BookingPreviewRequestDto, BookingPreviewResponseDto, CreateBookingDto, UpdateBookingStatusDto } from './dto';

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
  async previewBooking(dto: BookingPreviewRequestDto): Promise<BookingPreviewResponseDto> {
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
      where: {
        facility: { id: dto.facilityId },
        status: BookingStatus.CONFIRMED,
      },
    });

    const occupiedSlots = existingBookings.map((booking) => ({
      id: booking.id,
      facilityId: dto.facilityId,
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: SlotStatus.BOOKED,
      bookingReference: booking.id,
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
      where: {
        facility: { id: dto.facilityId },
        status: BookingStatus.CONFIRMED,
      },
    });

    const occupiedSlots = existingBookings.map((booking) => ({
      id: booking.id,
      facilityId: dto.facilityId,
      startTime: booking.startTime,
      endTime: booking.endTime,
      status: SlotStatus.BOOKED,
      bookingReference: booking.id,
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

    // 5. Map & Save: Create booking entity
    const booking = this.bookingRepository.create({
      facility,
      startTime: new Date(dto.startTime),
      endTime: new Date(dto.endTime),
      customerName: dto.customerName,
      customerPhone: dto.customerPhone,
      status: dto.status ?? BookingStatus.CONFIRMED,
      paymentStatus: dto.paymentStatus ?? PaymentStatus.PENDING,
    });

    // 6. Return saved booking
    return await this.bookingRepository.save(booking);
  }

  /**
   * Update booking status
   */
  async updateStatus(id: string, dto: UpdateBookingStatusDto): Promise<Booking> {
    const booking = await this.bookingRepository.findOneBy({ id });
    if (!booking) {
      throw new NotFoundException(`Booking ${id} not found`);
    }

    if (dto.status) {
      booking.status = dto.status;
    }
    if (dto.paymentStatus) {
      booking.paymentStatus = dto.paymentStatus;
    }

    return this.bookingRepository.save(booking);
  }

  /**
   * Transform domain result to API response DTO
   */
  private transformToResponseDto(result: BookingPreviewResult): BookingPreviewResponseDto {
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
        conflictingSlots: result.conflict.conflictingSlots.map(slot => ({
          startTime: slot.startTime.toISOString(),
          endTime: slot.endTime.toISOString(),
          status: slot.status,
          bookingReference: slot.bookingReference,
        })),
      };
    }

    if (result.suggestedAlternatives && result.suggestedAlternatives.length > 0) {
      response.suggestedAlternatives = result.suggestedAlternatives.map(alt => ({
        startTime: alt.startTime.toISOString(),
        endTime: alt.endTime.toISOString(),
        price: alt.price,
        currency: alt.currency,
      }));
    }

    return response;
  }
}
