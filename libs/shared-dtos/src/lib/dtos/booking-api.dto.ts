import { BookingStatus } from '../enums/booking-status.enum';
import { ConflictType } from '../enums/conflict-type.enum';
import { PaymentStatus } from '../enums/payment-status.enum';
import { PriceBreakdown } from '../interfaces/price-breakdown.interface';

/**
 * Simplified facility for selection lists and API responses
 */
export interface FacilityListItemDto {
  id: string;
  name: string;
  openTime: string;
  closeTime: string;
  slotDurationMinutes: number;
  basePrice: number;
  currency: string;
}

/**
 * Request DTO for booking preview
 */
export interface BookingPreviewRequestDto {
  facilityId: string;
  startTime: string;
  endTime: string;
  promoCode?: string;
}

/**
 * Conflict information in booking preview
 */
export interface BookingConflictDto {
  hasConflict: boolean;
  conflictType?: ConflictType;
  message: string;
  conflictingSlots: Array<{
    startTime: string;
    endTime: string;
    status: string;
    bookingReference?: string;
  }>;
}

/**
 * Alternative time slot suggestion
 */
export interface AlternativeSlotDto {
  startTime: string;
  endTime: string;
  price: number;
  currency: string;
}

/**
 * Response DTO for booking preview
 */
export interface BookingPreviewResponseDto {
  canBook: boolean;
  priceBreakdown: PriceBreakdown;
  conflict?: BookingConflictDto;
  suggestedAlternatives?: AlternativeSlotDto[];
  validationErrors?: string[];
}

/**
 * Request DTO for creating a booking (frontend version, no validators)
 */
export interface CreateBookingRequestDto {
  facilityId: string;
  startTime: string;
  endTime: string;
  customerName: string;
  customerPhone: string;
  status?: BookingStatus;
  paymentStatus?: PaymentStatus;
}

/**
 * Booking response from API (list and detail views)
 */
export interface BookingListItemDto {
  id: string;
  bookingReference?: string;
  facility: {
    id: string;
    name: string;
    config?: {
      pricePerHour?: number;
    };
  };
  startTime: string;
  endTime: string;
  customerName: string;
  customerPhone: string;
  totalAmount?: number | string;
  currency?: string;
  priceBreakdown?: PriceBreakdown;
  holdUntil?: string | null;
  cancellationReason?: string | null;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Request DTO for updating booking status
 */
export interface UpdateBookingStatusRequestDto {
  status?: BookingStatus;
  paymentStatus?: PaymentStatus;
  cancellationReason?: string;
}
