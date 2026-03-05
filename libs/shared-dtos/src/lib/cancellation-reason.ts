import { BookingCancellationReasonKey } from './enums';

export type ParsedCancellationReason = {
  isValid: boolean;
  key: BookingCancellationReasonKey | null;
  note: string | null;
  raw: string;
};

export const isBookingCancellationReasonKey = (
  value: unknown
): value is BookingCancellationReasonKey => {
  return (
    typeof value === 'string' &&
    (Object.values(BookingCancellationReasonKey) as string[]).includes(value)
  );
};

/**
 * Serialize cancellation reason into canonical storage format.
 * - Non-other reasons are stored as key.
 * - "other" may include an optional free-text note: "other|<note>".
 */
export const serializeCancellationReason = (
  key: BookingCancellationReasonKey,
  note?: string | null
): string => {
  if (key !== BookingCancellationReasonKey.OTHER) {
    return key;
  }

  const trimmedNote = note?.trim() ?? '';
  return trimmedNote ? `${key}|${trimmedNote}` : key;
};

/**
 * Parse a canonical cancellation reason string.
 * Returns { isValid: false } when key is missing/unknown.
 */
export const parseCancellationReason = (
  value: string | null | undefined
): ParsedCancellationReason => {
  const normalized = value?.trim() ?? '';
  if (!normalized) {
    return {
      isValid: false,
      key: null,
      note: null,
      raw: normalized,
    };
  }

  const [rawKey, ...noteParts] = normalized.split('|');
  if (!isBookingCancellationReasonKey(rawKey)) {
    return {
      isValid: false,
      key: null,
      note: null,
      raw: normalized,
    };
  }

  const note = noteParts.join('|').trim();
  return {
    isValid: true,
    key: rawKey,
    note: note.length > 0 ? note : null,
    raw: normalized,
  };
};
