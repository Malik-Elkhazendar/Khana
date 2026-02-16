/**
 * Customer DTO - Safe for frontend consumption
 */
export interface CustomerDto {
  /** Unique identifier */
  id: string;

  /** Tenant ID this customer belongs to */
  tenantId: string;

  /** Full name */
  name: string;

  /** Phone number (primary contact) */
  phone: string;

  /** Email address (optional) */
  email?: string;

  /** WhatsApp number (if different from phone) */
  whatsapp?: string;

  /** Customer notes */
  notes?: string;

  /** Customer tags (e.g., "VIP", "Corporate") */
  tags?: string[];

  /** Total bookings count */
  totalBookings?: number;

  /** Total spend */
  totalSpend?: number;

  /** Last booking date */
  lastBookingDate?: Date;

  /** Whether customer is active */
  isActive: boolean;

  /** Creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * DTO for creating a new customer
 */
export interface CreateCustomerDto {
  /** Full name */
  name: string;

  /** Phone number (required) */
  phone: string;

  /** Email address */
  email?: string;

  /** WhatsApp number */
  whatsapp?: string;

  /** Notes */
  notes?: string;

  /** Tags */
  tags?: string[];
}

/**
 * DTO for updating a customer
 */
export interface UpdateCustomerDto {
  /** Full name */
  name?: string;

  /** Phone number */
  phone?: string;

  /** Email address */
  email?: string;

  /** WhatsApp number */
  whatsapp?: string;

  /** Notes */
  notes?: string;

  /** Tags */
  tags?: string[];

  /** Active status */
  isActive?: boolean;
}

/**
 * Summary DTO for customer lists
 */
export interface CustomerSummaryDto {
  id: string;
  name: string;
  phone: string;
  totalBookings: number;
  totalSpend: number;
  lastBookingDate?: Date;
  tags?: string[];
}

/**
 * Customer search/filter parameters
 */
export interface CustomerSearchDto {
  /** Search query (name, phone, email) */
  query?: string;

  /** Filter by tags */
  tags?: string[];

  /** Filter by minimum bookings */
  minBookings?: number;

  /** Filter by minimum spend */
  minSpend?: number;

  /** Include inactive customers */
  includeInactive?: boolean;

  /** Pagination offset */
  offset?: number;

  /** Pagination limit */
  limit?: number;

  /** Sort field */
  sortBy?:
    | 'name'
    | 'totalBookings'
    | 'totalSpend'
    | 'lastBookingDate'
    | 'createdAt';

  /** Sort direction */
  sortOrder?: 'asc' | 'desc';
}
