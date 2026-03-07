import { WaitlistStatus } from '@khana/shared-dtos';
import { WaitlistStatusQuery } from './booking-preview.models';

export function normalizeWaitlistQueuePosition(
  queuePosition: number | null | undefined
): number | null {
  const normalizedQueuePosition =
    typeof queuePosition === 'number' ? queuePosition : Number.NaN;

  if (
    !Number.isFinite(normalizedQueuePosition) ||
    normalizedQueuePosition < 1
  ) {
    return null;
  }

  return Math.floor(normalizedQueuePosition);
}

export function hasActiveWaitlistEntry(
  status: WaitlistStatus | null | undefined
): boolean {
  return (
    status === WaitlistStatus.WAITING || status === WaitlistStatus.NOTIFIED
  );
}

export function isOnWaitlist(
  status: WaitlistStatus | null | undefined
): boolean {
  return status === WaitlistStatus.WAITING;
}

export function buildWaitlistStatusQuery(params: {
  facilityId: string;
  selectedDate: string;
  startTime: string;
  endTime: string;
  inputsValid: boolean;
}): WaitlistStatusQuery | null {
  if (!params.inputsValid) {
    return null;
  }

  const startDateTime = new Date(`${params.selectedDate}T${params.startTime}`);
  const endDateTime = new Date(`${params.selectedDate}T${params.endTime}`);

  if (
    Number.isNaN(startDateTime.getTime()) ||
    Number.isNaN(endDateTime.getTime()) ||
    startDateTime >= endDateTime
  ) {
    return null;
  }

  return {
    facilityId: params.facilityId,
    startTime: startDateTime.toISOString(),
    endTime: endDateTime.toISOString(),
  };
}

export function isWaitlistSlotInFuture(
  query: WaitlistStatusQuery | null,
  now: Date = new Date()
): boolean {
  if (!query) {
    return false;
  }

  return new Date(query.startTime) > now;
}
