import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, MoreThan, Repository } from 'typeorm';
import {
  previewBooking,
  BookingPreviewResult,
  detectConflicts,
  calculatePrice,
} from '@khana/booking-engine';
import { Booking, Facility, User } from '@khana/data-access';
import { BookingStatus, PaymentStatus, SlotStatus } from '@khana/shared-dtos';
import { addMinutes, generateBookingReference } from '@khana/shared-utils';
import { EmailService } from '@khana/notifications';
import {
  BookingPreviewRequestDto,
  BookingPreviewResponseDto,
  CreateBookingDto,
  UpdateBookingStatusDto,
} from './dto';

const PENDING_HOLD_MINUTES = 15;
const AUTO_CANCEL_REASON = 'Auto-cancelled: hold expired';
const ACCESS_DENIED_MESSAGE =
  'Access denied: You do not have permission to access this resource.';
const RESOURCE_NOT_FOUND_MESSAGE = 'Resource not found';

const ALLOWED_STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  [BookingStatus.PENDING]: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED],
  [BookingStatus.CONFIRMED]: [
    BookingStatus.CANCELLED,
    BookingStatus.COMPLETED,
    BookingStatus.NO_SHOW,
  ],
  [BookingStatus.CANCELLED]: [],
  [BookingStatus.COMPLETED]: [],
  [BookingStatus.NO_SHOW]: [],
};

/**
 * Bookings Service
 *
 * Thin service layer that orchestrates domain logic.
 * Business logic lives in @khana/booking-engine.
 */
