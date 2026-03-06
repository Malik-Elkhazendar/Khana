import {
  ChangeDetectionStrategy,
  Component,
  computed,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import {
  DEFAULT_TENANT_TIMEZONE,
  UserRole,
  isValidIanaTimeZone,
} from '@khana/shared-dtos';
import { AuthStore } from '../../shared/state/auth.store';
import { AuthService } from '../../shared/services/auth.service';
import { ApiService } from '../../shared/services/api.service';
import { LanguageService } from '../../shared/services/language.service';
import { SettingsScopeBadgeComponent } from './settings-scope-badge.component';

type TenantContext = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
};

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, TranslateModule, SettingsScopeBadgeComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent implements OnInit {
  private readonly authStore = inject(AuthStore);
  private readonly authService = inject(AuthService);
  private readonly api = inject(ApiService);
  private readonly languageService = inject(LanguageService);
  private readonly router = inject(Router);

  readonly currentUser = this.authStore.user;
  readonly tenantContext = signal<TenantContext | null>(null);
  readonly tenantLoading = signal(false);
  readonly tenantError = signal<string | null>(null);
  readonly timezoneLoading = signal(false);
  readonly timezoneSaving = signal(false);
  readonly timezoneError = signal<string | null>(null);
  readonly timezoneMessage = signal<string | null>(null);
  readonly timezoneInput = signal(DEFAULT_TENANT_TIMEZONE);
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
  readonly timezoneOptions = this.getTimezoneOptions();
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

  ngOnInit(): void {
    this.loadTenantContext();
    this.loadTimezoneSettings();
    this.loadGoalSettings();
  }

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

  loadTimezoneSettings(): void {
    this.timezoneLoading.set(true);
    this.timezoneError.set(null);

    this.api.getTenantSettings().subscribe({
      next: (settings) => {
        this.timezoneInput.set(settings.timezone || DEFAULT_TENANT_TIMEZONE);
        this.authService.setTenantTimeZone(settings.timezone);
        this.timezoneLoading.set(false);
      },
      error: () => {
        this.timezoneError.set('DASHBOARD.PAGES.SETTINGS.TIMEZONE.LOAD_ERROR');
        this.timezoneLoading.set(false);
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

  loadGoalSettings(): void {
    this.goalsLoading.set(true);
    this.goalsError.set(null);

    this.api.getGoalSettings().subscribe({
      next: (settings) => {
        this.monthlyRevenueTarget.set(
          settings.monthlyRevenueTarget === null
            ? ''
            : `${settings.monthlyRevenueTarget}`
        );
        this.monthlyOccupancyTarget.set(
          settings.monthlyOccupancyTarget === null
            ? ''
            : `${settings.monthlyOccupancyTarget}`
        );
        this.goalShouldShowNudge.set(settings.shouldShowNudge);
        this.goalsLoading.set(false);
      },
      error: () => {
        this.goalsError.set('DASHBOARD.PAGES.SETTINGS.GOALS.LOAD_ERROR');
        this.goalsLoading.set(false);
      },
    });
  }

  saveGoals(): void {
    if (!this.isOwner()) {
      return;
    }

    const revenueRaw = this.monthlyRevenueTarget().trim();
    const occupancyRaw = this.monthlyOccupancyTarget().trim();
    const revenueTarget = revenueRaw === '' ? null : Number(revenueRaw);
    const occupancyTarget = occupancyRaw === '' ? null : Number(occupancyRaw);

    if (
      (revenueTarget !== null &&
        (!Number.isFinite(revenueTarget) || revenueTarget < 0.01)) ||
      (occupancyTarget !== null &&
        (!Number.isFinite(occupancyTarget) ||
          occupancyTarget < 0.01 ||
          occupancyTarget > 100))
    ) {
      this.goalsError.set('DASHBOARD.PAGES.SETTINGS.GOALS.VALIDATION_ERROR');
      this.goalsMessage.set(null);
      return;
    }

    this.goalsSaving.set(true);
    this.goalsError.set(null);
    this.goalsMessage.set(null);

    this.api
      .updateGoalSettings({
        monthlyRevenueTarget: revenueTarget,
        monthlyOccupancyTarget: occupancyTarget,
      })
      .subscribe({
        next: (settings) => {
          this.monthlyRevenueTarget.set(
            settings.monthlyRevenueTarget === null
              ? ''
              : `${settings.monthlyRevenueTarget}`
          );
          this.monthlyOccupancyTarget.set(
            settings.monthlyOccupancyTarget === null
              ? ''
              : `${settings.monthlyOccupancyTarget}`
          );
          this.goalShouldShowNudge.set(settings.shouldShowNudge);
          this.goalsMessage.set('DASHBOARD.PAGES.SETTINGS.GOALS.SAVE_SUCCESS');
          this.goalsSaving.set(false);
        },
        error: () => {
          this.goalsError.set('DASHBOARD.PAGES.SETTINGS.GOALS.SAVE_ERROR');
          this.goalsSaving.set(false);
        },
      });
  }

  private getTimezoneOptions(): string[] {
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
}
