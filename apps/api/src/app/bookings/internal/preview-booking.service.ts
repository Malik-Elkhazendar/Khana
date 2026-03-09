import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { previewBooking as buildPreview } from '@khana/booking-engine';
import { Booking, Facility, PromoCode } from '@khana/data-access';
import {
  BookingStatus,
  PromoValidationDto,
  SlotStatus,
} from '@khana/shared-dtos';
import { MoreThan, Repository } from 'typeorm';
import { BookingPreviewRequestDto, BookingPreviewResponseDto } from '../dto';
import {
  BOOKINGS_ACCESS_DENIED_MESSAGE,
  BOOKINGS_INACTIVE_FACILITY_MESSAGE,
  BOOKINGS_RESOURCE_NOT_FOUND_MESSAGE,
} from './bookings.constants';
import {
  applyPromoToPriceBreakdown,
  normalizePromoCode,
  resolvePromoForPreview,
} from './bookings-promo.helpers';
import {
  buildFacilityConfig,
  transformToResponseDto,
} from './bookings-mapper.helpers';
import {
  requireTenantId,
  validateFacilityOwnership,
} from './bookings-policy.helpers';

@Injectable()
export class PreviewBookingService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Facility)
    private readonly facilityRepository: Repository<Facility>,
    @InjectRepository(PromoCode)
    private readonly promoCodeRepository: Repository<PromoCode>
  ) {}

  async execute(
    dto: BookingPreviewRequestDto,
    tenantId: string
  ): Promise<BookingPreviewResponseDto> {
    const resolvedTenantId = requireTenantId(
      tenantId,
      BOOKINGS_ACCESS_DENIED_MESSAGE
    );
    const now = new Date();
    const facility = await validateFacilityOwnership({
      facilityRepository: this.facilityRepository,
      facilityId: dto.facilityId,
      tenantId: resolvedTenantId,
      resourceNotFoundMessage: BOOKINGS_RESOURCE_NOT_FOUND_MESSAGE,
      accessDeniedMessage: BOOKINGS_ACCESS_DENIED_MESSAGE,
      inactiveFacilityMessage: BOOKINGS_INACTIVE_FACILITY_MESSAGE,
      activeOnly: true,
    });

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

    const result = buildPreview(
      {
        facilityId: dto.facilityId,
        startTime: new Date(dto.startTime),
        endTime: new Date(dto.endTime),
      },
      buildFacilityConfig(facility),
      occupiedSlots
    );

    const normalizedPromoCode = normalizePromoCode(dto.promoCode);
    const promoValidation = await resolvePromoForPreview({
      promoCodeRepository: this.promoCodeRepository,
      tenantId: resolvedTenantId,
      facilityId: dto.facilityId,
      promoCode: normalizedPromoCode,
      now,
    });

    if (promoValidation?.validation.isValid && promoValidation.promoCode) {
      result.priceBreakdown = applyPromoToPriceBreakdown(
        result.priceBreakdown,
        promoValidation.promoCode.code,
        promoValidation.promoCode.discountType,
        Number(promoValidation.promoCode.discountValue)
      );
      (promoValidation.validation as PromoValidationDto).discountAmount =
        result.priceBreakdown.promoDiscount ?? 0;
    }

    return transformToResponseDto(result, promoValidation?.validation);
  }
}
