/**
 * Tenant-level settings and configuration
 * Stored as JSONB in the database
 */
export interface TenantSettings {
  /** Business information */
  business: {
    /** Legal business name */
    legalName?: string;
    /** Tax/VAT registration number */
    taxNumber?: string;
    /** Commercial registration number */
    commercialRegNumber?: string;
  };

  /** Contact information */
  contact: {
    /** Primary email */
    email: string;
    /** Primary phone */
    phone: string;
    /** WhatsApp number (common in MENA) */
    whatsapp?: string;
    /** Physical address */
    address?: string;
    /** City */
    city?: string;
    /** Country (default: Saudi Arabia) */
    country?: string;
  };

  /** Branding settings */
  branding?: {
    /** Logo URL */
    logoUrl?: string;
    /** Primary brand color (hex) */
    primaryColor?: string;
    /** Secondary brand color (hex) */
    secondaryColor?: string;
  };

  /** Localization settings */
  localization: {
    /** Default language (ar, en) */
    defaultLanguage: 'ar' | 'en';
    /** Timezone (default: Asia/Riyadh) */
    timezone: string;
    /** Currency (default: SAR) */
    currency: string;
    /** Date format preference */
    dateFormat?: 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD';
  };

  /** Notification settings */
  notifications?: {
    /** Send SMS notifications */
    smsEnabled: boolean;
    /** Send email notifications */
    emailEnabled: boolean;
    /** Send WhatsApp notifications */
    whatsappEnabled: boolean;
    /** Reminder hours before booking */
    reminderHours?: number;
  };

  /** Booking settings */
  booking: {
    /** Require customer phone verification */
    requirePhoneVerification: boolean;
    /** Allow booking without payment */
    allowUnpaidBookings: boolean;
    /** Auto-confirm bookings */
    autoConfirmBookings: boolean;
    /** Default booking status */
    defaultBookingStatus: 'PENDING' | 'CONFIRMED';
  };

  /** Payment settings (Phase 2) */
  payment?: {
    /** Accepted payment methods */
    acceptedMethods: ('CASH' | 'CARD' | 'BANK_TRANSFER' | 'MADA' | 'STC_PAY')[];
    /** Require deposit */
    requireDeposit: boolean;
    /** Deposit percentage */
    depositPercentage?: number;
  };

  /** Feature flags */
  features?: {
    /** Enable CRM features */
    crmEnabled: boolean;
    /** Enable analytics dashboard */
    analyticsEnabled: boolean;
    /** Enable multi-language */
    multiLanguageEnabled: boolean;
  };
}
