export const DEFAULT_TENANT_TIMEZONE = 'Asia/Riyadh';

const IANA_TIMEZONE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: DEFAULT_TENANT_TIMEZONE,
});

const normalizeTimeZone = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim();
};

export const isValidIanaTimeZone = (value: unknown): boolean => {
  const normalized = normalizeTimeZone(value);
  if (!normalized) {
    return false;
  }

  try {
    IANA_TIMEZONE_FORMATTER.resolvedOptions();
    Intl.DateTimeFormat('en-US', { timeZone: normalized }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

export const normalizeIanaTimeZone = (value: unknown): string =>
  isValidIanaTimeZone(value)
    ? (value as string).trim()
    : DEFAULT_TENANT_TIMEZONE;
