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
import { UserRole } from '@khana/shared-dtos';
import { AuthStore } from '../../shared/state/auth.store';
import { AuthService } from '../../shared/services/auth.service';
import { ApiService } from '../../shared/services/api.service';
import { LanguageService } from '../../shared/services/language.service';

type TenantContext = {
  id: string;
  name: string;
};

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, TranslateModule],
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
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
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

  ngOnInit(): void {
    this.loadTenantContext();
    this.loadGoalSettings();
  }

  loadTenantContext(): void {
    this.loading.set(true);
    this.error.set(null);

    this.authService.getTenantContext().subscribe({
      next: (tenant) => {
        this.tenantContext.set(tenant);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('DASHBOARD.PAGES.SETTINGS.ERROR');
      },
    });
  }

  toggleLanguage(): void {
    this.languageService.toggleLanguage();
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
}
