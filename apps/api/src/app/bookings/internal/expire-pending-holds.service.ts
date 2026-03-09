import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { AuditAction, AuditLog, Booking } from '@khana/data-access';
import { BookingStatus } from '@khana/shared-dtos';
import { Repository } from 'typeorm';
import { AppLoggerService, LOG_EVENTS } from '../../logging';
import { GoalsService } from '../../goals/goals.service';
import { WaitlistService } from '../waitlist/waitlist.service';
import { HOLD_EXPIRED_CANCELLATION_REASON } from './bookings.constants';
import { buildSlotKey } from './bookings-reference.helpers';

@Injectable()
export class ExpirePendingHoldsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly appLogger: AppLoggerService,
    private readonly waitlistService: WaitlistService,
    private readonly goalsService: GoalsService
  ) {}

  async execute(now: Date = new Date()): Promise<number> {
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

      const slotKey = buildSlotKey(
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
}
