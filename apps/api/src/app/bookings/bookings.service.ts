import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
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
  Customer,
  Facility,
  PromoCode,
  PromoCodeRedemption,
  User,
} from '@khana/data-access';
import {
  BookingCancellationScope,
  BookingCancellationReasonKey,
  BookingListItemDto,
  BookingRecurrenceRuleDto,
  CreateRecurringBookingResponseDto,
  BookingStatus,
  PaymentStatus,
  PriceBreakdown,
  PromoDiscountType,
  PromoValidationDto,
  SlotStatus,
  UserRole,
  parseCancellationReason,
  serializeCancellationReason,
} from '@khana/shared-dtos';
import { addMinutes } from '@khana/shared-utils';
import { EmailService } from '@khana/notifications';
import { AppLoggerService, LOG_EVENTS } from '../logging';
import { GoalsService } from '../goals/goals.service';
import { CustomersService } from '../customers/customers.service';
import {
  BookingPreviewRequestDto,
  BookingPreviewResponseDto,
  CreateBookingDto,
  CreateRecurringBookingDto,
  UpdateBookingStatusDto,
} from './dto';
import { WaitlistService } from './waitlist/waitlist.service';
import {
  buildFacilityConfig,
  toBookingListItemDto,
  transformToResponseDto,
} from './internal/bookings-mapper.helpers';
import {
  isStaff,
  isViewer,
  requireTenantId,
  requireUserId,
  requireUserRole,
  resolveCreateStatus,
  validateBookingOwnership,
  validateFacilityOwnership,
  validateStatusTransition,
} from './internal/bookings-policy.helpers';
import {
  applyPromoToPriceBreakdown,
  normalizeCustomerPhone,
  normalizePromoCode,
  PromoValidationResult,
  resolvePromoForCreate,
  resolvePromoForPreview,
} from './internal/bookings-promo.helpers';
import {
  generateRecurringOccurrences,
  normalizeRecurrenceRule,
} from './internal/bookings-recurrence.helpers';
import {
  buildSlotKey,
  generateUniqueBookingReference,
} from './internal/bookings-reference.helpers';
import {
  saveBookingAuditLog,
  sendBookingCreatedEmails,
  sendCancellationEmail,
} from './internal/bookings-side-effects.helpers';

const PENDING_HOLD_MINUTES = 15;
const HOLD_EXPIRED_CANCELLATION_NOTE = 'Hold expired automatically';
const HOLD_EXPIRED_CANCELLATION_REASON = serializeCancellationReason(
  BookingCancellationReasonKey.OTHER,
  HOLD_EXPIRED_CANCELLATION_NOTE
);
const ACCESS_DENIED_MESSAGE =
  'Access denied: You do not have permission to access this resource.';
