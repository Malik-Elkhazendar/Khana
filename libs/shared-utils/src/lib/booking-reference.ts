/**
 * Booking reference generator for Khana
 * Generates unique, human-readable booking references
 *
 * Format: KH-YYYY-NNNNNN
 * Example: KH-2025-001234
 */

/**
 * Booking reference prefix
 */
export const BOOKING_REFERENCE_PREFIX = 'KH';

/**
 * Generate a booking reference
 * @param sequenceNumber - Sequential number (will be padded to 6 digits)
 * @param year - Year (defaults to current year)
 * @returns Formatted booking reference
 */
export function generateBookingReference(
  sequenceNumber: number,
  year?: number
): string {
  const currentYear = year ?? new Date().getFullYear();
  const paddedSequence = sequenceNumber.toString().padStart(6, '0');

  return `${BOOKING_REFERENCE_PREFIX}-${currentYear}-${paddedSequence}`;
}

/**
 * Parse a booking reference
 * @param reference - Booking reference string
 * @returns Parsed components or null if invalid
 */
export function parseBookingReference(reference: string): {
  prefix: string;
  year: number;
  sequenceNumber: number;
} | null {
  const match = reference.match(/^([A-Z]+)-(\d{4})-(\d{6})$/);

  if (!match) {
    return null;
  }

  return {
    prefix: match[1],
    year: parseInt(match[2], 10),
    sequenceNumber: parseInt(match[3], 10),
  };
}

/**
 * Validate a booking reference format
 */
export function isValidBookingReferenceFormat(reference: string): boolean {
  return /^KH-\d{4}-\d{6}$/.test(reference);
}

/**
 * Generate a unique ID for slots (used in availability responses)
 * Format: facilityId-timestamp
 */
export function generateSlotId(facilityId: string, startTime: Date): string {
  const timestamp = startTime.getTime();
  return `${facilityId}-${timestamp}`;
}

/**
 * Parse a slot ID
 */
export function parseSlotId(slotId: string): {
  facilityId: string;
  timestamp: number;
} | null {
  const lastDashIndex = slotId.lastIndexOf('-');

  if (lastDashIndex === -1) {
    return null;
  }

  const facilityId = slotId.substring(0, lastDashIndex);
  const timestamp = parseInt(slotId.substring(lastDashIndex + 1), 10);

  if (isNaN(timestamp)) {
    return null;
  }

  return { facilityId, timestamp };
}

/**
 * Generate a short confirmation code (for SMS/display)
 * Format: 6 alphanumeric characters
 */
export function generateConfirmationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluding confusing chars (0, O, 1, I)
  let code = '';

  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * chars.length);
    code += chars[randomIndex];
  }

  return code;
}

/**
 * Generate a unique transaction reference for payments
 * Format: TXN-YYYYMMDD-XXXXXXXX
 */
export function generateTransactionReference(): string {
  const now = new Date();
  const dateStr =
    now.getFullYear().toString() +
    (now.getMonth() + 1).toString().padStart(2, '0') +
    now.getDate().toString().padStart(2, '0');

  const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();

  return `TXN-${dateStr}-${randomPart}`;
}
