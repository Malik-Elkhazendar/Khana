import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthStore } from '../../shared/state/auth.store';
import { AuthService } from '../../shared/services/auth.service';
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
  private readonly languageService = inject(LanguageService);
  private readonly router = inject(Router);

  readonly currentUser = this.authStore.user;
  readonly tenantContext = signal<TenantContext | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly securityMessage = signal<string | null>(null);
  readonly securityError = signal<string | null>(null);

  ngOnInit(): void {
    this.loadTenantContext();
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
}
