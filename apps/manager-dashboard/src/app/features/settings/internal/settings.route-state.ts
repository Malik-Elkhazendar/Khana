import { computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  DEFAULT_TENANT_TIMEZONE,
  NotificationPreferencesDto,
  UserRole,
} from '@khana/shared-dtos';
import { AuthService } from '../../../shared/services/auth.service';
import { ApiService } from '../../../shared/services/api.service';
import { LanguageService } from '../../../shared/services/language.service';
import { AuthStore } from '../../../shared/state/auth.store';
import {
  getTimezoneOptions,
  NOTIFICATION_GROUPS,
  NotificationChannelKey,
  NotificationGroupKey,
  NotificationPreferenceKey,
  TenantContext,
  WEEKDAY_OPTIONS,
} from './settings.route.models';

/**
 * Route state for the settings page.
 * The shell component inherits these signals and computed properties so the
 * page template stays stable while workflow code moves out of the root file.
 */
export abstract class SettingsRouteState {
  protected readonly authStore = inject(AuthStore);
  protected readonly authService = inject(AuthService);
  protected readonly api = inject(ApiService);
  protected readonly languageService = inject(LanguageService);
  protected readonly router = inject(Router);

  readonly currentUser = this.authStore.user;
  readonly tenantContext = signal<TenantContext | null>(null);
  readonly tenantLoading = signal(false);
  readonly tenantError = signal<string | null>(null);
  readonly timezoneLoading = signal(false);
  readonly timezoneSaving = signal(false);
  readonly timezoneError = signal<string | null>(null);
  readonly timezoneMessage = signal<string | null>(null);
  readonly timezoneInput = signal(DEFAULT_TENANT_TIMEZONE);
  readonly notificationLoading = signal(false);
  readonly notificationSaving = signal(false);
  readonly notificationError = signal<string | null>(null);
  readonly notificationMessage = signal<string | null>(null);
  readonly notificationPreferences = signal<NotificationPreferencesDto | null>(
    null
  );
  readonly securityMessage = signal<string | null>(null);
  readonly securityError = signal<string | null>(null);
  readonly goalsLoading = signal(false);
  readonly goalsSaving = signal(false);
  readonly goalsError = signal<string | null>(null);
  readonly goalsMessage = signal<string | null>(null);
  readonly monthlyRevenueTarget = signal('');
  readonly monthlyOccupancyTarget = signal('');
  readonly goalShouldShowNudge = signal(false);

  readonly isOwner = computed(
    () => this.currentUser()?.role === UserRole.OWNER
  );
  readonly canManageTenantSettings = computed(() => {
    const role = this.currentUser()?.role;
    return role === UserRole.OWNER || role === UserRole.MANAGER;
  });
  readonly timezoneOptions = getTimezoneOptions();
  readonly filteredTimezoneOptions = computed(() => {
    const query = this.timezoneInput().trim().toLowerCase();
    if (!query) {
      return this.timezoneOptions;
    }

    return this.timezoneOptions.filter((timeZone) =>
      timeZone.toLowerCase().includes(query)
    );
  });
  readonly roleLabelKey = computed(() => {
    const role = this.currentUser()?.role;
    if (!role) {
      return null;
    }

    return `DASHBOARD.PAGES.TEAM.ROLES.${role}`;
  });
  readonly weekdayOptions = WEEKDAY_OPTIONS;
  readonly notificationGroups = NOTIFICATION_GROUPS;

  notificationGroupTitleKey(group: NotificationGroupKey): string {
    return `DASHBOARD.PAGES.SETTINGS.NOTIFICATIONS.GROUPS.${group}`;
  }

  notificationPreference(key: NotificationPreferenceKey) {
    const preferences = this.notificationPreferences();
    if (!preferences) {
      return null;
    }

    return preferences[key];
  }

  notificationChannelEnabled(
    key: NotificationPreferenceKey,
    channel: NotificationChannelKey
  ): boolean {
    return this.notificationPreference(key)?.channels[channel].enabled ?? false;
  }
}