const RESOURCE_NOT_FOUND_MESSAGE = 'Resource not found';
const INACTIVE_FACILITY_MESSAGE =
  'This facility is currently inactive and cannot be booked.';
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
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    @InjectRepository(Facility)
    private readonly facilityRepository: Repository<Facility>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(PromoCode)
    private readonly promoCodeRepository: Repository<PromoCode>,
    @InjectRepository(PromoCodeRedemption)
    private readonly promoCodeRedemptionRepository: Repository<PromoCodeRedemption>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly emailService: EmailService,
    private readonly appLogger: AppLoggerService,
    private readonly waitlistService: WaitlistService,
    private readonly goalsService: GoalsService,
    private readonly customersService: CustomersService
  ) {}

  async findAll(
    tenantId: string,
    user: User,
    facilityId?: string
  ): Promise<BookingListItemDto[]> {
    const resolvedTenantId = this.requireTenantId(tenantId);
    const actorRole = this.requireUserRole(user?.role);
    const actorUserId = this.requireUserId(user?.id);

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

    const bookings = await query.getMany();

    const normalizedPhones = Array.from(
      new Set(
        bookings
          .map((booking) => this.normalizeCustomerPhone(booking.customerPhone))
          .filter((phone): phone is string => Boolean(phone))
      )
    );

    const customerTagMap = new Map<string, string[]>();
    if (normalizedPhones.length > 0) {
      const customers = await this.customerRepository.find({
        select: ['phone', 'tags'],
        where: {
          tenantId: resolvedTenantId,
          phone: In(normalizedPhones),
        },
      });

      for (const customer of customers) {
        customerTagMap.set(customer.phone, customer.tags ?? []);
      }
    }

    return bookings.map((booking) => {
      const normalizedPhone = this.normalizeCustomerPhone(
        booking.customerPhone
      );
      const customerTags =
        normalizedPhone && customerTagMap.has(normalizedPhone)
          ? customerTagMap.get(normalizedPhone) ?? []
          : [];
      return this.toBookingListItemDto(booking, booking.facility, customerTags);
    });
  }

  async findOne(
    tenantId: string,
    user: User,
    bookingId: string
  ): Promise<BookingListItemDto> {
    const resolvedTenantId = this.requireTenantId(tenantId);
    const actorRole = this.requireUserRole(user?.role);
    const actorUserId = this.requireUserId(user?.id);

    const booking = await this.validateBookingOwnership(
      bookingId,
      resolvedTenantId
    );

    if (this.isStaff(actorRole) && booking.createdByUserId !== actorUserId) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }

    const normalizedPhone = this.normalizeCustomerPhone(booking.customerPhone);
    let customerTags: string[] = [];

    if (normalizedPhone) {
      const customer = await this.customerRepository.findOne({
        select: ['id', 'tags'],
        where: {
          tenantId: resolvedTenantId,
          phone: normalizedPhone,
        },
      });
      customerTags = customer?.tags ?? [];
    }

    return this.toBookingListItemDto(booking, booking.facility, customerTags);
  }

  async expirePendingHolds(now: Date = new Date()): Promise<number> {
    const expiredBookings = await this.bookingRepository.manager.transaction(
      async (manager) => {
        const bookingRepo = manager.getRepository(Booking);
        const auditRepo = manager.getRepository(AuditLog);

        const candidates = await bookingRepo
          .createQueryBuilder('booking')
          .innerJoinAndSelect('booking.facility', 'facility')
          .innerJoinAndSelect('facility.tenant', 'tenant')
          .where('booking.status = :pendingStatus', {
            pendingStatus: BookingStatus.PENDING,
          })
          .andWhere('booking.holdUntil IS NOT NULL')
          .andWhere('booking.holdUntil <= :now', { now })
          .orderBy('booking.holdUntil', 'ASC')
          .addOrderBy('booking.id', 'ASC')
          .setLock('pessimistic_write')
          .getMany();

        if (candidates.length === 0) {
          return [] as Array<{
            bookingId: string;
            tenantId: string;
            facilityId: string;
            startTime: Date;
            endTime: Date;
            holdUntil: string | null;
          }>;
        }

        const expiredHoldMetadata = candidates.map((booking) => ({
          bookingId: booking.id,
          tenantId: booking.facility.tenant.id,
          facilityId: booking.facility.id,
          startTime: booking.startTime,
          endTime: booking.endTime,
          holdUntil: booking.holdUntil?.toISOString() ?? null,
        }));

        for (const booking of candidates) {
          booking.status = BookingStatus.CANCELLED;
          booking.holdUntil = null;
          booking.cancellationReason = HOLD_EXPIRED_CANCELLATION_REASON;
        }

        await bookingRepo.save(candidates);
        await auditRepo.save(
          expiredHoldMetadata.map((booking) =>
            auditRepo.create({
              tenantId: booking.tenantId,
              action: AuditAction.UPDATE,
              entityType: 'Booking',
              entityId: booking.bookingId,
              description: `Booking hold expired automatically: ${booking.bookingId}`,
              changes: {
                before: {
                  status: BookingStatus.PENDING,
                  holdUntil: booking.holdUntil,
                },
                after: {
                  status: BookingStatus.CANCELLED,
                  holdUntil: null,
                  cancellationReason: HOLD_EXPIRED_CANCELLATION_REASON,
                },
              },
            })
          )
        );

        return expiredHoldMetadata;
      }
    );

    if (expiredBookings.length === 0) {
      return 0;
    }

    const notifiedSlots = new Set<string>();
    const affectedTenants = new Set<string>();

    for (const booking of expiredBookings) {
      affectedTenants.add(booking.tenantId);
      this.appLogger.info(
        LOG_EVENTS.BOOKING_HOLD_EXPIRED,
        'Expired pending booking hold',
        {
          bookingId: booking.bookingId,
          tenantId: booking.tenantId,
          facilityId: booking.facilityId,
          holdUntil: booking.holdUntil,
        }
      );

      const slotKey = this.buildSlotKey(
        booking.facilityId,
        booking.startTime,
        booking.endTime
      );
      if (notifiedSlots.has(slotKey)) {
        continue;
      }

      notifiedSlots.add(slotKey);

      this.waitlistService
        .notifyFirstForSlot({
          tenantId: booking.tenantId,
          facilityId: booking.facilityId,
          desiredStartTime: booking.startTime,
          desiredEndTime: booking.endTime,
          cancelledBookingId: booking.bookingId,
        })
        .then((result) => {
          if (!result.notified) {
            return;
          }

          this.appLogger.info(
            LOG_EVENTS.BOOKING_HOLD_WAITLIST_NOTIFIED,
            'Waitlist notified after expired booking hold',
            {
              bookingId: booking.bookingId,
              tenantId: booking.tenantId,
              facilityId: booking.facilityId,
              entryId: result.entryId,
            }
          );
        })
        .catch((error) => {
          this.appLogger.error(
            LOG_EVENTS.WAITLIST_NOTIFY_FAILED,
            'Failed to notify waitlist after booking hold expiry',
            {
              bookingId: booking.bookingId,
              tenantId: booking.tenantId,
              facilityId: booking.facilityId,
            },
            error
          );
        });
    }

    for (const tenantId of affectedTenants) {
      this.goalsService
        .syncMilestonesForCurrentMonth(tenantId)
        .catch((error) =>
          this.appLogger.error(
            LOG_EVENTS.GOALS_MILESTONE_SYNC_FAILED,
            'Failed to sync goal milestones after booking hold expiry',
            { tenantId },
            error
          )
        );
    }

    return expiredBookings.length;
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

    const normalizedPromoCode = this.normalizePromoCode(dto.promoCode);

    // Call domain logic (base preview without promo)
    const result: BookingPreviewResult = previewBooking(
      {
        facilityId: dto.facilityId,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
      },
      facilityConfig,
      occupiedSlots
    );

    const promoValidation = await this.resolvePromoForPreview({
      tenantId: resolvedTenantId,
      facilityId: dto.facilityId,
      promoCode: normalizedPromoCode,
      now,
    });

    if (promoValidation?.validation.isValid && promoValidation.promoCode) {
      result.priceBreakdown = this.applyPromoToPriceBreakdown(
        result.priceBreakdown,
        promoValidation.promoCode.code,
        promoValidation.promoCode.discountType,
        Number(promoValidation.promoCode.discountValue)
      );
      promoValidation.validation.discountAmount =
        result.priceBreakdown.promoDiscount ?? 0;
    }

    // Transform to response DTO (convert dates to ISO strings for JSON)
    return this.transformToResponseDto(result, promoValidation?.validation);
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
    const normalizedPromoCode = this.normalizePromoCode(dto.promoCode);
    const normalizedCustomerPhone =
      this.normalizeCustomerPhone(dto.customerPhone) ??
      dto.customerPhone.trim();

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
        const promoCodeRepo = manager.getRepository(PromoCode);
        const promoCodeRedemptionRepo =
          manager.getRepository(PromoCodeRedemption);

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

        let priceBreakdown = calculatePrice({
          startTime,
          endTime,
          pricingConfig: facilityConfig.pricing,
        });

        const promoResolution = await this.resolvePromoForCreate({
          promoCodeRepository: promoCodeRepo,
          tenantId: resolvedTenantId,
          facilityId: dto.facilityId,
          promoCode: normalizedPromoCode,
          now,
        });
        if (promoResolution?.promoCode) {
          const promo = promoResolution.promoCode;
          priceBreakdown = this.applyPromoToPriceBreakdown(
            priceBreakdown,
            promo.code,
            promo.discountType,
            Number(promo.discountValue)
          );
        }

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
          customerPhone: normalizedCustomerPhone,
          status,
          paymentStatus: PaymentStatus.PENDING,
          bookingReference,
          totalAmount: priceBreakdown.total,
          currency: priceBreakdown.currency,
          priceBreakdown,
          holdUntil,
        });

        const savedBooking = await bookingRepo.save(booking);

        if (promoResolution?.promoCode) {
          promoResolution.promoCode.currentUses =
            Number(promoResolution.promoCode.currentUses) + 1;
          await promoCodeRepo.save(promoResolution.promoCode);

          await promoCodeRedemptionRepo.save(
            promoCodeRedemptionRepo.create({
              tenantId: resolvedTenantId,
              promoCodeId: promoResolution.promoCode.id,
              bookingId: savedBooking.id,
              redeemedByUserId: resolvedUserId,
              discountAmount: priceBreakdown.promoDiscount ?? 0,
              codeSnapshot: promoResolution.promoCode.code,
              discountTypeSnapshot: promoResolution.promoCode.discountType,
              discountValueSnapshot: Number(
                promoResolution.promoCode.discountValue
              ),
            })
          );
        }

        return savedBooking;
      }
    );

    this.waitlistService
      .markFulfilledForUserSlot({
        tenantId: resolvedTenantId,
        userId: resolvedUserId,
        facilityId: saved.facility.id,
        desiredStartTime: saved.startTime,
        desiredEndTime: saved.endTime,
        bookingId: saved.id,
        actorUserId: resolvedUserId,
      })
      .catch((err) =>
        this.appLogger.error(
          LOG_EVENTS.WAITLIST_FULFILL_FAILED,
          'Failed to mark waitlist entry as fulfilled after booking creation',
          {
            bookingId: saved.id,
            facilityId: saved.facility?.id,
            userId: resolvedUserId,
          },
          err
        )
      );

    this.goalsService
      .syncMilestonesForCurrentMonth(resolvedTenantId)
      .catch((err) =>
        this.appLogger.error(
          LOG_EVENTS.GOALS_MILESTONE_SYNC_FAILED,
          'Failed to sync goal milestones after booking creation',
          {
            tenantId: resolvedTenantId,
            bookingId: saved.id,
          },
          err
        )
      );

    try {
      await this.customersService.upsert(
        resolvedTenantId,
        saved.customerName,
        saved.customerPhone
      );
    } catch (err) {
      this.appLogger.error(
        LOG_EVENTS.CUSTOMER_UPSERT_FAILED,
        'Failed to upsert customer after booking creation',
        {
          tenantId: resolvedTenantId,
          bookingId: saved.id,
        },
        err
      );
    }

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
    const normalizedCustomerPhone =
      this.normalizeCustomerPhone(dto.customerPhone) ??
      dto.customerPhone.trim();

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
              customerPhone: normalizedCustomerPhone,
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

    try {
      await this.customersService.upsert(
        resolvedTenantId,
        dto.customerName,
        normalizedCustomerPhone
      );
    } catch (err) {
      this.appLogger.error(
        LOG_EVENTS.CUSTOMER_UPSERT_FAILED,
        'Failed to upsert customer after recurring booking creation',
        {
          tenantId: resolvedTenantId,
          recurrenceGroupId: created.recurrenceGroupId,
        },
        err
      );
    }

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
    let normalizedCancellationReason: string | null = null;
    if (effectiveStatus === BookingStatus.CANCELLED) {
      const parsed = parseCancellationReason(trimmedReason);
      if (!parsed.isValid || !parsed.key) {
        throw new BadRequestException(
          'Cancellation reason must use a supported reason key.'
        );
      }
      if (parsed.note && parsed.key !== BookingCancellationReasonKey.OTHER) {
        throw new BadRequestException(
          'Cancellation note is only allowed with "other" reason.'
        );
      }
      normalizedCancellationReason = serializeCancellationReason(
        parsed.key,
        parsed.note
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
        normalizedCancellationReason ?? '',
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
        normalizedCancellationReason ?? booking.cancellationReason ?? null;
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
      this.waitlistService
        .notifyFirstForSlot({
          tenantId: resolvedTenantId,
          facilityId: booking.facility.id,
          desiredStartTime: booking.startTime,
          desiredEndTime: booking.endTime,
          cancelledBookingId: booking.id,
          actorUserId,
        })
        .catch((err) =>
          this.appLogger.error(
            LOG_EVENTS.WAITLIST_NOTIFY_FAILED,
            'Failed to notify waitlist after booking cancellation',
            {
              bookingId: booking.id,
              facilityId: booking.facility.id,
            },
            err
          )
        );
    }

    this.goalsService
      .syncMilestonesForCurrentMonth(resolvedTenantId)
      .catch((err) =>
        this.appLogger.error(
          LOG_EVENTS.GOALS_MILESTONE_SYNC_FAILED,
          'Failed to sync goal milestones after booking status update',
          {
            tenantId: resolvedTenantId,
            bookingId: booking.id,
          },
          err
        )
      );

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

    const processedSlots = new Set<string>();
    for (const booking of savedBookings) {
      const slotKey = this.buildSlotKey(
        booking.facility.id,
        booking.startTime,
        booking.endTime
      );
      if (processedSlots.has(slotKey)) {
        continue;
      }
      processedSlots.add(slotKey);

      this.waitlistService
        .notifyFirstForSlot({
          tenantId,
          facilityId: booking.facility.id,
          desiredStartTime: booking.startTime,
          desiredEndTime: booking.endTime,
          cancelledBookingId: booking.id,
          actorUserId,
        })
        .catch((err) =>
          this.appLogger.error(
            LOG_EVENTS.WAITLIST_NOTIFY_FAILED,
            'Failed to notify waitlist for recurring cancellation slot',
            {
              bookingId: booking.id,
              facilityId: booking.facility.id,
              recurrenceGroupId,
            },
            err
          )
        );
    }

    this.goalsService.syncMilestonesForCurrentMonth(tenantId).catch((err) =>
      this.appLogger.error(
        LOG_EVENTS.GOALS_MILESTONE_SYNC_FAILED,
        'Failed to sync goal milestones after recurring cancellation',
        {
          tenantId,
          recurrenceGroupId,
        },
        err
      )
    );

    return selectedBooking;
  }

  private normalizeRecurrenceRule(
    rawRule: CreateRecurringBookingDto['recurrenceRule']
  ): BookingRecurrenceRuleDto {
    return normalizeRecurrenceRule(rawRule);
  }

  private generateRecurringOccurrences(
    startTime: Date,
    endTime: Date,
    rule: BookingRecurrenceRuleDto
  ): Array<{ instanceNumber: number; startTime: Date; endTime: Date }> {
    return generateRecurringOccurrences(startTime, endTime, rule);
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
    return buildFacilityConfig(facility);
  }

  private toBookingListItemDto(
    booking: Booking,
    facility: Facility,
    customerTags: string[] = []
  ): BookingListItemDto {
    return toBookingListItemDto(booking, facility, customerTags);
  }

  private requireTenantId(tenantId?: string): string {
    return requireTenantId(tenantId, ACCESS_DENIED_MESSAGE);
  }

  private requireUserId(userId?: string): string {
    return requireUserId(userId, ACCESS_DENIED_MESSAGE);
  }

  private requireUserRole(role?: string): UserRole {
    return requireUserRole(role, ACCESS_DENIED_MESSAGE);
  }

  private isStaff(role: UserRole): boolean {
    return isStaff(role);
  }

  private isViewer(role: UserRole): boolean {
    return isViewer(role);
  }

  private async validateFacilityOwnership(
    facilityId: string,
    tenantId: string,
    activeOnly = false
  ): Promise<Facility> {
    return validateFacilityOwnership({
      facilityRepository: this.facilityRepository,
      facilityId,
      tenantId,
      resourceNotFoundMessage: RESOURCE_NOT_FOUND_MESSAGE,
      accessDeniedMessage: ACCESS_DENIED_MESSAGE,
      inactiveFacilityMessage: INACTIVE_FACILITY_MESSAGE,
      activeOnly,
    });
  }

  private resolveCreateStatus(status?: BookingStatus): BookingStatus {
    return resolveCreateStatus(status);
  }

  private async validateBookingOwnership(
    bookingId: string,
    tenantId: string
  ): Promise<Booking> {
    return validateBookingOwnership({
      bookingRepository: this.bookingRepository,
      bookingId,
      tenantId,
      resourceNotFoundMessage: RESOURCE_NOT_FOUND_MESSAGE,
      accessDeniedMessage: ACCESS_DENIED_MESSAGE,
    });
  }

  private validateStatusTransition(
    currentStatus: BookingStatus,
    nextStatus: BookingStatus
  ): void {
    return validateStatusTransition(currentStatus, nextStatus, this.appLogger);
  }

  private async generateUniqueBookingReference(
    bookingRepository: Repository<Booking> = this.bookingRepository
  ): Promise<string> {
    return generateUniqueBookingReference(bookingRepository);
  }

  private buildSlotKey(
    facilityId: string,
    startTime: Date,
    endTime: Date
  ): string {
    return buildSlotKey(facilityId, startTime, endTime);
  }

  private normalizePromoCode(promoCode?: string | null): string | undefined {
    return normalizePromoCode(promoCode);
  }

  private normalizeCustomerPhone(phone?: string | null): string | null {
    return normalizeCustomerPhone(phone);
  }

  private async resolvePromoForPreview(params: {
    tenantId: string;
    facilityId: string;
    promoCode?: string;
    now: Date;
  }): Promise<PromoValidationResult | undefined> {
    return resolvePromoForPreview({
      promoCodeRepository: this.promoCodeRepository,
      ...params,
    });
  }

  private async resolvePromoForCreate(params: {
    promoCodeRepository: Repository<PromoCode>;
    tenantId: string;
    facilityId: string;
    promoCode?: string;
    now: Date;
  }): Promise<PromoValidationResult | undefined> {
    return resolvePromoForCreate(params);
  }

  private applyPromoToPriceBreakdown(
    baseBreakdown: PriceBreakdown,
    promoCode: string,
    discountType: PromoDiscountType,
    discountValue: number
  ): PriceBreakdown {
    return applyPromoToPriceBreakdown(
      baseBreakdown,
      promoCode,
      discountType,
      discountValue
    );
  }

  /**
   * Send booking confirmation + manager alert after booking creation.
   */
  private async sendBookingCreatedEmails(
    booking: Booking,
    facility: Facility,
    userId: string
  ): Promise<void> {
    return sendBookingCreatedEmails({
      booking,
      facility,
      userId,
      userRepository: this.userRepository,
      emailService: this.emailService,
      appLogger: this.appLogger,
    });
  }

  /**
   * Send cancellation notification email.
   */
  private async sendCancellationEmail(booking: Booking): Promise<void> {
    return sendCancellationEmail({
      booking,
      userRepository: this.userRepository,
      emailService: this.emailService,
      appLogger: this.appLogger,
    });
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
    return saveBookingAuditLog({
      auditLogRepository: this.auditLogRepository,
      ...params,
    });
  }

  /**
   * Transform domain result to API response DTO
   */
  private transformToResponseDto(
    result: BookingPreviewResult,
    promoValidation?: PromoValidationDto
  ): BookingPreviewResponseDto {
    return transformToResponseDto(result, promoValidation);
  }
}
