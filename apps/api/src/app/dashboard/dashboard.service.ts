import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Booking, WaitingListEntry } from '@khana/data-access';
import {
  BookingStatus,
  PaymentStatus,
  TodaySnapshotDto,
  WaitlistStatus,
} from '@khana/shared-dtos';
import { Repository, SelectQueryBuilder } from 'typeorm';

const HOLD_WINDOW_MINUTES = 30;
const ACTIVE_BOOKING_STATUSES: readonly BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
  BookingStatus.NO_SHOW,
];

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(WaitingListEntry)
    private readonly waitlistRepository: Repository<WaitingListEntry>
  ) {}

  async getTodaySnapshot(
    tenantId: string,
    facilityId?: string
  ): Promise<TodaySnapshotDto> {
    const now = new Date();
    const dayStartUtc = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0,
        0,
        0,
        0
      )
    );
    const dayEndUtc = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        23,
        59,
        59,
        999
      )
    );
    const holdWindowEnd = new Date(
      now.getTime() + HOLD_WINDOW_MINUTES * 60_000
    );

    const [
      bookingsTodayRaw,
      revenueTodayRaw,
      unpaidCountRaw,
      unpaidAmountRaw,
      expiringHoldsRaw,
      waitlistTodayRaw,
      notifiedWaitlistRaw,
      noShowCountRaw,
    ] = await Promise.all([
      this.createBookingCountQuery(tenantId, dayStartUtc, dayEndUtc, facilityId)
        .andWhere('booking.status IN (:...activeStatuses)', {
          activeStatuses: ACTIVE_BOOKING_STATUSES,
        })
        .getRawOne<{ count: string }>(),

      this.createBookingBaseQuery(tenantId, facilityId)
        .select('COALESCE(SUM(booking.totalAmount), 0)', 'sum')
        .andWhere('booking.startTime BETWEEN :dayStartUtc AND :dayEndUtc', {
          dayStartUtc,
          dayEndUtc,
        })
        .andWhere('booking.status IN (:...revenueStatuses)', {
          revenueStatuses: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED],
        })
        .getRawOne<{ sum: string | null }>(),

      this.createBookingCountQuery(tenantId, dayStartUtc, dayEndUtc, facilityId)
        .andWhere('booking.status = :confirmedStatus', {
          confirmedStatus: BookingStatus.CONFIRMED,
        })
        .andWhere('booking.paymentStatus = :pendingPaymentStatus', {
          pendingPaymentStatus: PaymentStatus.PENDING,
        })
        .getRawOne<{ count: string }>(),

      this.createBookingBaseQuery(tenantId, facilityId)
        .select('COALESCE(SUM(booking.totalAmount), 0)', 'sum')
        .andWhere('booking.startTime BETWEEN :dayStartUtc AND :dayEndUtc', {
          dayStartUtc,
          dayEndUtc,
        })
        .andWhere('booking.status = :confirmedStatus', {
          confirmedStatus: BookingStatus.CONFIRMED,
        })
        .andWhere('booking.paymentStatus = :pendingPaymentStatus', {
          pendingPaymentStatus: PaymentStatus.PENDING,
        })
        .getRawOne<{ sum: string | null }>(),

      this.createBookingBaseQuery(tenantId, facilityId)
        .select('COUNT(*)', 'count')
        .andWhere('booking.status = :pendingStatus', {
          pendingStatus: BookingStatus.PENDING,
        })
        .andWhere('booking.holdUntil IS NOT NULL')
        .andWhere('booking.holdUntil BETWEEN :now AND :holdWindowEnd', {
          now,
          holdWindowEnd,
        })
        .getRawOne<{ count: string }>(),

      this.createWaitlistCountQuery(
        tenantId,
        dayStartUtc,
        dayEndUtc,
        facilityId
      )
        .andWhere('entry.status = :waitingStatus', {
          waitingStatus: WaitlistStatus.WAITING,
        })
        .getRawOne<{ count: string }>(),

      this.createWaitlistCountQuery(
        tenantId,
        dayStartUtc,
        dayEndUtc,
        facilityId
      )
        .andWhere('entry.status = :notifiedStatus', {
          notifiedStatus: WaitlistStatus.NOTIFIED,
        })
        .andWhere('entry.fulfilledByBookingId IS NULL')
        .getRawOne<{ count: string }>(),

      this.createBookingCountQuery(tenantId, dayStartUtc, dayEndUtc, facilityId)
        .andWhere('booking.status = :noShowStatus', {
          noShowStatus: BookingStatus.NO_SHOW,
        })
        .getRawOne<{ count: string }>(),
    ]);

    return {
      bookingsToday: Number(bookingsTodayRaw?.count ?? 0),
      revenueToday: Number(revenueTodayRaw?.sum ?? 0),
      unpaidCount: Number(unpaidCountRaw?.count ?? 0),
      unpaidAmount: Number(unpaidAmountRaw?.sum ?? 0),
      expiringHoldsCount: Number(expiringHoldsRaw?.count ?? 0),
      waitlistToday: Number(waitlistTodayRaw?.count ?? 0),
      notifiedWaitlistCount: Number(notifiedWaitlistRaw?.count ?? 0),
      noShowCount: Number(noShowCountRaw?.count ?? 0),
    };
  }

  private createBookingBaseQuery(
    tenantId: string,
    facilityId?: string
  ): SelectQueryBuilder<Booking> {
    const query = this.bookingRepository
      .createQueryBuilder('booking')
      .innerJoin('booking.facility', 'facility')
      .where('facility.tenantId = :tenantId', { tenantId });

    if (facilityId) {
      query.andWhere('facility.id = :facilityId', { facilityId });
    }

    return query;
  }

  private createBookingCountQuery(
    tenantId: string,
    dayStartUtc: Date,
    dayEndUtc: Date,
    facilityId?: string
  ): SelectQueryBuilder<Booking> {
    return this.createBookingBaseQuery(tenantId, facilityId)
      .select('COUNT(*)', 'count')
      .andWhere('booking.startTime BETWEEN :dayStartUtc AND :dayEndUtc', {
        dayStartUtc,
        dayEndUtc,
      });
  }

  private createWaitlistCountQuery(
    tenantId: string,
    dayStartUtc: Date,
    dayEndUtc: Date,
    facilityId?: string
  ): SelectQueryBuilder<WaitingListEntry> {
    const query = this.waitlistRepository
      .createQueryBuilder('entry')
      .innerJoin('entry.facility', 'facility')
      .select('COUNT(*)', 'count')
      .where('facility.tenantId = :tenantId', { tenantId })
      .andWhere('entry.desiredStartTime BETWEEN :dayStartUtc AND :dayEndUtc', {
        dayStartUtc,
        dayEndUtc,
      });

    if (facilityId) {
      query.andWhere('entry.facilityId = :facilityId', { facilityId });
    }

    return query;
  }
}
