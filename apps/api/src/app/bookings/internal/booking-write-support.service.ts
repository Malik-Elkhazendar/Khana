import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Booking,
  Facility,
  PromoCode,
  PromoCodeRedemption,
} from '@khana/data-access';
import { PriceBreakdown, SlotStatus } from '@khana/shared-dtos';
import { EntityManager, Repository } from 'typeorm';
import { validateBookingInput } from '@khana/booking-engine';
import { buildFacilityConfig } from './bookings-mapper.helpers';
import {
  BOOKINGS_INACTIVE_FACILITY_MESSAGE,
  BOOKINGS_RESOURCE_NOT_FOUND_MESSAGE,
} from './bookings.constants';
import {
  PromoValidationResult,
  resolvePromoForCreate,
} from './bookings-promo.helpers';

export type LockedFacilityBookingContext = {
  lockedFacility: Facility;
  facilityConfig: ReturnType<typeof buildFacilityConfig>;
  occupiedSlots: Array<{
    id: string;
    facilityId: string;
    startTime: Date;
    endTime: Date;
    status: SlotStatus.BOOKED;
    bookingReference: string;
  }>;
};

@Injectable()
export class BookingWriteSupportService {
  async loadLockedFacilityContext(params: {
    manager: EntityManager;
    facilityId: string;
    tenantId: string;
    now: Date;
    windowStart?: Date;
    windowEnd?: Date;
  }): Promise<LockedFacilityBookingContext> {
    const lockedFacility = await params.manager
      .getRepository(Facility)
      .createQueryBuilder('facility')
      .where('facility.id = :facilityId', { facilityId: params.facilityId })
      .setLock('pessimistic_write')
      .getOne();

    if (!lockedFacility) {
      throw new NotFoundException(BOOKINGS_RESOURCE_NOT_FOUND_MESSAGE);
    }

    if (!lockedFacility.isActive) {
      throw new ConflictException(BOOKINGS_INACTIVE_FACILITY_MESSAGE);
    }

    const bookingQuery = params.manager
      .getRepository(Booking)
      .createQueryBuilder('booking')
      .innerJoin('booking.facility', 'facility')
      .where('facility.id = :facilityId', { facilityId: params.facilityId })
      .andWhere('facility.tenantId = :tenantId', {
        tenantId: params.tenantId,
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
          confirmedStatus: 'CONFIRMED',
          pendingStatus: 'PENDING',
          now: params.now,
        }
      );

    if (params.windowEnd) {
      bookingQuery.andWhere('booking.startTime < :windowEnd', {
        windowEnd: params.windowEnd,
      });
    }

    if (params.windowStart) {
      bookingQuery.andWhere('booking.endTime > :windowStart', {
        windowStart: params.windowStart,
      });
    }

    const existingBookings = await bookingQuery.getMany();

    return {
      lockedFacility,
      facilityConfig: buildFacilityConfig(lockedFacility),
      occupiedSlots: existingBookings.map((booking) => ({
        id: booking.id,
        facilityId: params.facilityId,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: SlotStatus.BOOKED,
        bookingReference: booking.bookingReference ?? booking.id,
      })),
    };
  }

  getValidationErrors(params: {
    facilityId: string;
    startTime: Date;
    endTime: Date;
    facilityConfig: ReturnType<typeof buildFacilityConfig>;
  }): string[] {
    return validateBookingInput(
      {
        facilityId: params.facilityId,
        startTime: params.startTime,
        endTime: params.endTime,
      },
      params.facilityConfig
    );
  }

  throwValidationError(validationErrors: string[]): never {
    throw new BadRequestException({
      message: 'Booking validation failed.',
      validationErrors,
    });
  }

  async resolvePromoForCreate(params: {
    promoCodeRepository: Repository<PromoCode>;
    tenantId: string;
    facilityId: string;
    promoCode?: string;
    now: Date;
  }): Promise<PromoValidationResult | undefined> {
    return resolvePromoForCreate(params);
  }

  async persistPromoRedemption(params: {
    promoCodeRepository: Repository<PromoCode>;
    promoCodeRedemptionRepository: Repository<PromoCodeRedemption>;
    tenantId: string;
    userId: string;
    bookingId: string;
    priceBreakdown: PriceBreakdown;
    promoResolution?: PromoValidationResult;
  }): Promise<void> {
    const promoCode = params.promoResolution?.promoCode;
    if (!promoCode) {
      return;
    }

    promoCode.currentUses = Number(promoCode.currentUses) + 1;
    await params.promoCodeRepository.save(promoCode);

    await params.promoCodeRedemptionRepository.save(
      params.promoCodeRedemptionRepository.create({
        tenantId: params.tenantId,
        promoCodeId: promoCode.id,
        bookingId: params.bookingId,
        redeemedByUserId: params.userId,
        discountAmount: params.priceBreakdown.promoDiscount ?? 0,
        codeSnapshot: promoCode.code,
        discountTypeSnapshot: promoCode.discountType,
        discountValueSnapshot: Number(promoCode.discountValue),
      })
    );
  }
}
