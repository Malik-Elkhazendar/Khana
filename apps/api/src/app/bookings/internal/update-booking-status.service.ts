import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuditAction, AuditLog, Booking, User } from '@khana/data-access';
import {
  BookingCancellationReasonKey,
  BookingCancellationScope,
  BookingStatus,
  PaymentStatus,
  parseCancellationReason,
  serializeCancellationReason,
} from '@khana/shared-dtos';
import { addMinutes } from '@khana/shared-utils';
import { EmailService } from '@khana/notifications';
import { Repository } from 'typeorm';
import { AppLoggerService, LOG_EVENTS } from '../../logging';
import { GoalsService } from '../../goals/goals.service';
import { UpdateBookingStatusDto } from '../dto';
import { WaitlistService } from '../waitlist/waitlist.service';
import {
  BOOKINGS_ACCESS_DENIED_MESSAGE,
  BOOKINGS_RESOURCE_NOT_FOUND_MESSAGE,
  PENDING_HOLD_MINUTES,
} from './bookings.constants';
import { buildSlotKey } from './bookings-reference.helpers';
import {
  saveBookingAuditLog,
  sendCancellationEmail,
} from './bookings-side-effects.helpers';
import {
  isStaff,
  isViewer,
  requireTenantId,
  requireUserId,
  requireUserRole,
  validateBookingOwnership,
  validateStatusTransition,
} from './bookings-policy.helpers';

@Injectable()
export class UpdateBookingStatusService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly emailService: EmailService,
    private readonly appLogger: AppLoggerService,
    private readonly waitlistService: WaitlistService,
    private readonly goalsService: GoalsService
  ) {}

  async execute(
    id: string,
    dto: UpdateBookingStatusDto,
    tenantId: string,
    user: User
  ): Promise<Booking> {
    const resolvedTenantId = requireTenantId(
      tenantId,
      BOOKINGS_ACCESS_DENIED_MESSAGE
    );
    const actorRole = requireUserRole(
      user?.role,
      BOOKINGS_ACCESS_DENIED_MESSAGE
    );
    const actorUserId = requireUserId(user?.id, BOOKINGS_ACCESS_DENIED_MESSAGE);

    if (isViewer(actorRole)) {
      throw new ForbiddenException(BOOKINGS_ACCESS_DENIED_MESSAGE);
    }

    const booking = await validateBookingOwnership({
      bookingRepository: this.bookingRepository,
      bookingId: id,
      tenantId: resolvedTenantId,
      resourceNotFoundMessage: BOOKINGS_RESOURCE_NOT_FOUND_MESSAGE,
      accessDeniedMessage: BOOKINGS_ACCESS_DENIED_MESSAGE,
    });

    if (isStaff(actorRole)) {
      const ownsBooking = booking.createdByUserId === actorUserId;
      const isCancelAction =
        dto.status === BookingStatus.CANCELLED &&
        typeof dto.paymentStatus === 'undefined';

      if (!ownsBooking || !isCancelAction) {
        throw new ForbiddenException(BOOKINGS_ACCESS_DENIED_MESSAGE);
      }
    }

    const effectiveStatus = dto.status ?? booking.status;
    const cancellationScope =
      dto.cancellationScope ?? BookingCancellationScope.SINGLE;
    const previousStatus = booking.status;
    if (dto.status) {
      validateStatusTransition(booking.status, dto.status, this.appLogger);
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
    await saveBookingAuditLog({
      auditLogRepository: this.auditLogRepository,
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

    if (dto.status === BookingStatus.CANCELLED) {
      void sendCancellationEmail({
        booking,
        userRepository: this.userRepository,
        emailService: this.emailService,
        appLogger: this.appLogger,
      }).catch((err) =>
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
      validateStatusTransition(
        booking.status,
        BookingStatus.CANCELLED,
        this.appLogger
      );
      booking.status = BookingStatus.CANCELLED;
      booking.holdUntil = null;
      booking.cancellationReason = cancellationReason;
    }

    const savedBookings = await this.bookingRepository.save(affectedBookings);
    const selectedBooking =
      savedBookings.find((booking) => booking.id === sourceBooking.id) ??
      savedBookings[0];

    await saveBookingAuditLog({
      auditLogRepository: this.auditLogRepository,
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
      void sendCancellationEmail({
        booking,
        userRepository: this.userRepository,
        emailService: this.emailService,
        appLogger: this.appLogger,
      }).catch((err) =>
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
      const slotKey = buildSlotKey(
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
}
