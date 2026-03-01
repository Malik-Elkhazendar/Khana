import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes, randomUUID } from 'crypto';
import { In, MoreThan, Repository } from 'typeorm';
import {
  previewBooking,
  BookingPreviewResult,
  detectConflicts,
  calculatePrice,
  validateBookingInput,
} from '@khana/booking-engine';
import {
  AuditAction,
  AuditLog,
  Booking,
  Facility,
  User,
} from '@khana/data-access';
import {
  BookingCancellationScope,
  BookingListItemDto,
  BookingRecurrenceRuleDto,
  CreateRecurringBookingResponseDto,
  BookingStatus,
  PaymentStatus,
  RecurrenceFrequency,
  SlotStatus,
  UserRole,
} from '@khana/shared-dtos';
import { addMinutes } from '@khana/shared-utils';
import { EmailService } from '@khana/notifications';
import { AppLoggerService, LOG_EVENTS } from '../logging';
import {
  BookingPreviewRequestDto,
  BookingPreviewResponseDto,
  CreateBookingDto,
  CreateRecurringBookingDto,
  UpdateBookingStatusDto,
} from './dto';

const PENDING_HOLD_MINUTES = 15;
const AUTO_CANCEL_REASON = 'Auto-cancelled: hold expired';
const ACCESS_DENIED_MESSAGE =
  'Access denied: You do not have permission to access this resource.';
const RESOURCE_NOT_FOUND_MESSAGE = 'Resource not found';
const INACTIVE_FACILITY_MESSAGE =
  'This facility is currently inactive and cannot be booked.';
