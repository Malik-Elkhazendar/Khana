import { BookingListItemDto, BookingStatus } from '@khana/shared-dtos';

export type BookingStatusTone = 'success' | 'warning' | 'danger' | 'default';
export type BookingStatusFilter = BookingStatus | 'ALL' | 'ON_HOLD';

export const SEARCH_DEBOUNCE_MS = 300;
export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
export const E164_PHONE_REGEX = /^\+[1-9]\d{6,14}$/;
export const SAUDI_PHONE_REGEX = /^(?:\+966|00966|966|0)?5\d{8}$/;

export const resolveBookingPrice = (
  booking: BookingListItemDto
): { amount: number; currency: string } => {
  const currency = booking.currency || 'SAR';
  const totalAmount = booking.totalAmount;
  if (typeof totalAmount === 'number' && !Number.isNaN(totalAmount)) {
    return { amount: totalAmount, currency };
  }
  if (typeof totalAmount === 'string' && totalAmount.trim().length > 0) {
    const parsed = Number(totalAmount);
    if (!Number.isNaN(parsed)) {
      return { amount: parsed, currency };
    }
  }

  const pricePerHour = booking.facility?.config?.pricePerHour ?? 0;
  const start = new Date(booking.startTime).getTime();
  const end = new Date(booking.endTime).getTime();
  const hours = Math.max(0, (end - start) / (60 * 60 * 1000));
  const amount = Math.round(pricePerHour * hours);
  return { amount, currency };
};
