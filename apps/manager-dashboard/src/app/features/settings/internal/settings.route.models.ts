import {
  DEFAULT_TENANT_TIMEZONE,
  NotificationDeliveryPreferencesDto,
  NotificationWeekday,
} from '@khana/shared-dtos';

export type TenantContext = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
};

export type ScheduledPreferenceKey = 'morningDigest' | 'weeklySummary';
export type RealtimePreferenceKey =
  | 'bookingCreated'
  | 'bookingCancelled'
  | 'holdExpiring';
export type NotificationPreferenceKey =
  | ScheduledPreferenceKey
  | RealtimePreferenceKey;
export type NotificationChannelKey = keyof NotificationDeliveryPreferencesDto;
export type NotificationGroupKey = 'DIGESTS' | 'REALTIME';

export type NotificationCardConfig = {
  key: NotificationPreferenceKey;
  titleKey: string;
  descriptionKey: string;
  showSendTime?: boolean;
  showDayOfWeek?: boolean;
  showLeadMinutes?: boolean;
};

export type WeekdayOption = {
  value: NotificationWeekday;
  labelKey: string;
};

export type NotificationGroupConfig = {
  key: NotificationGroupKey;
  cards: ReadonlyArray<NotificationCardConfig>;
};

export const WEEKDAY_OPTIONS: ReadonlyArray<WeekdayOption> = [
  {
    value: 0,
    labelKey: 'DASHBOARD.PAGES.SETTINGS.NOTIFICATIONS.DAY_OPTIONS.0',
  },
  {
    value: 1,
    labelKey: 'DASHBOARD.PAGES.SETTINGS.NOTIFICATIONS.DAY_OPTIONS.1',
  },
  {
    value: 2,
    labelKey: 'DASHBOARD.PAGES.SETTINGS.NOTIFICATIONS.DAY_OPTIONS.2',
  },
  {
    value: 3,
    labelKey: 'DASHBOARD.PAGES.SETTINGS.NOTIFICATIONS.DAY_OPTIONS.3',
  },
  {
    value: 4,
    labelKey: 'DASHBOARD.PAGES.SETTINGS.NOTIFICATIONS.DAY_OPTIONS.4',
  },
  {
    value: 5,
    labelKey: 'DASHBOARD.PAGES.SETTINGS.NOTIFICATIONS.DAY_OPTIONS.5',
  },
  {
    value: 6,
    labelKey: 'DASHBOARD.PAGES.SETTINGS.NOTIFICATIONS.DAY_OPTIONS.6',
  },
];

export const DIGEST_NOTIFICATION_CARDS: ReadonlyArray<NotificationCardConfig> =
  [
    {
      key: 'morningDigest',
      titleKey: 'DASHBOARD.PAGES.SETTINGS.NOTIFICATIONS.MORNING_DIGEST.TITLE',
      descriptionKey:
        'DASHBOARD.PAGES.SETTINGS.NOTIFICATIONS.MORNING_DIGEST.DESCRIPTION',
      showSendTime: true,
    },
    {
      key: 'weeklySummary',
      titleKey: 'DASHBOARD.PAGES.SETTINGS.NOTIFICATIONS.WEEKLY_SUMMARY.TITLE',
      descriptionKey:
        'DASHBOARD.PAGES.SETTINGS.NOTIFICATIONS.WEEKLY_SUMMARY.DESCRIPTION',
      showSendTime: true,
      showDayOfWeek: true,
    },
  ];

export const REALTIME_NOTIFICATION_CARDS: ReadonlyArray<NotificationCardConfig> =
  [
    {
      key: 'bookingCreated',
      titleKey: 'DASHBOARD.PAGES.SETTINGS.NOTIFICATIONS.BOOKING_CREATED.TITLE',
      descriptionKey:
        'DASHBOARD.PAGES.SETTINGS.NOTIFICATIONS.BOOKING_CREATED.DESCRIPTION',
    },
    {
      key: 'bookingCancelled',
      titleKey:
        'DASHBOARD.PAGES.SETTINGS.NOTIFICATIONS.BOOKING_CANCELLED.TITLE',
      descriptionKey:
        'DASHBOARD.PAGES.SETTINGS.NOTIFICATIONS.BOOKING_CANCELLED.DESCRIPTION',
    },
    {
      key: 'holdExpiring',
      titleKey: 'DASHBOARD.PAGES.SETTINGS.NOTIFICATIONS.HOLD_EXPIRING.TITLE',
      descriptionKey:
        'DASHBOARD.PAGES.SETTINGS.NOTIFICATIONS.HOLD_EXPIRING.DESCRIPTION',
      showLeadMinutes: true,
    },
  ];

export const NOTIFICATION_GROUPS: ReadonlyArray<NotificationGroupConfig> = [
  {
    key: 'DIGESTS',
    cards: DIGEST_NOTIFICATION_CARDS,
  },
  {
    key: 'REALTIME',
    cards: REALTIME_NOTIFICATION_CARDS,
  },
];

export function getTimezoneOptions(): string[] {
  const intl = globalThis.Intl as typeof globalThis.Intl & {
    supportedValuesOf?: (key: 'timeZone') => string[];
  };
  const supported =
    typeof intl.supportedValuesOf === 'function'
      ? intl.supportedValuesOf('timeZone')
      : [];
  const defaults = ['Africa/Cairo', 'Europe/Istanbul', 'UTC'];

  return Array.from(
    new Set([DEFAULT_TENANT_TIMEZONE, ...defaults, ...supported])
  ).sort((left, right) => left.localeCompare(right));
}
