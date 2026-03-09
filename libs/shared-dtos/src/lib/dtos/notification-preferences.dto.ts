/**
 * Shared DTO contract for tenant notification preferences.
 */

export type LocalTimeString = `${number}${number}:${number}${number}`;

export type NotificationWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface NotificationChannelPreferenceDto {
  enabled: boolean;
}

export interface NotificationDeliveryPreferencesDto {
  whatsapp: NotificationChannelPreferenceDto;
  email: NotificationChannelPreferenceDto;
}

export interface ScheduledNotificationPreferenceDto {
  enabled: boolean;
  sendTime: LocalTimeString;
  channels: NotificationDeliveryPreferencesDto;
}

export interface WeeklySummaryPreferenceDto
  extends ScheduledNotificationPreferenceDto {
  dayOfWeek: NotificationWeekday;
}

export interface RealtimeNotificationPreferenceDto {
  enabled: boolean;
  channels: NotificationDeliveryPreferencesDto;
}

export interface HoldExpiringAlertPreferenceDto {
  enabled: boolean;
  leadMinutes: number;
  channels: NotificationDeliveryPreferencesDto;
}

export interface NotificationPreferencesDto {
  morningDigest: ScheduledNotificationPreferenceDto;
  weeklySummary: WeeklySummaryPreferenceDto;
  bookingCreated: RealtimeNotificationPreferenceDto;
  bookingCancelled: RealtimeNotificationPreferenceDto;
  holdExpiring: HoldExpiringAlertPreferenceDto;
}
