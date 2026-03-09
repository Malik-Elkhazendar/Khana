import {
  NotificationPreferencesDto,
  NotificationWeekday,
} from '@khana/shared-dtos';
import {
  NotificationChannelKey,
  NotificationPreferenceKey,
  ScheduledPreferenceKey,
} from './settings.route.models';
import { SettingsRouteTenantBase } from './settings.route-tenant';

/**
 * Notification preference editing is isolated from the rest of the settings
 * route because it has a local draft state and save cycle.
 */
export abstract class SettingsRouteNotificationsBase extends SettingsRouteTenantBase {
  onNotificationEnabledChange(
    key: NotificationPreferenceKey,
    enabled: boolean
  ): void {
    this.patchNotificationPreferences((current) => ({
      ...current,
      [key]: {
        ...current[key],
        enabled,
      },
    }));
  }

  onNotificationChannelChange(
    key: NotificationPreferenceKey,
    channel: NotificationChannelKey,
    enabled: boolean
  ): void {
    this.patchNotificationPreferences((current) => ({
      ...current,
      [key]: {
        ...current[key],
        channels: {
          ...current[key].channels,
          [channel]: { enabled },
        },
      },
    }));
  }

  onScheduledSendTimeChange(
    key: ScheduledPreferenceKey,
    sendTime: string
  ): void {
    this.patchNotificationPreferences((current) => ({
      ...current,
      [key]: {
        ...current[key],
        sendTime,
      },
    }));
  }

  onWeeklySummaryDayOfWeekChange(dayOfWeek: string): void {
    const numericDay = Number(dayOfWeek) as NotificationWeekday;
    if (!Number.isInteger(numericDay) || numericDay < 0 || numericDay > 6) {
      return;
    }

    this.patchNotificationPreferences((current) => ({
      ...current,
      weeklySummary: {
        ...current.weeklySummary,
        dayOfWeek: numericDay,
      },
    }));
  }

  onHoldExpiringLeadMinutesChange(value: string): void {
    const leadMinutes = Number(value);
    if (!Number.isFinite(leadMinutes) || leadMinutes < 1) {
      return;
    }

    this.patchNotificationPreferences((current) => ({
      ...current,
      holdExpiring: {
        ...current.holdExpiring,
        leadMinutes,
      },
    }));
  }

  saveNotificationPreferences(): void {
    if (!this.canManageTenantSettings()) {
      return;
    }

    const notificationPreferences = this.notificationPreferences();
    if (!notificationPreferences) {
      return;
    }

    this.notificationSaving.set(true);
    this.notificationError.set(null);
    this.notificationMessage.set(null);

    this.api.updateTenantSettings({ notificationPreferences }).subscribe({
      next: (settings) => {
        this.notificationPreferences.set(
          settings.notificationPreferences ?? notificationPreferences
        );
        this.notificationSaving.set(false);
        this.notificationMessage.set(
          'DASHBOARD.PAGES.SETTINGS.NOTIFICATIONS.SAVE_SUCCESS'
        );
      },
      error: () => {
        this.notificationSaving.set(false);
        this.notificationError.set(
          'DASHBOARD.PAGES.SETTINGS.NOTIFICATIONS.SAVE_ERROR'
        );
      },
    });
  }

  protected patchNotificationPreferences(
    updater: (current: NotificationPreferencesDto) => NotificationPreferencesDto
  ): void {
    const current = this.notificationPreferences();
    if (!current) {
      return;
    }

    this.notificationPreferences.set(updater(current));
    this.notificationError.set(null);
    this.notificationMessage.set(null);
  }
}
