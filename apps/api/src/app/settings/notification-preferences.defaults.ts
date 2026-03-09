import { NotificationPreferencesDto } from '@khana/shared-dtos';

/**
 * Backend-owned defaults for tenant notification preferences.
 * These are product defaults used when a tenant has not saved preferences yet.
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

export function cloneDefaultNotificationPreferences(): NotificationPreferencesDto {
  return structuredClone(DEFAULT_NOTIFICATION_PREFERENCES);
}
