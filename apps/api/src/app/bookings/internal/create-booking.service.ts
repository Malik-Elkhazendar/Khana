import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { detectConflicts, calculatePrice } from '@khana/booking-engine';
import {
  Booking,
  Facility,
  PromoCode,
  PromoCodeRedemption,
  User,
} from '@khana/data-access';
import { BookingStatus, PaymentStatus } from '@khana/shared-dtos';
import { addMinutes } from '@khana/shared-utils';
import { Repository } from 'typeorm';
import { EmailService } from '@khana/notifications';
import { AppLoggerService, LOG_EVENTS } from '../../logging';
import { GoalsService } from '../../goals/goals.service';
import { CustomersService } from '../../customers/customers.service';
import { CreateBookingDto } from '../dto';
import { WaitlistService } from '../waitlist/waitlist.service';
import {
  BOOKINGS_ACCESS_DENIED_MESSAGE,
  BOOKINGS_INACTIVE_FACILITY_MESSAGE,
  BOOKINGS_RESOURCE_NOT_FOUND_MESSAGE,
  PENDING_HOLD_MINUTES,
} from './bookings.constants';
import { BookingWriteSupportService } from './booking-write-support.service';
import {
  applyPromoToPriceBreakdown,
  normalizeCustomerPhone,
  normalizePromoCode,
} from './bookings-promo.helpers';
import {
  isViewer,
  requireTenantId,
  requireUserId,
  requireUserRole,
  resolveCreateStatus,
  validateFacilityOwnership,
} from './bookings-policy.helpers';
import { generateUniqueBookingReference } from './bookings-reference.helpers';
import { sendBookingCreatedEmails } from './bookings-side-effects.helpers';

/**
 * Creates one tenant-scoped booking, keeping locking, promo persistence, and
 * downstream side effects aligned with the booking domain rules.
 */
@Injectable()
export class CreateBookingService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Facility)
    private readonly facilityRepository: Repository<Facility>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly emailService: EmailService,
    private readonly appLogger: AppLoggerService,
    private readonly waitlistService: WaitlistService,
    private readonly goalsService: GoalsService,
    private readonly customersService: CustomersService,
    private readonly bookingWriteSupport: BookingWriteSupportService
  ) {}

  async execute(
    dto: CreateBookingDto,
    tenantId: string,
    userId: string,
    userRole: string
  ): Promise<Booking> {
    const resolvedTenantId = requireTenantId(
      tenantId,
      BOOKINGS_ACCESS_DENIED_MESSAGE
    );
    const resolvedUserId = requireUserId(
      userId,
      BOOKINGS_ACCESS_DENIED_MESSAGE
    );
    const actorRole = requireUserRole(userRole, BOOKINGS_ACCESS_DENIED_MESSAGE);
    const normalizedPromoCode = normalizePromoCode(dto.promoCode);
    const normalizedCustomerPhone =
      normalizeCustomerPhone(dto.customerPhone) ?? dto.customerPhone.trim();

    if (isViewer(actorRole)) {
      throw new ForbiddenException(BOOKINGS_ACCESS_DENIED_MESSAGE);
    }

    const facility = await validateFacilityOwnership({
      facilityRepository: this.facilityRepository,
      facilityId: dto.facilityId,
      tenantId: resolvedTenantId,
      resourceNotFoundMessage: BOOKINGS_RESOURCE_NOT_FOUND_MESSAGE,
      accessDeniedMessage: BOOKINGS_ACCESS_DENIED_MESSAGE,
      inactiveFacilityMessage: BOOKINGS_INACTIVE_FACILITY_MESSAGE,
      activeOnly: true,
    });

    const saved = await this.bookingRepository.manager.transaction(
      async (manager) => {
        const bookingRepo = manager.getRepository(Booking);
        const promoCodeRepo = manager.getRepository(PromoCode);
        const promoCodeRedemptionRepo =
          manager.getRepository(PromoCodeRedemption);
        const now = new Date();
        const startTime = new Date(dto.startTime);
        const endTime = new Date(dto.endTime);
        // Lock the facility context before validation and conflict detection so
        // overlapping create requests cannot both claim the same slot.
        const { facilityConfig, occupiedSlots } =
          await this.bookingWriteSupport.loadLockedFacilityContext({
            manager,
            facilityId: facility.id,
            tenantId: resolvedTenantId,
            now,
          });

        const validationErrors = this.bookingWriteSupport.getValidationErrors({
          facilityId: dto.facilityId,
          startTime,
          endTime,
          facilityConfig,
        });
        if (validationErrors.length > 0) {
          this.bookingWriteSupport.throwValidationError(validationErrors);
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

        const promoResolution =
          await this.bookingWriteSupport.resolvePromoForCreate({
            promoCodeRepository: promoCodeRepo,
            tenantId: resolvedTenantId,
            facilityId: dto.facilityId,
            promoCode: normalizedPromoCode,
            now,
          });
        if (promoResolution?.promoCode) {
          priceBreakdown = applyPromoToPriceBreakdown(
            priceBreakdown,
            promoResolution.promoCode.code,
            promoResolution.promoCode.discountType,
            Number(promoResolution.promoCode.discountValue)
          );
        }

        const bookingReference = await generateUniqueBookingReference(
          bookingRepo
        );
        const status = resolveCreateStatus(dto.status);
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

        await this.bookingWriteSupport.persistPromoRedemption({
          promoCodeRepository: promoCodeRepo,
          promoCodeRedemptionRepository: promoCodeRedemptionRepo,
          tenantId: resolvedTenantId,
          userId: resolvedUserId,
          bookingId: savedBooking.id,
          priceBreakdown,
          promoResolution,
        });

        return savedBooking;
      }
    );

    // These follow-up updates are best-effort side effects after the booking
    // commit succeeds; they must not roll back the main write path.
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

    void sendBookingCreatedEmails({
      booking: saved,
      facility,
      userId: resolvedUserId,
      userRepository: this.userRepository,
      emailService: this.emailService,
      appLogger: this.appLogger,
    }).catch((err) =>
      this.appLogger.error(
        LOG_EVENTS.EMAIL_FAILED,
        'Failed to send booking creation emails',
        { bookingId: saved.id },
        err
      )
    );

    return saved;
  }
}
