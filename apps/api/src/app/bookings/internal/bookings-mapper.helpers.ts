import { BookingPreviewResult } from '@khana/booking-engine';
import { Booking, Facility } from '@khana/data-access';
import { BookingListItemDto, PromoValidationDto } from '@khana/shared-dtos';
import { BookingPreviewResponseDto } from '../dto';

export function buildFacilityConfig(facility: Facility): {
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

export function toBookingListItemDto(
  booking: Booking,
  facility: Facility,
  customerTags: string[] = []
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
    customerTags,
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

export function transformToResponseDto(
  result: BookingPreviewResult,
  promoValidation?: PromoValidationDto
): BookingPreviewResponseDto {
  const response: BookingPreviewResponseDto = {
    canBook: result.canBook,
    priceBreakdown: result.priceBreakdown,
  };

  if (promoValidation) {
    response.promoValidation = promoValidation;
  }

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

  if (result.suggestedAlternatives && result.suggestedAlternatives.length > 0) {
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
