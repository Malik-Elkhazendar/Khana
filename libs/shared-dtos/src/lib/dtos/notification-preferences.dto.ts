export const NOTIFICATION_CHANNELS = ['WHATSAPP', 'EMAIL'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const DIGEST_TYPES = ['MORNING', 'WEEKLY'] as const;
export type DigestType = (typeof DIGEST_TYPES)[number];

export const REALTIME_ALERT_TYPES = [
  'BOOKING_CREATED',
  'BOOKING_CANCELLED',
  'HOLD_EXPIRING',
] as const;
export type RealtimeAlertType = (typeof REALTIME_ALERT_TYPES)[number];

/**
 * Time-of-day is stored as "HH:mm" in tenant local time.
 * Example: "07:00"
 */
export type LocalTimeString = `${number}${number}:${number}${number}`;

export interface NotificationChannelPreferenceDto {
  /**
   * Whether this channel is enabled for the notification intent.
   */
  enabled: boolean;
}

export interface DigestChannelPreferencesDto {
  whatsapp: NotificationChannelPreferenceDto;
  email: NotificationChannelPreferenceDto;
}

export interface RealtimeChannelPreferencesDto {
  whatsapp: NotificationChannelPreferenceDto;
  email: NotificationChannelPreferenceDto;
}

export interface MorningDigestPreferenceDto {
  enabled: boolean;

  /**
   * Tenant-local send time.
   * Example: "07:00"
   */
  sendTime: LocalTimeString;

  channels: DigestChannelPreferencesDto;
}

export interface WeeklySummaryPreferenceDto {
  enabled: boolean;

  /**
   * 0 = Sunday, aligned with product requirement.
   */
  dayOfWeek: 0;

  /**
   * Tenant-local send time.
   * Example: "19:00"
   */
  sendTime: LocalTimeString;

  channels: DigestChannelPreferencesDto;
}

export interface BookingCreatedAlertPreferenceDto {
  enabled: boolean;
  channels: RealtimeChannelPreferencesDto;
}

export interface BookingCancelledAlertPreferenceDto {
  enabled: boolean;
  channels: RealtimeChannelPreferencesDto;
}

export interface HoldExpiringAlertPreferenceDto {
  enabled: boolean;

  /**
   * Number of minutes before hold expiry to notify.
   * Current product requirement is 30.
   */
  leadMinutes: number;

  channels: RealtimeChannelPreferencesDto;
}

/**
 * Tenant-level notification preferences.
 * This is intentionally grouped by use case, not by transport only.
 */
export interface NotificationPreferencesDto {
  morningDigest: MorningDigestPreferenceDto;
  weeklySummary: WeeklySummaryPreferenceDto;
  bookingCreated: BookingCreatedAlertPreferenceDto;
  bookingCancelled: BookingCancelledAlertPreferenceDto;
  holdExpiring: HoldExpiringAlertPreferenceDto;
}

/**
 * Returned by GET /settings and accepted by PATCH /settings
 * as part of the broader tenant settings payload.
 */
export interface NotificationPreferencesSettingsDto {
  notificationPreferences: NotificationPreferencesDto;
}

/**
 * Patch payload for updating only notification preferences.
 * Partial because settings updates are incremental.
 */
export interface UpdateNotificationPreferencesDto {
  notificationPreferences?: Partial<NotificationPreferencesDto>;
}

/**
 * Safe defaults for new tenants.
 * These defaults are product decisions, not runtime scheduling logic.
 */
export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferencesDto = {
  morningDigest: {
    enabled: true,
    sendTime: '07:00',
    channels: {
      whatsapp: { enabled: true },
      email: { enabled: true },
    },
  },
  weeklySummary: {
    enabled: true,
    dayOfWeek: 0,
    sendTime: '19:00',
    channels: {
      whatsapp: { enabled: false },
      email: { enabled: true },
    },
  },
  bookingCreated: {
    enabled: true,
    channels: {
      whatsapp: { enabled: true },
      email: { enabled: false },
    },
  },
  bookingCancelled: {
    enabled: true,
    channels: {
      whatsapp: { enabled: true },
      email: { enabled: false },
    },
  },
  holdExpiring: {
    enabled: true,
    leadMinutes: 30,
    channels: {
      whatsapp: { enabled: true },
      email: { enabled: false },
    },
  },
};
