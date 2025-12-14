/**
 * Type of inventory/booking granularity
 * Core polymorphic enum that enables the same codebase to handle
 * both hourly (sports) and daily (chalets) bookings
 */
export enum InventoryType {
  /** Hourly slots - used for sports facilities (60-min, 90-min, 120-min) */
  HOURLY = 'HOURLY',

  /** Daily slots - used for chalets/resorts (full day bookings) */
  DAILY = 'DAILY',

  /** Custom duration - future use for flexible booking windows */
  CUSTOM = 'CUSTOM',
}
