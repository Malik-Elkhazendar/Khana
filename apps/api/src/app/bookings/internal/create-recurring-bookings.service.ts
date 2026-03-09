import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { calculatePrice, detectConflicts } from '@khana/booking-engine';
import { AuditAction, AuditLog, Booking, Facility } from '@khana/data-access';
import {
  BookingStatus,
  CreateRecurringBookingResponseDto,
  PaymentStatus,
  SlotStatus,
} from '@khana/shared-dtos';
import { addMinutes } from '@khana/shared-utils';
import { Repository } from 'typeorm';
import { AppLoggerService, LOG_EVENTS } from '../../logging';
import { CustomersService } from '../../customers/customers.service';
import { CreateRecurringBookingDto } from '../dto';
import {
  BOOKINGS_ACCESS_DENIED_MESSAGE,
  BOOKINGS_INACTIVE_FACILITY_MESSAGE,
  BOOKINGS_RESOURCE_NOT_FOUND_MESSAGE,
  PENDING_HOLD_MINUTES,
} from './bookings.constants';
import { BookingWriteSupportService } from './booking-write-support.service';
import { toBookingListItemDto } from './bookings-mapper.helpers';
import {
  generateRecurringOccurrences,
  normalizeRecurrenceRule,
} from './bookings-recurrence.helpers';
import { generateUniqueBookingReference } from './bookings-reference.helpers';
import { saveBookingAuditLog } from './bookings-side-effects.helpers';
import {
  isViewer,
  requireTenantId,
  requireUserId,
  requireUserRole,
  resolveCreateStatus,
  validateFacilityOwnership,
} from './bookings-policy.helpers';
import { normalizeCustomerPhone } from './bookings-promo.helpers';

@Injectable()
export class CreateRecurringBookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Facility)
    private readonly facilityRepository: Repository<Facility>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly appLogger: AppLoggerService,
    private readonly customersService: CustomersService,
    private readonly bookingWriteSupport: BookingWriteSupportService
  ) {}

  async execute(
    dto: CreateRecurringBookingDto,
    tenantId: string,
    userId: string,
    userRole: string
  ): Promise<CreateRecurringBookingResponseDto> {
    const resolvedTenantId = requireTenantId(
      tenantId,
      BOOKINGS_ACCESS_DENIED_MESSAGE
    );
    const resolvedUserId = requireUserId(
      userId,
      BOOKINGS_ACCESS_DENIED_MESSAGE
    );
    const actorRole = requireUserRole(userRole, BOOKINGS_ACCESS_DENIED_MESSAGE);
    const normalizedCustomerPhone =
      normalizeCustomerPhone(dto.customerPhone) ?? dto.customerPhone.trim();

    if (isViewer(actorRole)) {
      throw new ForbiddenException(BOOKINGS_ACCESS_DENIED_MESSAGE);
    }

    await validateFacilityOwnership({
      facilityRepository: this.facilityRepository,
      facilityId: dto.facilityId,
      tenantId: resolvedTenantId,
      resourceNotFoundMessage: BOOKINGS_RESOURCE_NOT_FOUND_MESSAGE,
      accessDeniedMessage: BOOKINGS_ACCESS_DENIED_MESSAGE,
      inactiveFacilityMessage: BOOKINGS_INACTIVE_FACILITY_MESSAGE,
      activeOnly: true,
    });

    const recurrenceRule = normalizeRecurrenceRule(dto.recurrenceRule);
    const baseStartTime = new Date(dto.startTime);
    const baseEndTime = new Date(dto.endTime);
    const occurrences = generateRecurringOccurrences(
      baseStartTime,
      baseEndTime,
      recurrenceRule
    );

    const now = new Date();
    const firstOccurrence = occurrences[0];
    const lastOccurrence = occurrences[occurrences.length - 1];
    const created = await this.bookingRepository.manager.transaction(
      async (manager) => {
        const bookingRepo = manager.getRepository(Booking);
        const { lockedFacility, facilityConfig, occupiedSlots } =
          await this.bookingWriteSupport.loadLockedFacilityContext({
            manager,
            facilityId: dto.facilityId,
            tenantId: resolvedTenantId,
            now,
            windowStart: firstOccurrence?.startTime,
            windowEnd: lastOccurrence?.endTime,
          });
        const dynamicOccupiedSlots = [...occupiedSlots];
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
          const occurrenceValidationErrors =
            this.bookingWriteSupport.getValidationErrors({
              facilityId: dto.facilityId,
              startTime: occurrence.startTime,
              endTime: occurrence.endTime,
              facilityConfig,
            });

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

        const status = resolveCreateStatus(dto.status);
        const recurrenceGroupId = randomUUID();
        const toPersist: Booking[] = [];

        for (const occurrence of occurrences) {
          const bookingReference = await generateUniqueBookingReference(
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
            toBookingListItemDto(booking, lockedFacility)
          ),
        };
      }
    );

    await saveBookingAuditLog({
      auditLogRepository: this.auditLogRepository,
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
}
