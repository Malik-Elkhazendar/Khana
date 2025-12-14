import { Injectable, NotFoundException } from '@nestjs/common';
import { previewBooking, BookingPreviewResult } from '@khana/booking-engine';
import { BookingPreviewRequestDto, BookingPreviewResponseDto } from './dto';
import { getFacilityById, getMockOccupiedSlots, getAllFacilities } from './bookings.mock-data';

/**
 * Bookings Service
 *
 * Thin service layer that orchestrates domain logic.
 * Business logic lives in @khana/booking-engine.
 */
@Injectable()
export class BookingsService {
  /**
   * Preview a booking
   *
   * Validates input, calls domain logic, and returns formatted response.
   */
  previewBooking(dto: BookingPreviewRequestDto): BookingPreviewResponseDto {
    // Get facility configuration
    const facilityConfig = getFacilityById(dto.facilityId);

    if (!facilityConfig) {
      throw new NotFoundException(`Facility ${dto.facilityId} not found`);
    }

    // Get current occupied slots (in production, this would query the database)
    const occupiedSlots = getMockOccupiedSlots();

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
  getFacilities() {
    return getAllFacilities().map(facility => ({
      id: facility.id,
      name: facility.name,
      openTime: facility.openTime,
      closeTime: facility.closeTime,
      slotDurationMinutes: facility.slotDurationMinutes,
      basePrice: facility.pricing.basePrice,
      currency: facility.pricing.currency,
    }));
  }

  /**
   * Transform domain result to API response DTO
   */
  private transformToResponseDto(result: BookingPreviewResult): BookingPreviewResponseDto {
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
        conflictingSlots: result.conflict.conflictingSlots.map(slot => ({
          startTime: slot.startTime.toISOString(),
          endTime: slot.endTime.toISOString(),
          status: slot.status,
          bookingReference: slot.bookingReference,
        })),
      };
    }

    if (result.suggestedAlternatives && result.suggestedAlternatives.length > 0) {
      response.suggestedAlternatives = result.suggestedAlternatives.map(alt => ({
        startTime: alt.startTime.toISOString(),
        endTime: alt.endTime.toISOString(),
        price: alt.price,
        currency: alt.currency,
      }));
    }

    return response;
  }
}
