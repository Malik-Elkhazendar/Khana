import { ConflictType, SlotStatus, PriceBreakdown } from '@khana/shared-dtos';

/**
 * Conflict information in the response
 */
export interface ConflictInfoDto {
  hasConflict: boolean;
  conflictType?: ConflictType;
  message: string;
  conflictingSlots: Array<{
    startTime: string;
    endTime: string;
    status: SlotStatus;
    bookingReference?: string;
  }>;
}

/**
 * Response DTO for booking preview
 */
export interface BookingPreviewResponseDto {
  /** Whether the booking can be made */
  canBook: boolean;

  /** Calculated price breakdown */
  priceBreakdown: PriceBreakdown;

  /** Conflict information (if any) */
  conflict?: ConflictInfoDto;

  /** Suggested alternative slots (if conflict exists) */
  suggestedAlternatives?: Array<{
    startTime: string;
    endTime: string;
    price: number;
    currency: string;
  }>;

  /** Validation errors (if any) */
  validationErrors?: string[];
}
