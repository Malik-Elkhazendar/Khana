import { BookingStatus } from '../enums/booking-status.enum';
import { BookingCancellationScope } from '../enums/booking-cancellation-scope.enum';
import { ConflictType } from '../enums/conflict-type.enum';
import { PaymentStatus } from '../enums/payment-status.enum';
import { RecurrenceFrequency } from '../enums/recurrence-frequency.enum';
import { PriceBreakdown } from '../interfaces/price-breakdown.interface';
import { PromoValidationDto } from './promo-code.dto';

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
 * Facility management pricing and operating-hours config
 */
export interface FacilityManagementConfigDto {
  pricePerHour: number;
  openTime: string;
  closeTime: string;
}

/**
 * Facility item returned by management CRUD endpoints
 */
export interface FacilityManagementItemDto {
  id: string;
  tenantId?: string;
  name: string;
  type: string;
  isActive: boolean;
  config: FacilityManagementConfigDto;
  createdAt: string;
  updatedAt: string;
}

/**
 * Request body for creating a facility
 */
export interface CreateFacilityRequestDto {
  name: string;
  type: string;
  config: FacilityManagementConfigDto;
}

/**
 * Request body for updating facility details
 */
export interface UpdateFacilityRequestDto {
  name?: string;
  type?: string;
  isActive?: boolean;
  config?: Partial<FacilityManagementConfigDto>;
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
  promoValidation?: PromoValidationDto;
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
  promoCode?: string;
  status?: BookingStatus;
  paymentStatus?: PaymentStatus;
}

/**
 * Recurrence rule for grouped recurring bookings.
 */
export interface BookingRecurrenceRuleDto {
  frequency: RecurrenceFrequency;
  /** Interval in weeks. 1 = weekly, 2 = biweekly. */
  intervalWeeks: number;
  /** End recurrence on this date (inclusive). */
  endsAtDate?: string;
  /** Total number of booking instances to create. */
  occurrences?: number;
}

/**
 * Request DTO for creating recurring bookings in one call.
 */
export interface CreateRecurringBookingRequestDto {
  facilityId: string;
  startTime: string;
  endTime: string;
  customerName: string;
  customerPhone: string;
  status?: BookingStatus;
  recurrenceRule: BookingRecurrenceRuleDto;
}

/**
 * Summary response for recurring booking creation.
 */
export interface CreateRecurringBookingResponseDto {
  recurrenceGroupId: string;
  createdCount: number;
  bookings: BookingListItemDto[];
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
  recurrenceGroupId?: string | null;
  recurrenceInstanceNumber?: number | null;
  recurrenceRule?: BookingRecurrenceRuleDto | null;
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
  cancellationScope?: BookingCancellationScope;
}
