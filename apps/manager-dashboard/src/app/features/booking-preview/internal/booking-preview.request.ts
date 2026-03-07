import { PreviewRequestPayload } from './booking-preview.models';

export function buildPreviewPayload(params: {
  facilityId: string;
  selectedDate: string;
  startTime: string;
  endTime: string;
  promoCode?: string;
}): PreviewRequestPayload {
  const startDateTime = new Date(`${params.selectedDate}T${params.startTime}`);
  const endDateTime = new Date(`${params.selectedDate}T${params.endTime}`);

  return {
    facilityId: params.facilityId,
    startTime: startDateTime.toISOString(),
    endTime: endDateTime.toISOString(),
    promoCode: params.promoCode?.trim() || undefined,
  };
}

export function isSamePreviewPayload(
  first: PreviewRequestPayload,
  second: PreviewRequestPayload
): boolean {
  return (
    first.facilityId === second.facilityId &&
    first.startTime === second.startTime &&
    first.endTime === second.endTime &&
    (first.promoCode ?? '').trim().toUpperCase() ===
      (second.promoCode ?? '').trim().toUpperCase()
  );
}

export function buildPreviewCacheKey(payload: PreviewRequestPayload): string {
  const promo = (payload.promoCode ?? '').trim().toUpperCase();
  return [payload.facilityId, payload.startTime, payload.endTime, promo].join(
    '|'
  );
}
