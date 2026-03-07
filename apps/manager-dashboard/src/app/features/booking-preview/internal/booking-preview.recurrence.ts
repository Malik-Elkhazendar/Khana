import { RecurrenceFrequency } from '@khana/shared-dtos';
import { RecurrenceEndMode } from './booking-preview.models';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function getDefaultBookingDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.toISOString().split('T')[0];
}

export function getDateAfterWeeks(baseDateIso: string, weeks: number): string {
  const [year, month, day] = baseDateIso
    .split('-')
    .map((value) => Number(value));

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return baseDateIso;
  }

  const normalizedWeeks = Number.isFinite(weeks) ? Math.trunc(weeks) : 0;
  const baseDate = new Date(Date.UTC(year, month - 1, day));
  baseDate.setUTCDate(baseDate.getUTCDate() + normalizedWeeks * 7);
  return baseDate.toISOString().split('T')[0];
}

export function getDayDifference(startIso: string, endIso: string): number {
  const startDate = parseIsoDate(startIso);
  const endDate = parseIsoDate(endIso);
  if (!startDate || !endDate) {
    return 0;
  }

  return Math.floor((endDate.getTime() - startDate.getTime()) / MS_PER_DAY);
}

export function getDefaultRecurrenceEndDate(
  selectedDate: string,
  recurrenceWeeksCount: number
): string {
  const horizonWeeks = Math.max(0, Number(recurrenceWeeksCount) - 1);
  return getDateAfterWeeks(selectedDate, horizonWeeks);
}

export function syncWeeksCountFromEndDate(
  selectedDate: string,
  endDateIso: string
): number {
  const days = getDayDifference(selectedDate, endDateIso);
  const weeksCount = Math.floor(Math.max(0, days) / 7) + 1;
  return clampRecurrenceWeeksCount(weeksCount);
}

export function normalizeRecurrenceEndDate(
  selectedDate: string,
  value: string
): string {
  const normalized = value.trim();
  if (!normalized) {
    return '';
  }

  return normalized < selectedDate ? selectedDate : normalized;
}

export function clampRecurrenceWeeksCount(value: string | number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.min(104, Math.max(1, Math.trunc(parsed)));
}

export function isValidTimeRange(start: string, end: string): boolean {
  const trimmedStart = start.trim();
  const trimmedEnd = end.trim();
  if (!trimmedStart || !trimmedEnd) {
    return true;
  }

  return trimmedStart < trimmedEnd;
}

export function resolveRecurrenceFrequency(value: string): RecurrenceFrequency {
  return value === RecurrenceFrequency.BIWEEKLY
    ? RecurrenceFrequency.BIWEEKLY
    : RecurrenceFrequency.WEEKLY;
}

export function resolveRecurrenceEndMode(value: string): RecurrenceEndMode {
  return value === 'DATE' ? 'DATE' : 'COUNT';
}

function parseIsoDate(value: string): Date | null {
  const [year, month, day] = value.split('-').map((part) => Number(part));
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day));
}
