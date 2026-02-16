/**
 * Formatting utilities for Khana
 * Currency, phone, and display formatters
 */

/**
 * Default currency for MENA region
 */
export const DEFAULT_CURRENCY = 'SAR';

/**
 * Default locale for formatting
 */
export const DEFAULT_LOCALE = 'en-SA';

/**
 * Format currency amount
 */
export function formatCurrency(
  amount: number,
  currency: string = DEFAULT_CURRENCY,
  locale: string = DEFAULT_LOCALE
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format currency amount without symbol
 */
export function formatAmount(
  amount: number,
  locale: string = DEFAULT_LOCALE
): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format phone number for display
 * Converts +966512345678 to +966 51 234 5678
 */
export function formatPhoneDisplay(phone: string): string {
  // Remove all non-digit characters except +
  const cleaned = phone.replace(/[^\d+]/g, '');

  if (cleaned.startsWith('+966') && cleaned.length === 13) {
    // Saudi format: +966 5X XXX XXXX
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 6)} ${cleaned.slice(
      6,
      9
    )} ${cleaned.slice(9)}`;
  }

  // Return as-is if not Saudi format
  return phone;
}

/**
 * Format duration in minutes to human-readable string
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }

  return `${hours}h ${remainingMinutes}m`;
}

/**
 * Format duration for short display
 */
export function formatDurationShort(minutes: number): string {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (remainingMinutes === 0) {
    return `${hours}h`;
  }

  return `${hours}h${remainingMinutes}m`;
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals = 0): string {
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format occupancy rate with color indicator
 */
export function getOccupancyLevel(
  rate: number
): 'low' | 'medium' | 'high' | 'full' {
  if (rate >= 100) return 'full';
  if (rate >= 75) return 'high';
  if (rate >= 50) return 'medium';
  return 'low';
}

/**
 * Format large numbers with K/M suffix
 */
export function formatCompactNumber(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
}

/**
 * Capitalize first letter
 */
export function capitalize(str: string): string {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Convert enum value to display string
 * e.g., PADEL_COURT -> Padel Court
 */
export function enumToDisplay(value: string): string {
  return value
    .split('_')
    .map((word) => capitalize(word))
    .join(' ');
}

/**
 * Convert camelCase to display string
 * e.g., slotDuration -> Slot Duration
 */
export function camelToDisplay(str: string): string {
  return str
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

/**
 * Truncate string with ellipsis
 */
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Format relative time (e.g., "2 hours ago", "in 3 days")
 */
export function formatRelativeTime(
  date: Date,
  locale: string = DEFAULT_LOCALE
): string {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });

  if (Math.abs(diffDays) >= 1) {
    return rtf.format(diffDays, 'day');
  }
  if (Math.abs(diffHours) >= 1) {
    return rtf.format(diffHours, 'hour');
  }
  if (Math.abs(diffMinutes) >= 1) {
    return rtf.format(diffMinutes, 'minute');
  }
  return rtf.format(diffSeconds, 'second');
}

/**
 * Format booking status for display with color
 */
export function getBookingStatusDisplay(status: string): {
  label: string;
  color: 'success' | 'warning' | 'danger' | 'info' | 'default';
} {
  const statusMap: Record<
    string,
    {
      label: string;
      color: 'success' | 'warning' | 'danger' | 'info' | 'default';
    }
  > = {
    PENDING: { label: 'Pending', color: 'warning' },
    CONFIRMED: { label: 'Confirmed', color: 'success' },
    CANCELLED: { label: 'Cancelled', color: 'danger' },
    COMPLETED: { label: 'Completed', color: 'info' },
    NO_SHOW: { label: 'No Show', color: 'danger' },
  };

  return (
    statusMap[status] || { label: enumToDisplay(status), color: 'default' }
  );
}

/**
 * Format payment status for display with color
 */
export function getPaymentStatusDisplay(status: string): {
  label: string;
  color: 'success' | 'warning' | 'danger' | 'info' | 'default';
} {
  const statusMap: Record<
    string,
    {
      label: string;
      color: 'success' | 'warning' | 'danger' | 'info' | 'default';
    }
  > = {
    UNPAID: { label: 'Unpaid', color: 'danger' },
    PARTIALLY_PAID: { label: 'Partial', color: 'warning' },
    PAID: { label: 'Paid', color: 'success' },
    REFUNDED: { label: 'Refunded', color: 'info' },
    PARTIALLY_REFUNDED: { label: 'Partial Refund', color: 'info' },
  };

  return (
    statusMap[status] || { label: enumToDisplay(status), color: 'default' }
  );
}