@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Facility)
    private readonly facilityRepository: Repository<Facility>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly emailService: EmailService
  ) {}

  async findAll(tenantId: string, facilityId?: string): Promise<Booking[]> {
    const resolvedTenantId = this.requireTenantId(tenantId);
    const now = new Date();

    const expiredPendingBookings = await this.bookingRepository
      .createQueryBuilder('booking')
      .innerJoin('booking.facility', 'facility')
      .select('booking.id', 'id')
      .where('booking.status = :pendingStatus', {
        pendingStatus: BookingStatus.PENDING,
      })
      .andWhere('booking.holdUntil <= :now', { now })
      .andWhere('facility.tenantId = :tenantId', { tenantId: resolvedTenantId })
      .getRawMany<{ id: string }>();

    if (expiredPendingBookings.length > 0) {
      await this.bookingRepository.update(
        { id: In(expiredPendingBookings.map((row) => row.id)) },
        {
          status: BookingStatus.CANCELLED,
          holdUntil: null,
          cancellationReason: AUTO_CANCEL_REASON,
        }
      );
    }

    if (facilityId) {
      await this.validateFacilityOwnership(facilityId, resolvedTenantId);
    }

    const query = this.bookingRepository
      .createQueryBuilder('booking')
      .innerJoinAndSelect('booking.facility', 'facility')
      .where('facility.tenantId = :tenantId', { tenantId: resolvedTenantId })
      .orderBy('booking.startTime', 'DESC');

    if (facilityId) {
      query.andWhere('facility.id = :facilityId', { facilityId });
    }

    return query.getMany();
  }

  /**
   * Preview a booking
   *
   * Validates input, calls domain logic, and returns formatted response.
   */
  async previewBooking(
    dto: BookingPreviewRequestDto,
    tenantId: string
  ): Promise<BookingPreviewResponseDto> {
    const resolvedTenantId = this.requireTenantId(tenantId);
    const now = new Date();
    const facility = await this.validateFacilityOwnership(
      dto.facilityId,
      resolvedTenantId
    );

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
        {
          facility: { id: dto.facilityId, tenant: { id: resolvedTenantId } },
          status: BookingStatus.CONFIRMED,
        },
        {
          facility: { id: dto.facilityId, tenant: { id: resolvedTenantId } },
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
  async getFacilities(tenantId: string) {
    const resolvedTenantId = this.requireTenantId(tenantId);
    const facilities = await this.facilityRepository.find({
      where: { tenant: { id: resolvedTenantId } },
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
  async createBooking(
    dto: CreateBookingDto,
    tenantId: string,
    userId: string
  ): Promise<Booking> {
    const resolvedTenantId = this.requireTenantId(tenantId);
    const resolvedUserId = this.requireUserId(userId);
    const now = new Date();
    // 1. Fetch facility with ownership validation
    const facility = await this.validateFacilityOwnership(
      dto.facilityId,
      resolvedTenantId
    );

    // 2. Fetch all confirmed bookings for this facility
    const existingBookings = await this.bookingRepository.find({
      where: [
        {
          facility: { id: dto.facilityId, tenant: { id: resolvedTenantId } },
          status: BookingStatus.CONFIRMED,
        },
        {
          facility: { id: dto.facilityId, tenant: { id: resolvedTenantId } },
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
      throw new ConflictException({
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
      createdByUserId: resolvedUserId,
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

    // 6. Save booking
    const saved = await this.bookingRepository.save(booking);

    // 7. Send notification emails (fire-and-forget, never block)
    this.sendBookingCreatedEmails(saved, facility, resolvedUserId).catch(
      (err) => this.logger.error('Failed to send booking creation emails', err)
    );

    return saved;
  }

  /**
   * Update booking status
   */
  async updateStatus(
    id: string,
    dto: UpdateBookingStatusDto,
    tenantId: string
  ): Promise<Booking> {
    const resolvedTenantId = this.requireTenantId(tenantId);
    const booking = await this.validateBookingOwnership(id, resolvedTenantId);

    const effectiveStatus = dto.status ?? booking.status;
    if (dto.status) {
      this.validateStatusTransition(booking.status, dto.status);
    }

    if (
      dto.status === BookingStatus.CANCELLED &&
      (booking.paymentStatus === PaymentStatus.PAID ||
        booking.paymentStatus === PaymentStatus.PARTIALLY_PAID)
    ) {
      // TODO: Replace this hard block with refund flow once payment gateway is integrated.
      throw new ConflictException(
        'Paid bookings require a refund flow; payment gateway integration pending.'
      );
    }
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

    // Send cancellation email (fire-and-forget)
    if (dto.status === BookingStatus.CANCELLED) {
      this.sendCancellationEmail(booking).catch((err) =>
        this.logger.error('Failed to send cancellation email', err)
      );
    }

    return booking;
  }

  private requireTenantId(tenantId?: string): string {
    if (!tenantId?.trim()) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }

    return tenantId;
  }

  private requireUserId(userId?: string): string {
    if (!userId?.trim()) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }

    return userId;
  }

  private async validateFacilityOwnership(
    facilityId: string,
    tenantId: string
  ): Promise<Facility> {
    const facility = await this.facilityRepository.findOne({
      where: { id: facilityId },
      relations: { tenant: true },
    });

    if (!facility) {
      throw new NotFoundException(RESOURCE_NOT_FOUND_MESSAGE);
    }

    if (facility.tenant.id !== tenantId) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }

    return facility;
  }

  private async validateBookingOwnership(
    bookingId: string,
    tenantId: string
  ): Promise<Booking> {
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
      relations: { facility: { tenant: true } },
    });

    if (!booking) {
      throw new NotFoundException(RESOURCE_NOT_FOUND_MESSAGE);
    }

    if (booking.facility.tenant.id !== tenantId) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }

    return booking;
  }

  private validateStatusTransition(
    currentStatus: BookingStatus,
    nextStatus: BookingStatus
  ): void {
    if (currentStatus === nextStatus) {
      return;
    }

    const allowedTransitions = ALLOWED_STATUS_TRANSITIONS[currentStatus] ?? [];
    if (!allowedTransitions.includes(nextStatus)) {
      throw new BadRequestException('Invalid booking status transition.');
    }
  }

  /**
   * Send booking confirmation + manager alert after booking creation.
   */
  private async sendBookingCreatedEmails(
    booking: Booking,
    facility: Facility,
    userId: string
  ): Promise<void> {
    // Send booking confirmation to the creating user
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'email', 'name'],
    });

    if (user) {
      try {
        await this.emailService.sendBookingConfirmation({
          recipientEmail: user.email,
          customerName: booking.customerName,
          customerPhone: booking.customerPhone,
          bookingReference: booking.bookingReference ?? booking.id,
          facilityName: facility.name,
          startTime: booking.startTime,
          endTime: booking.endTime,
          totalAmount: booking.totalAmount,
          currency: booking.currency,
        });
      } catch (err) {
        this.logger.error('Failed to send booking confirmation', err);
      }
    }

    // Send new booking alert to managers/owners of the tenant
    const managers = await this.userRepository.find({
      where: [
        { tenantId: facility.tenant.id, role: 'OWNER', isActive: true },
        { tenantId: facility.tenant.id, role: 'MANAGER', isActive: true },
      ],
      select: ['id', 'email', 'name'],
    });

    for (const manager of managers) {
      if (manager.id === userId) continue;
      try {
        await this.emailService.sendNewBookingAlert({
          managerEmail: manager.email,
          managerName: manager.name,
          customerName: booking.customerName,
          customerPhone: booking.customerPhone,
          bookingReference: booking.bookingReference ?? booking.id,
          facilityName: facility.name,
          startTime: booking.startTime,
          endTime: booking.endTime,
          totalAmount: booking.totalAmount,
          currency: booking.currency,
        });
      } catch (err) {
        this.logger.error(
          `Failed to send new booking alert to ${manager.email}`,
          err
        );
      }
    }
  }

  /**
   * Send cancellation notification email.
   */
  private async sendCancellationEmail(booking: Booking): Promise<void> {
    if (!booking.createdByUserId) return;

    const user = await this.userRepository.findOne({
      where: { id: booking.createdByUserId },
      select: ['id', 'email'],
    });

    if (!user) return;

    const facilityName = booking.facility?.name ?? 'Unknown Facility';

    try {
      await this.emailService.sendCancellationNotification({
        recipientEmail: user.email,
        customerName: booking.customerName,
        bookingReference: booking.bookingReference ?? booking.id,
        facilityName,
        startTime: booking.startTime,
        endTime: booking.endTime,
        reason: booking.cancellationReason ?? 'No reason provided',
      });
    } catch (err) {
      this.logger.error('Failed to send cancellation email', err);
    }
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
