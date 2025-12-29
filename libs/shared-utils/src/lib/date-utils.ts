/**
 * Date utilities for Khana
 * Handles MENA timezone specifics and slot generation
 */

/** Default timezone for MENA region */
export const DEFAULT_TIMEZONE = 'Asia/Riyadh';

/** Default slot duration in minutes */
export const DEFAULT_SLOT_DURATION = 60;

/**
 * MENA weekend days (Thursday = 4, Friday = 5)
 * Note: JavaScript Date.getDay() returns 0 for Sunday
 */
export const MENA_WEEKEND_DAYS = [4, 5] as const;

/**
 * Check if a date falls on a MENA weekend (Thursday or Friday)
 */
export function isMenaWeekend(date: Date): boolean {
  const day = date.getDay();
  return MENA_WEEKEND_DAYS.includes(day as 4 | 5);
}

/**
 * Check if a time is within peak hours
 * Default peak hours: 17:00 - 22:00
 */
export function isPeakHour(date: Date, peakStart = 17, peakEnd = 22): boolean {
  const hour = date.getHours();
  return hour >= peakStart && hour < peakEnd;
}

/**
 * Parse time string (HH:mm) to hours and minutes
 */
export function parseTimeString(time: string): {
  hours: number;
  minutes: number;
} {
  const [hours, minutes] = time.split(':').map(Number);
  return { hours, minutes };
}

/**
 * Set time on a date object from HH:mm string
 */
export function setTimeFromString(date: Date, time: string): Date {
  const result = new Date(date);
  const { hours, minutes } = parseTimeString(time);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

/**
 * Get start of day (00:00:00.000)
 */
export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get end of day (23:59:59.999)
 */
export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Add minutes to a date
 */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

/**
 * Add hours to a date
 */
export function addHours(date: Date, hours: number): Date {
  return addMinutes(date, hours * 60);
}

/**
 * Add days to a date
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Get difference in minutes between two dates
 */
export function diffInMinutes(start: Date, end: Date): number {
  return Math.floor((end.getTime() - start.getTime()) / (60 * 1000));
}

/**
 * Get difference in hours between two dates
 */
export function diffInHours(start: Date, end: Date): number {
  return Math.floor(diffInMinutes(start, end) / 60);
}

/**
 * Get difference in days between two dates
 */
export function diffInDays(start: Date, end: Date): number {
  return Math.floor(diffInHours(start, end) / 24);
}

/**
 * Check if two time ranges overlap
 * Two ranges [A_start, A_end] and [B_start, B_end] overlap if:
 * A_start < B_end AND A_end > B_start
 */
export function doTimeRangesOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

/**
 * Check if range A contains range B completely
 */
export function doesRangeContain(
  containerStart: Date,
  containerEnd: Date,
  containedStart: Date,
  containedEnd: Date
): boolean {
  return containerStart <= containedStart && containerEnd >= containedEnd;
}

/**
 * Generate time slots for a day
 * @param date - The day to generate slots for
 * @param openTime - Opening time (HH:mm)
 * @param closeTime - Closing time (HH:mm)
 * @param slotDuration - Duration of each slot in minutes
 * @returns Array of { startTime, endTime } objects
 */
export function generateDailySlots(
  date: Date,
  openTime: string,
  closeTime: string,
  slotDuration = DEFAULT_SLOT_DURATION
): Array<{ startTime: Date; endTime: Date }> {
  const slots: Array<{ startTime: Date; endTime: Date }> = [];
  const dayStart = startOfDay(date);

  const openDate = setTimeFromString(dayStart, openTime);
  const closeDate = setTimeFromString(dayStart, closeTime);

  let slotStart = new Date(openDate);

  while (slotStart < closeDate) {
    const slotEnd = addMinutes(slotStart, slotDuration);

    // Only add slot if it ends before or at closing time
    if (slotEnd <= closeDate) {
      slots.push({
        startTime: new Date(slotStart),
        endTime: new Date(slotEnd),
      });
    }

    slotStart = slotEnd;
  }

  return slots;
}

/**
 * Generate slots for a date range
 */
export function generateSlotsForRange(
  startDate: Date,
  endDate: Date,
  openTime: string,
  closeTime: string,
  slotDuration = DEFAULT_SLOT_DURATION
): Array<{ startTime: Date; endTime: Date }> {
  const allSlots: Array<{ startTime: Date; endTime: Date }> = [];

  let currentDate = startOfDay(startDate);
  const rangeEnd = startOfDay(endDate);

  while (currentDate <= rangeEnd) {
    const dailySlots = generateDailySlots(
      currentDate,
      openTime,
      closeTime,
      slotDuration
    );
    allSlots.push(...dailySlots);
    currentDate = addDays(currentDate, 1);
  }

  return allSlots;
}

/**
 * Format date for display (localized)
 */
export function formatDate(
  date: Date,
  locale = 'en-SA',
  options?: Intl.DateTimeFormatOptions
): string {
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  };
  return date.toLocaleDateString(locale, defaultOptions);
}

/**
 * Format time for display (localized)
 */
export function formatTime(
  date: Date,
  locale = 'en-SA',
  hour12 = true
): string {
  return date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12,
  });
}

/**
 * Format date and time for display
 */
export function formatDateTime(date: Date, locale = 'en-SA'): string {
  return `${formatDate(date, locale)} ${formatTime(date, locale)}`;
}

/**
 * Get day name in locale
 */
export function getDayName(
  date: Date,
  locale = 'en-SA',
  format: 'long' | 'short' | 'narrow' = 'long'
): string {
  return date.toLocaleDateString(locale, { weekday: format });
}

/**
 * Check if date is today
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

/**
 * Check if date is in the past
 */
export function isPast(date: Date): boolean {
  return date < new Date();
}

/**
 * Check if date is in the future
 */
export function isFuture(date: Date): boolean {
  return date > new Date();
}
