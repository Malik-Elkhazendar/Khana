/**
 * Detailed price calculation breakdown
 * Stored with bookings for audit trail and transparency
 */
export interface PriceBreakdown {
  /** Base price from facility settings */
  basePrice: number;

  /** Time of day multiplier (e.g., 1.5 for peak hours) */
  timeMultiplier: number;

  /** Day of week multiplier (e.g., 1.3 for weekends) */
  dayMultiplier: number;

  /** Duration-based discount percentage (0-1) */
  durationDiscount: number;

  /** Subtotal before discounts */
  subtotal: number;

  /** Total discount amount */
  discountAmount: number;

  /** Any promotional discount applied */
  promoDiscount?: number;

  /** Promotional code used (if any) */
  promoCode?: string;

  /** Tax amount (if applicable) */
  taxAmount?: number;

  /** Tax percentage applied */
  taxPercentage?: number;

  /** Final total amount */
  total: number;

  /** Currency code */
  currency: string;
}

/**
 * Pricing configuration for a facility
 */
export interface PricingConfig {
  /** Base price per slot (hour or day depending on inventory type) */
  basePrice: number;

  /** Currency code (default: SAR) */
  currency: string;

  /** Peak hours configuration */
  peakHours?: {
    /** Start hour (0-23) */
    start: number;
    /** End hour (0-23) */
    end: number;
    /** Multiplier for peak hours */
    multiplier: number;
  };

  /** Weekend pricing multiplier (Thu-Fri in MENA) */
  weekendMultiplier?: number;

  /** Duration discounts */
  durationDiscounts?: {
    /** Minimum duration in minutes to qualify */
    minDuration: number;
    /** Discount percentage (0-1) */
    discount: number;
  }[];
}
