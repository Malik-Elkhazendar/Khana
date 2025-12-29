/**
 * Validation utilities for Khana
 * Common validators for business rules
 */

/**
 * Saudi phone number regex
 * Matches: +966XXXXXXXXX, 00966XXXXXXXXX, 05XXXXXXXX, 5XXXXXXXX
 */
const SAUDI_PHONE_REGEX = /^(?:\+966|00966|0)?5\d{8}$/;

/**
 * Email regex (simple but effective)
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Subdomain regex (lowercase, alphanumeric, hyphens, 3-50 chars)
 */
const SUBDOMAIN_REGEX = /^[a-z0-9]([a-z0-9-]{1,48}[a-z0-9])?$/;

/**
 * Booking reference regex (KH-YYYY-NNNNNN)
 */
const BOOKING_REFERENCE_REGEX = /^KH-\d{4}-\d{6}$/;

/**
 * UUID v4 regex
 */
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validate Saudi phone number
 */
export function isValidSaudiPhone(phone: string): boolean {
  return SAUDI_PHONE_REGEX.test(phone.replace(/\s/g, ''));
}

/**
 * Normalize Saudi phone number to +966 format
 */
export function normalizeSaudiPhone(phone: string): string {
  // Remove all whitespace
  let normalized = phone.replace(/\s/g, '');

  // Remove leading + if present
  if (normalized.startsWith('+')) {
    normalized = normalized.substring(1);
  }

  // Remove leading 00 if present
  if (normalized.startsWith('00')) {
    normalized = normalized.substring(2);
  }

  // Remove leading 0 if present (local format)
  if (normalized.startsWith('0')) {
    normalized = normalized.substring(1);
  }

  // Add 966 if not present
  if (!normalized.startsWith('966')) {
    normalized = '966' + normalized;
  }

  return '+' + normalized;
}

/**
 * Validate phone number with result
 */
export function validatePhone(phone: string): ValidationResult {
  if (!phone || phone.trim().length === 0) {
    return { isValid: false, error: 'Phone number is required' };
  }

  if (!isValidSaudiPhone(phone)) {
    return { isValid: false, error: 'Invalid Saudi phone number format' };
  }

  return { isValid: true };
}

/**
 * Validate email address
 */
export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}

/**
 * Validate email with result
 */
export function validateEmail(
  email: string,
  required = false
): ValidationResult {
  if (!email || email.trim().length === 0) {
    if (required) {
      return { isValid: false, error: 'Email is required' };
    }
    return { isValid: true }; // Optional and empty is valid
  }

  if (!isValidEmail(email)) {
    return { isValid: false, error: 'Invalid email format' };
  }

  return { isValid: true };
}

/**
 * Validate subdomain
 */
export function isValidSubdomain(subdomain: string): boolean {
  return SUBDOMAIN_REGEX.test(subdomain);
}

/**
 * Validate subdomain with result
 */
export function validateSubdomain(subdomain: string): ValidationResult {
  if (!subdomain || subdomain.trim().length === 0) {
    return { isValid: false, error: 'Subdomain is required' };
  }

  if (subdomain.length < 3) {
    return { isValid: false, error: 'Subdomain must be at least 3 characters' };
  }

  if (subdomain.length > 50) {
    return { isValid: false, error: 'Subdomain must be at most 50 characters' };
  }

  if (!isValidSubdomain(subdomain)) {
    return {
      isValid: false,
      error:
        'Subdomain must contain only lowercase letters, numbers, and hyphens',
    };
  }

  return { isValid: true };
}

/**
 * Validate booking reference format
 */
export function isValidBookingReference(reference: string): boolean {
  return BOOKING_REFERENCE_REGEX.test(reference);
}

/**
 * Validate UUID v4
 */
export function isValidUuid(uuid: string): boolean {
  return UUID_V4_REGEX.test(uuid);
}

/**
 * Validate time range (end must be after start)
 */
export function validateTimeRange(
  startTime: Date,
  endTime: Date,
  minDurationMinutes?: number,
  maxDurationMinutes?: number
): ValidationResult {
  if (!(startTime instanceof Date) || isNaN(startTime.getTime())) {
    return { isValid: false, error: 'Invalid start time' };
  }

  if (!(endTime instanceof Date) || isNaN(endTime.getTime())) {
    return { isValid: false, error: 'Invalid end time' };
  }

  if (endTime <= startTime) {
    return { isValid: false, error: 'End time must be after start time' };
  }

  const durationMinutes =
    (endTime.getTime() - startTime.getTime()) / (60 * 1000);

  if (
    minDurationMinutes !== undefined &&
    durationMinutes < minDurationMinutes
  ) {
    return {
      isValid: false,
      error: `Duration must be at least ${minDurationMinutes} minutes`,
    };
  }

  if (
    maxDurationMinutes !== undefined &&
    durationMinutes > maxDurationMinutes
  ) {
    return {
      isValid: false,
      error: `Duration must be at most ${maxDurationMinutes} minutes`,
    };
  }

  return { isValid: true };
}

/**
 * Validate future date (must be in the future)
 */
export function validateFutureDate(
  date: Date,
  minAdvanceHours?: number
): ValidationResult {
  const now = new Date();

  if (date <= now) {
    return { isValid: false, error: 'Date must be in the future' };
  }

  if (minAdvanceHours !== undefined) {
    const minDate = new Date(now.getTime() + minAdvanceHours * 60 * 60 * 1000);
    if (date < minDate) {
      return {
        isValid: false,
        error: `Booking must be at least ${minAdvanceHours} hours in advance`,
      };
    }
  }

  return { isValid: true };
}

/**
 * Validate price (positive number)
 */
export function validatePrice(price: number): ValidationResult {
  if (typeof price !== 'number' || isNaN(price)) {
    return { isValid: false, error: 'Price must be a number' };
  }

  if (price < 0) {
    return { isValid: false, error: 'Price cannot be negative' };
  }

  return { isValid: true };
}

/**
 * Validate required string
 */
export function validateRequired(
  value: string | undefined | null,
  fieldName: string
): ValidationResult {
  if (value === undefined || value === null || value.trim().length === 0) {
    return { isValid: false, error: `${fieldName} is required` };
  }

  return { isValid: true };
}

/**
 * Validate string length
 */
export function validateLength(
  value: string,
  fieldName: string,
  min?: number,
  max?: number
): ValidationResult {
  if (min !== undefined && value.length < min) {
    return {
      isValid: false,
      error: `${fieldName} must be at least ${min} characters`,
    };
  }

  if (max !== undefined && value.length > max) {
    return {
      isValid: false,
      error: `${fieldName} must be at most ${max} characters`,
    };
  }

  return { isValid: true };
}
