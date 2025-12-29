/**
 * Booking Engine
 * Core domain logic for the Khana booking system
 *
 * This module provides pure, framework-agnostic functions for:
 * - Conflict detection
 * - Price calculation
 * - Booking preview
 *
 * All functions are side-effect free and deterministic.
 */

// Re-export types
export * from './types';

// Re-export conflict detection
export {
  detectConflicts,
  determineConflictType,
  generateConflictMessage,
} from './conflict-detector';

// Re-export price calculation
export {
  calculatePrice,
  calculateTimeMultiplier,
  calculateDayMultiplier,
  calculateDurationDiscount,
  calculatePricingUnits,
  DEFAULT_CURRENCY,
} from './price-calculator';

// Re-export booking preview
export {
  previewBooking,
  validateBookingInput,
  findAlternativeSlots,
} from './booking-preview';
