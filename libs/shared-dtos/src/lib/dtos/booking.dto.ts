import { BookingStatus } from '../enums/booking-status.enum';
import { PaymentStatus } from '../enums/payment-status.enum';
import { PriceBreakdown } from '../interfaces/price-breakdown.interface';
import { BookingMetadata } from '../interfaces/booking-metadata.interface';
import { CustomerDto } from './customer.dto';
import { FacilitySummaryDto } from './facility.dto';

/**
 * Booking DTO - Safe for frontend consumption
 */
export interface BookingDto {
  /** Unique identifier */
  id: string;

  /** Human-readable booking reference (e.g., KH-2025-001234) */
  bookingReference: string;

  /** Tenant ID */
  tenantId: string;

  /** Facility ID */
  facilityId: string;

  /** Facility summary (for display) */
  facility?: FacilitySummaryDto;

  /** Start time of the booking */
  startTime: Date;

  /** End time of the booking */
  endTime: Date;

  /** Customer ID */
  customerId: string;

  /** Customer details (for display) */
  customer?: CustomerDto;

  /** Total amount */
  totalAmount: number;

  /** Currency */
  currency: string;

  /** Booking status */
  status: BookingStatus;

  /** Payment status */
  paymentStatus: PaymentStatus;

  /** Price breakdown (for transparency) */
  priceBreakdown: PriceBreakdown;

  /** Additional metadata */
  metadata?: BookingMetadata;

  /** Creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * DTO for creating a new booking
 */
export interface CreateBookingDto {
  /** Facility ID */
  facilityId: string;

  /** Start time */
  startTime: Date;

  /** End time */
  endTime: Date;

  /** Customer ID (existing customer) */
  customerId?: string;

  /** New customer data (if no customerId) */
  newCustomer?: {
    name: string;
    phone: string;
    email?: string;
  };

  /** Promo code (optional) */
  promoCode?: string;

  /** Additional metadata */
  metadata?: Partial<BookingMetadata>;

  /** Skip conflict check (admin override) */
  skipConflictCheck?: boolean;
}

/**
 * DTO for updating a booking
 */
export interface UpdateBookingDto {
  /** New start time (triggers re-validation) */
  startTime?: Date;

  /** New end time (triggers re-validation) */
  endTime?: Date;

  /** Update status */
  status?: BookingStatus;

  /** Update payment status */
  paymentStatus?: PaymentStatus;

  /** Update metadata */
  metadata?: Partial<BookingMetadata>;
}

/**
 * DTO for cancelling a booking
 */
export interface CancelBookingDto {
  /** Cancellation reason */
  reason: string;

  /** Process refund */
  processRefund?: boolean;

  /** Notify customer */
  notifyCustomer?: boolean;
}

/**
 * Summary DTO for booking lists
 */
export interface BookingSummaryDto {
  id: string;
  bookingReference: string;
  facilityName: string;
  customerName: string;
  startTime: Date;
  endTime: Date;
  totalAmount: number;
  currency: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
}

/**
 * Response DTO after creating a booking
 */
export interface BookingCreatedDto {
  /** Created booking */
  booking: BookingDto;

  /** Generated booking reference */
  bookingReference: string;

  /** Whether confirmation SMS/email was sent */
  confirmationSent: boolean;

  /** Any warnings (e.g., approaching capacity) */
  warnings?: string[];
}