const BOOKING_REFERENCE_PREFIX = 'KHN';
const BOOKING_REFERENCE_RANDOM_LENGTH = 6;
const BOOKING_REFERENCE_ATTEMPTS = 5;
const MAX_RECURRING_OCCURRENCES = 104;

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
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Facility)
    private readonly facilityRepository: Repository<Facility>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly emailService: EmailService,
    private readonly appLogger: AppLoggerService
  ) {}

  async findAll(
    tenantId: string,
    user: User,
    facilityId?: string
  ): Promise<Booking[]> {
    const resolvedTenantId = this.requireTenantId(tenantId);
    const actorRole = this.requireUserRole(user?.role);
    const actorUserId = this.requireUserId(user?.id);
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

    if (this.isStaff(actorRole)) {
      query.andWhere('booking.createdByUserId = :actorUserId', { actorUserId });
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
      resolvedTenantId,
      true
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
      where: { tenant: { id: resolvedTenantId }, isActive: true },
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
   * Pattern: Repository -> Domain Engine -> Repository
   * 1. Fetch facility and conflicting bookings from DB
   * 2. Use domain logic to check availability and calculate price
   * 3. Save booking to DB if available
   */
  async createBooking(
    dto: CreateBookingDto,
    tenantId: string,
    userId: string,
    userRole: string
  ): Promise<Booking> {
    const resolvedTenantId = this.requireTenantId(tenantId);
    const resolvedUserId = this.requireUserId(userId);
    const actorRole = this.requireUserRole(userRole);

    if (this.isViewer(actorRole)) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }

    // 1. Fetch facility with ownership validation
    const facility = await this.validateFacilityOwnership(
      dto.facilityId,
      resolvedTenantId,
      true
    );

    // 2-6. Create inside a transaction and serialize by facility row lock to
    // prevent check-then-insert races that can double-book the same slot.
    const saved = await this.bookingRepository.manager.transaction(
      async (manager) => {
        const bookingRepo = manager.getRepository(Booking);

        const lockedFacility = await manager
          .getRepository(Facility)
          .createQueryBuilder('facility')
          .where('facility.id = :facilityId', { facilityId: facility.id })
          .setLock('pessimistic_write')
          .getOne();

        if (!lockedFacility) {
          throw new NotFoundException(RESOURCE_NOT_FOUND_MESSAGE);
        }

        if (!lockedFacility.isActive) {
          throw new ConflictException(INACTIVE_FACILITY_MESSAGE);
        }

        const now = new Date();
        const startTime = new Date(dto.startTime);
        const endTime = new Date(dto.endTime);
        const existingBookings = await bookingRepo.find({
          where: [
            {
              facility: {
                id: dto.facilityId,
                tenant: { id: resolvedTenantId },
              },
              status: BookingStatus.CONFIRMED,
            },
            {
              facility: {
                id: dto.facilityId,
                tenant: { id: resolvedTenantId },
              },
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

        const facilityConfig = {
          id: lockedFacility.id,
          name: lockedFacility.name,
          openTime: lockedFacility.config.openTime,
          closeTime: lockedFacility.config.closeTime,
          slotDurationMinutes: 60,
          pricing: {
            basePrice: lockedFacility.config.pricePerHour,
            currency: 'SAR',
          },
        };

        const validationErrors = validateBookingInput(
          {
            facilityId: dto.facilityId,
            startTime,
            endTime,
          },
          facilityConfig
        );
        if (validationErrors.length > 0) {
          throw new BadRequestException({
            message: 'Booking validation failed.',
            validationErrors,
          });
        }

        const conflictResult = detectConflicts({
          facilityId: dto.facilityId,
          requestedStart: startTime,
          requestedEnd: endTime,
          occupiedSlots,
        });

        if (conflictResult.hasConflict) {
          this.appLogger.warn(
            LOG_EVENTS.BOOKING_CREATE_CONFLICT,
            'Booking conflict detected',
            {
              facilityId: dto.facilityId,
              conflictType: conflictResult.conflictType,
            }
          );
          throw new ConflictException({
            message: conflictResult.message,
            conflictType: conflictResult.conflictType,
            conflictingSlots: conflictResult.conflictingSlots,
          });
        }

        const priceBreakdown = calculatePrice({
          startTime,
          endTime,
          pricingConfig: facilityConfig.pricing,
        });

        const bookingReference = await this.generateUniqueBookingReference(
          bookingRepo
        );
        const status = this.resolveCreateStatus(dto.status);
        const holdUntil =
          status === BookingStatus.PENDING
            ? addMinutes(now, PENDING_HOLD_MINUTES)
            : null;

        const booking = bookingRepo.create({
          facility,
          createdByUserId: resolvedUserId,
          startTime,
          endTime,
          customerName: dto.customerName,
          customerPhone: dto.customerPhone,
          status,
          paymentStatus: PaymentStatus.PENDING,
          bookingReference,
          totalAmount: priceBreakdown.total,
          currency: priceBreakdown.currency,
          priceBreakdown,
          holdUntil,
        });

        return bookingRepo.save(booking);
      }
    );

    this.appLogger.info(LOG_EVENTS.BOOKING_CREATE_SUCCESS, 'Booking created', {
      bookingId: saved.id,
      facilityId: saved.facility?.id,
      status: saved.status,
    });

    // 7. Send notification emails (fire-and-forget, never block)
    this.sendBookingCreatedEmails(saved, facility, resolvedUserId).catch(
      (err) =>
        this.appLogger.error(
          LOG_EVENTS.EMAIL_FAILED,
          'Failed to send booking creation emails',
          { bookingId: saved.id },
          err
        )
    );

    return saved;
  }

  /**
   * Create recurring bookings in a single, all-or-nothing operation.
   */
  async createRecurringBookings(
    dto: CreateRecurringBookingDto,
    tenantId: string,
    userId: string,
    userRole: string
  ): Promise<CreateRecurringBookingResponseDto> {
    const resolvedTenantId = this.requireTenantId(tenantId);
    const resolvedUserId = this.requireUserId(userId);
    const actorRole = this.requireUserRole(userRole);

    if (this.isViewer(actorRole)) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }

    const facility = await this.validateFacilityOwnership(
      dto.facilityId,
      resolvedTenantId,
      true
    );
    const recurrenceRule = this.normalizeRecurrenceRule(dto.recurrenceRule);
    const baseStartTime = new Date(dto.startTime);
    const baseEndTime = new Date(dto.endTime);
    const occurrences = this.generateRecurringOccurrences(
      baseStartTime,
      baseEndTime,
      recurrenceRule
    );

    const now = new Date();
    const created = await this.bookingRepository.manager.transaction(
      async (manager) => {
        const bookingRepo = manager.getRepository(Booking);
        const lockedFacility = await manager
          .getRepository(Facility)
          .createQueryBuilder('facility')
          .where('facility.id = :facilityId', { facilityId: facility.id })
          .setLock('pessimistic_write')
          .getOne();

        if (!lockedFacility) {
          throw new NotFoundException(RESOURCE_NOT_FOUND_MESSAGE);
        }

        if (!lockedFacility.isActive) {
          throw new ConflictException(INACTIVE_FACILITY_MESSAGE);
        }

        const firstOccurrence = occurrences[0];
        const lastOccurrence = occurrences[occurrences.length - 1];

        const existingBookings = await bookingRepo
          .createQueryBuilder('booking')
          .innerJoin('booking.facility', 'facility')
          .where('facility.id = :facilityId', { facilityId: dto.facilityId })
          .andWhere('facility.tenantId = :tenantId', {
            tenantId: resolvedTenantId,
          })
          .andWhere(
            `(
              booking.status = :confirmedStatus
              OR (
                booking.status = :pendingStatus
                AND booking.holdUntil > :now
              )
            )`,
            {
              confirmedStatus: BookingStatus.CONFIRMED,
              pendingStatus: BookingStatus.PENDING,
              now,
            }
          )
          .andWhere('booking.startTime < :windowEnd', {
            windowEnd: lastOccurrence.endTime,
          })
          .andWhere('booking.endTime > :windowStart', {
            windowStart: firstOccurrence.startTime,
          })
          .getMany();

        const occupiedSlots = existingBookings.map((booking) => ({
          id: booking.id,
          facilityId: dto.facilityId,
          startTime: booking.startTime,
          endTime: booking.endTime,
          status: SlotStatus.BOOKED,
          bookingReference: booking.bookingReference ?? booking.id,
        }));
        const dynamicOccupiedSlots = [...occupiedSlots];
        const facilityConfig = this.buildFacilityConfig(lockedFacility);

        const validationErrors: string[] = [];
        const conflicts: Array<{
          instanceNumber: number;
          startTime: string;
          endTime: string;
          message: string;
          conflictType?: string;
          conflictingSlots: Array<{
            startTime: string;
            endTime: string;
            bookingReference?: string;
          }>;
        }> = [];

        for (const occurrence of occurrences) {
          const occurrenceValidationErrors = validateBookingInput(
            {
              facilityId: dto.facilityId,
              startTime: occurrence.startTime,
              endTime: occurrence.endTime,
            },
            facilityConfig
          );

          if (occurrenceValidationErrors.length > 0) {
            validationErrors.push(
              ...occurrenceValidationErrors.map(
                (message) =>
                  `Instance #${occurrence.instanceNumber}: ${message}`
              )
            );
            continue;
          }

          const conflictResult = detectConflicts({
            facilityId: dto.facilityId,
            requestedStart: occurrence.startTime,
            requestedEnd: occurrence.endTime,
            occupiedSlots: dynamicOccupiedSlots,
          });

          if (conflictResult.hasConflict) {
            conflicts.push({
              instanceNumber: occurrence.instanceNumber,
              startTime: occurrence.startTime.toISOString(),
              endTime: occurrence.endTime.toISOString(),
              message: conflictResult.message,
              conflictType: conflictResult.conflictType,
              conflictingSlots: conflictResult.conflictingSlots.map((slot) => ({
                startTime: slot.startTime.toISOString(),
                endTime: slot.endTime.toISOString(),
                bookingReference: slot.bookingReference,
              })),
            });
            continue;
          }

          dynamicOccupiedSlots.push({
            id: `candidate-${occurrence.instanceNumber}`,
            facilityId: dto.facilityId,
            startTime: occurrence.startTime,
            endTime: occurrence.endTime,
            status: SlotStatus.BOOKED,
            bookingReference: `candidate-${occurrence.instanceNumber}`,
          });
        }

        if (validationErrors.length > 0) {
          throw new BadRequestException({
            message: 'Recurring booking validation failed.',
            validationErrors,
          });
        }

        if (conflicts.length > 0) {
          this.appLogger.warn(
            LOG_EVENTS.BOOKING_CREATE_CONFLICT,
            'Recurring booking conflict detected',
            {
              facilityId: dto.facilityId,
              conflictCount: conflicts.length,
            }
          );
          throw new ConflictException({
            message:
              'One or more recurring instances conflict with existing bookings.',
            conflicts,
          });
        }

        const status = this.resolveCreateStatus(dto.status);
        const recurrenceGroupId = randomUUID();
        const toPersist: Booking[] = [];

        for (const occurrence of occurrences) {
          const bookingReference = await this.generateUniqueBookingReference(
            bookingRepo
          );
          const priceBreakdown = calculatePrice({
            startTime: occurrence.startTime,
            endTime: occurrence.endTime,
            pricingConfig: facilityConfig.pricing,
          });
          const holdUntil =
            status === BookingStatus.PENDING
              ? addMinutes(now, PENDING_HOLD_MINUTES)
              : null;

          toPersist.push(
            bookingRepo.create({
              facility: lockedFacility,
              createdByUserId: resolvedUserId,
              startTime: occurrence.startTime,
              endTime: occurrence.endTime,
              customerName: dto.customerName,
              customerPhone: dto.customerPhone,
              status,
              paymentStatus: PaymentStatus.PENDING,
              bookingReference,
              totalAmount: priceBreakdown.total,
              currency: priceBreakdown.currency,
              priceBreakdown,
              holdUntil,
              recurrenceRule,
              recurrenceGroupId,
              recurrenceInstanceNumber: occurrence.instanceNumber,
            })
          );
        }

        const saved = await bookingRepo.save(toPersist);
        return {
          recurrenceGroupId,
          createdCount: saved.length,
          bookings: saved.map((booking) =>
            this.toBookingListItemDto(booking, lockedFacility)
          ),
        };
      }
    );

    await this.logAudit({
      tenantId: resolvedTenantId,
      userId: resolvedUserId,
      action: AuditAction.CREATE,
      entityType: 'BookingSeries',
      entityId: created.recurrenceGroupId,
      description: `Recurring booking series created (${created.createdCount} instances)`,
      changes: {
        after: {
          facilityId: dto.facilityId,
          recurrenceGroupId: created.recurrenceGroupId,
          createdCount: created.createdCount,
          recurrenceRule,
        },
      },
    });

    this.appLogger.info(
      LOG_EVENTS.BOOKING_CREATE_SUCCESS,
      'Recurring bookings created',
      {
        recurrenceGroupId: created.recurrenceGroupId,
        createdCount: created.createdCount,
        facilityId: dto.facilityId,
      }
    );

    return created;
  }

  /**
   * Update booking status
   */
  async updateStatus(
    id: string,
    dto: UpdateBookingStatusDto,
    tenantId: string,
    user: User
  ): Promise<Booking> {
    const resolvedTenantId = this.requireTenantId(tenantId);
    const actorRole = this.requireUserRole(user?.role);
    const actorUserId = this.requireUserId(user?.id);

    if (this.isViewer(actorRole)) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }

    const booking = await this.validateBookingOwnership(id, resolvedTenantId);

    if (this.isStaff(actorRole)) {
      const ownsBooking = booking.createdByUserId === actorUserId;
      const isCancelAction =
        dto.status === BookingStatus.CANCELLED &&
        typeof dto.paymentStatus === 'undefined';

      if (!ownsBooking || !isCancelAction) {
        throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
      }
    }

    const effectiveStatus = dto.status ?? booking.status;
    const cancellationScope =
      dto.cancellationScope ?? BookingCancellationScope.SINGLE;
    const previousStatus = booking.status;
    if (dto.status) {
      this.validateStatusTransition(booking.status, dto.status);
    }
    if (dto.cancellationScope && dto.status !== BookingStatus.CANCELLED) {
      throw new BadRequestException(
        'Cancellation scope is only allowed when cancelling a booking.'
      );
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
    if (
      cancellationScope === BookingCancellationScope.THIS_AND_FUTURE &&
      (!booking.recurrenceGroupId || dto.status !== BookingStatus.CANCELLED)
    ) {
      throw new BadRequestException(
        'Cancel-all-future is only supported for recurring bookings.'
      );
    }

    if (
      dto.status === BookingStatus.CANCELLED &&
      cancellationScope === BookingCancellationScope.THIS_AND_FUTURE
    ) {
      return this.cancelRecurringSeriesFromInstance(
        booking,
        trimmedReason ?? '',
        resolvedTenantId,
        actorUserId
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
    await this.logAudit({
      tenantId: resolvedTenantId,
      userId: actorUserId,
      action: AuditAction.UPDATE,
      entityType: 'Booking',
      entityId: booking.id,
      description: `Booking status updated: ${booking.id}`,
      changes: {
        before: { status: previousStatus },
        after: {
          status: booking.status,
          paymentStatus: booking.paymentStatus,
          cancellationReason: booking.cancellationReason ?? null,
        },
      },
    });

    this.appLogger.info(
      LOG_EVENTS.BOOKING_STATUS_UPDATED,
      'Booking status updated',
      { bookingId: id, previousStatus, newStatus: booking.status }
    );

    // Send cancellation email (fire-and-forget)
    if (dto.status === BookingStatus.CANCELLED) {
      this.sendCancellationEmail(booking).catch((err) =>
        this.appLogger.error(
          LOG_EVENTS.EMAIL_FAILED,
          'Failed to send cancellation email',
          { bookingId: id },
          err
        )
      );
    }

    return booking;
  }

  private async cancelRecurringSeriesFromInstance(
    sourceBooking: Booking,
    cancellationReason: string,
    tenantId: string,
    actorUserId: string
  ): Promise<Booking> {
    const recurrenceGroupId = sourceBooking.recurrenceGroupId;
    if (!recurrenceGroupId) {
      throw new BadRequestException(
        'Cancel-all-future is only supported for recurring bookings.'
      );
    }

    const affectedBookings = await this.bookingRepository
      .createQueryBuilder('booking')
      .innerJoinAndSelect('booking.facility', 'facility')
      .where('booking.recurrenceGroupId = :recurrenceGroupId', {
        recurrenceGroupId,
      })
      .andWhere('booking.startTime >= :startTime', {
        startTime: sourceBooking.startTime,
      })
      .andWhere('booking.status != :cancelledStatus', {
        cancelledStatus: BookingStatus.CANCELLED,
      })
      .andWhere('facility.tenantId = :tenantId', { tenantId })
      .orderBy('booking.startTime', 'ASC')
      .getMany();

    if (affectedBookings.length === 0) {
      return sourceBooking;
    }

    const paidBooking = affectedBookings.find(
      (booking) =>
        booking.paymentStatus === PaymentStatus.PAID ||
        booking.paymentStatus === PaymentStatus.PARTIALLY_PAID
    );
    if (paidBooking) {
      throw new ConflictException(
        'Paid bookings require a refund flow; payment gateway integration pending.'
      );
    }

    for (const booking of affectedBookings) {
      this.validateStatusTransition(booking.status, BookingStatus.CANCELLED);
      booking.status = BookingStatus.CANCELLED;
      booking.holdUntil = null;
      booking.cancellationReason = cancellationReason;
    }

    const savedBookings = await this.bookingRepository.save(affectedBookings);
    const selectedBooking =
      savedBookings.find((booking) => booking.id === sourceBooking.id) ??
      savedBookings[0];

    await this.logAudit({
      tenantId,
      userId: actorUserId,
      action: AuditAction.UPDATE,
      entityType: 'BookingSeries',
      entityId: recurrenceGroupId,
      description: `Recurring booking series cancelled from instance: ${sourceBooking.id}`,
      changes: {
        before: { affectedCount: savedBookings.length },
        after: {
          status: BookingStatus.CANCELLED,
          cancellationReason,
          cancelledFromBookingId: sourceBooking.id,
          affectedBookingIds: savedBookings.map((booking) => booking.id),
        },
      },
    });

    this.appLogger.info(
      LOG_EVENTS.BOOKING_STATUS_UPDATED,
      'Recurring booking series cancelled from selected instance',
      {
        recurrenceGroupId,
        sourceBookingId: sourceBooking.id,
        affectedCount: savedBookings.length,
      }
    );

    for (const booking of savedBookings) {
      this.sendCancellationEmail(booking).catch((err) =>
        this.appLogger.error(
          LOG_EVENTS.EMAIL_FAILED,
          'Failed to send cancellation email',
          { bookingId: booking.id, recurrenceGroupId },
          err
        )
      );
    }

    return selectedBooking;
  }

  private normalizeRecurrenceRule(
    rawRule: CreateRecurringBookingDto['recurrenceRule']
  ): BookingRecurrenceRuleDto {
    const hasEndsAtDate = Boolean(rawRule.endsAtDate?.trim());
    const hasOccurrences = typeof rawRule.occurrences === 'number';
    if (
      (hasEndsAtDate && hasOccurrences) ||
      (!hasEndsAtDate && !hasOccurrences)
    ) {
      throw new BadRequestException(
        'Provide exactly one recurrence end condition: endsAtDate or occurrences.'
      );
    }

    if (
      (rawRule.frequency === RecurrenceFrequency.WEEKLY &&
        rawRule.intervalWeeks !== 1) ||
      (rawRule.frequency === RecurrenceFrequency.BIWEEKLY &&
        rawRule.intervalWeeks !== 2)
    ) {
      throw new BadRequestException(
        'Recurrence interval does not match selected frequency.'
      );
    }

    return {
      frequency: rawRule.frequency,
      intervalWeeks: rawRule.intervalWeeks,
      endsAtDate: rawRule.endsAtDate?.trim() || undefined,
      occurrences: rawRule.occurrences,
    };
  }

  private generateRecurringOccurrences(
    startTime: Date,
    endTime: Date,
    rule: BookingRecurrenceRuleDto
  ): Array<{ instanceNumber: number; startTime: Date; endTime: Date }> {
    if (startTime >= endTime) {
      throw new BadRequestException('Start time must be before end time.');
    }

    const intervalDays = rule.intervalWeeks * 7;
    const occurrences: Array<{
      instanceNumber: number;
      startTime: Date;
      endTime: Date;
    }> = [];

    if (typeof rule.occurrences === 'number') {
      if (rule.occurrences > MAX_RECURRING_OCCURRENCES) {
        throw new BadRequestException(
          `Recurring bookings are capped at ${MAX_RECURRING_OCCURRENCES} instances.`
        );
      }
      for (let i = 0; i < rule.occurrences; i += 1) {
        const candidateStart = new Date(startTime);
        const candidateEnd = new Date(endTime);
        candidateStart.setDate(candidateStart.getDate() + i * intervalDays);
        candidateEnd.setDate(candidateEnd.getDate() + i * intervalDays);

        occurrences.push({
          instanceNumber: i + 1,
          startTime: candidateStart,
          endTime: candidateEnd,
        });
      }
      return occurrences;
    }

    const endsAtDateRaw = rule.endsAtDate?.trim();
    if (!endsAtDateRaw) {
      throw new BadRequestException(
        'Recurrence end date is required when occurrences are not provided.'
      );
    }

    const endsAtDate = new Date(endsAtDateRaw);
    if (Number.isNaN(endsAtDate.getTime())) {
      throw new BadRequestException('Recurrence end date is invalid.');
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(endsAtDateRaw)) {
      endsAtDate.setHours(23, 59, 59, 999);
    }
    if (endsAtDate < startTime) {
      throw new BadRequestException(
        'Recurrence end date must be on or after the first booking date.'
      );
    }

    let instanceNumber = 1;
    const candidateStart = new Date(startTime);
    const candidateEnd = new Date(endTime);
    while (candidateStart <= endsAtDate) {
      if (instanceNumber > MAX_RECURRING_OCCURRENCES) {
        throw new BadRequestException(
          `Recurring bookings are capped at ${MAX_RECURRING_OCCURRENCES} instances.`
        );
      }

      occurrences.push({
        instanceNumber,
        startTime: new Date(candidateStart),
        endTime: new Date(candidateEnd),
      });
      candidateStart.setDate(candidateStart.getDate() + intervalDays);
      candidateEnd.setDate(candidateEnd.getDate() + intervalDays);
      instanceNumber += 1;
    }

    return occurrences;
  }

  private buildFacilityConfig(facility: Facility): {
    id: string;
    name: string;
    openTime: string;
    closeTime: string;
    slotDurationMinutes: number;
    pricing: {
      basePrice: number;
      currency: string;
    };
  } {
    return {
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
  }

  private toBookingListItemDto(
    booking: Booking,
    facility: Facility
  ): BookingListItemDto {
    return {
      id: booking.id,
      bookingReference: booking.bookingReference,
      facility: {
        id: facility.id,
        name: facility.name,
        config: {
          pricePerHour: Number(facility.config.pricePerHour),
        },
      },
      startTime: booking.startTime.toISOString(),
      endTime: booking.endTime.toISOString(),
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      totalAmount: booking.totalAmount,
      currency: booking.currency,
      priceBreakdown: booking.priceBreakdown,
      holdUntil: booking.holdUntil ? booking.holdUntil.toISOString() : null,
      cancellationReason: booking.cancellationReason ?? null,
      recurrenceGroupId: booking.recurrenceGroupId ?? null,
      recurrenceInstanceNumber: booking.recurrenceInstanceNumber ?? null,
      recurrenceRule: booking.recurrenceRule ?? null,
      status: booking.status,
      paymentStatus: booking.paymentStatus,
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString(),
    };
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

  private requireUserRole(role?: string): UserRole {
    if (
      role === UserRole.OWNER ||
      role === UserRole.MANAGER ||
      role === UserRole.STAFF ||
      role === UserRole.VIEWER
    ) {
      return role;
    }

    throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
  }

  private isStaff(role: UserRole): boolean {
    return role === UserRole.STAFF;
  }

  private isViewer(role: UserRole): boolean {
    return role === UserRole.VIEWER;
  }

  private async validateFacilityOwnership(
    facilityId: string,
    tenantId: string,
    activeOnly = false
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

    if (activeOnly && !facility.isActive) {
      throw new ConflictException(INACTIVE_FACILITY_MESSAGE);
    }

    return facility;
  }

  private resolveCreateStatus(status?: BookingStatus): BookingStatus {
    if (typeof status === 'undefined') {
      return BookingStatus.CONFIRMED;
    }

    if (status !== BookingStatus.PENDING) {
      throw new BadRequestException(
        'Only PENDING status may be provided during booking creation.'
      );
    }

    return status;
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
      this.appLogger.warn(
        LOG_EVENTS.BOOKING_STATUS_INVALID_TRANSITION,
        'Invalid booking status transition',
        { currentStatus, nextStatus }
      );
      throw new BadRequestException('Invalid booking status transition.');
    }
  }

  private async generateUniqueBookingReference(
    bookingRepository: Repository<Booking> = this.bookingRepository
  ): Promise<string> {
    for (let attempt = 0; attempt < BOOKING_REFERENCE_ATTEMPTS; attempt += 1) {
      const candidate = this.buildBookingReference();
      const alreadyExists = await bookingRepository.exists({
        where: { bookingReference: candidate },
      });

      if (!alreadyExists) {
        return candidate;
      }
    }

    throw new ConflictException(
      'Unable to create booking reference. Please retry.'
    );
  }

  private buildBookingReference(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const randomSuffix = randomBytes(3)
      .toString('hex')
      .toUpperCase()
      .slice(0, BOOKING_REFERENCE_RANDOM_LENGTH);
    return `${BOOKING_REFERENCE_PREFIX}-${timestamp}-${randomSuffix}`;
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
        this.appLogger.error(
          LOG_EVENTS.EMAIL_FAILED,
          'Failed to send booking confirmation',
          { bookingId: booking.id },
          err
        );
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
        this.appLogger.error(
          LOG_EVENTS.EMAIL_FAILED,
          'Failed to send new booking alert',
          { bookingId: booking.id },
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
      this.appLogger.error(
        LOG_EVENTS.EMAIL_FAILED,
        'Failed to send cancellation email',
        { bookingId: booking.id },
        err
      );
    }
  }

  private async logAudit(params: {
    tenantId: string;
    userId?: string;
    action: AuditAction;
    entityType: string;
    entityId: string;
    description?: string;
    changes?: Record<string, unknown>;
  }): Promise<void> {
    const auditLog = this.auditLogRepository.create({
      tenantId: params.tenantId,
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      description: params.description,
      changes: params.changes,
    });

    await this.auditLogRepository.save(auditLog);
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
