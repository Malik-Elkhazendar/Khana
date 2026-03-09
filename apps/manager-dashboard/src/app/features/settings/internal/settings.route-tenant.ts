import {
  DEFAULT_TENANT_TIMEZONE,
  isValidIanaTimeZone,
} from '@khana/shared-dtos';
import { SettingsRouteState } from './settings.route-state';

/**
 * Account, tenant, timezone, and security workflows for the settings route.
 * These are user-initiated flows with their own loading and error lifecycles.
 */
export abstract class SettingsRouteTenantBase extends SettingsRouteState {
  loadTenantContext(): void {
    this.tenantLoading.set(true);
    this.tenantError.set(null);

    this.authService.getTenantContext().subscribe({
      next: (tenant) => {
        this.tenantContext.set(tenant);
        this.authService.setTenantTimeZone(tenant.timezone);
        this.tenantLoading.set(false);
      },
      error: () => {
        this.tenantLoading.set(false);
        this.tenantError.set('DASHBOARD.PAGES.SETTINGS.ORGANIZATION.ERROR');
      },
    });
  }

  loadTenantSettings(): void {
    this.timezoneLoading.set(true);
    this.notificationLoading.set(true);
    this.timezoneError.set(null);
    this.notificationError.set(null);

    this.api.getTenantSettings().subscribe({
      next: (settings) => {
        this.timezoneInput.set(settings.timezone || DEFAULT_TENANT_TIMEZONE);
        this.authService.setTenantTimeZone(settings.timezone);
        this.notificationPreferences.set(
          settings.notificationPreferences ?? null
        );
        this.timezoneLoading.set(false);
        this.notificationLoading.set(false);
      },
      error: () => {
        this.timezoneError.set('DASHBOARD.PAGES.SETTINGS.TIMEZONE.LOAD_ERROR');
        this.notificationError.set(
          'DASHBOARD.PAGES.SETTINGS.NOTIFICATIONS.LOAD_ERROR'
        );
        this.timezoneLoading.set(false);
        this.notificationLoading.set(false);
      },
    });
  }

  toggleLanguage(): void {
    this.languageService.toggleLanguage();
  }

  onTimezoneInput(value: string): void {
    this.timezoneInput.set(value ?? '');
    this.timezoneError.set(null);
    this.timezoneMessage.set(null);
  }

  saveTimezone(): void {
    if (!this.canManageTenantSettings()) {
      return;
    }

    const timeZone = this.timezoneInput().trim();
    if (!isValidIanaTimeZone(timeZone)) {
      this.timezoneError.set('DASHBOARD.PAGES.SETTINGS.TIMEZONE.INVALID');
      this.timezoneMessage.set(null);
      return;
    }

    this.timezoneSaving.set(true);
    this.timezoneError.set(null);
    this.timezoneMessage.set(null);

    this.api.updateTenantSettings({ timezone: timeZone }).subscribe({
      next: (settings) => {
        this.timezoneInput.set(settings.timezone);
        this.authService.setTenantTimeZone(settings.timezone);
        this.timezoneSaving.set(false);
        this.timezoneMessage.set(
          'DASHBOARD.PAGES.SETTINGS.TIMEZONE.SAVE_SUCCESS'
        );
      },
      error: () => {
        this.timezoneSaving.set(false);
        this.timezoneError.set('DASHBOARD.PAGES.SETTINGS.TIMEZONE.SAVE_ERROR');
      },
    });
  }

  navigateToChangePassword(): void {
    this.router.navigateByUrl('/change-password');
  }

  logoutAllDevices(): void {
    this.securityMessage.set(null);
    this.securityError.set(null);

    this.authService.logoutAllDevices().subscribe({
      next: () => {
        this.securityMessage.set('DASHBOARD.PAGES.SETTINGS.LOGOUT_ALL_SUCCESS');
      },
      error: () => {
        this.securityError.set('DASHBOARD.PAGES.SETTINGS.LOGOUT_ALL_ERROR');
      },
    });
  }
}
