import { BookingPrefillQueryParams } from './booking-preview.models';

export function buildBookingPrefill(
  params: Record<string, string | null>
): BookingPrefillQueryParams {
  return {
    facilityId: normalizeFacilityIdParam(params['facilityId'] ?? null),
    date: normalizeDateParam(params['date'] ?? null),
    startTime: normalizeTimeParam(params['startTime'] ?? null),
    endTime: normalizeTimeParam(params['endTime'] ?? null),
  };
}

export function hasBookingPrefill(prefill: BookingPrefillQueryParams): boolean {
  return Object.values(prefill).some((value) => value !== null);
}

export function normalizeFacilityIdParam(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function normalizeDateParam(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }

  const parsed = new Date(`${normalized}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : normalized;
}

export function normalizeTimeParam(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  const match = /^(\d{2}):(\d{2})$/.exec(normalized);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return normalized;
}
