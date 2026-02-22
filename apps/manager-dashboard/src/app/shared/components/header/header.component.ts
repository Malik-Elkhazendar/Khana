import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { patchState, signalState } from '@ngrx/signals';
import { TranslateModule } from '@ngx-translate/core';
import { AuthStore } from '../../state/auth.store';
import { AuthService } from '../../services/auth.service';
import { LayoutStore } from '../../state/layout.store';
import { DASHBOARD_NAV_ITEMS } from '../../navigation/dashboard-nav';
import { LanguageSwitcherComponent } from '../language-switcher/language-switcher.component';
import { UiIconComponent } from '../ui';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    UiIconComponent,
    LanguageSwitcherComponent,
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  readonly navItems = DASHBOARD_NAV_ITEMS;
  readonly userMenuId = 'app-header-user-menu';

  private readonly authStore = inject(AuthStore);
  private readonly authService = inject(AuthService);
  private readonly layoutStore = inject(LayoutStore);

  private readonly state = signalState({
    userMenuOpen: false,
  });

  readonly userMenuOpen = this.state.userMenuOpen;
  readonly currentUser = this.authStore.user;
  readonly mobileDrawerOpen = this.layoutStore.mobileDrawerOpen;

  toggleMobileMenu(): void {
    patchState(this.state, {
      userMenuOpen: false,
    });
    this.layoutStore.toggleMobileDrawer();
  }

  toggleUserMenu(): void {
    patchState(this.state, {
      userMenuOpen: !this.userMenuOpen(),
    });
  }

  onNavClick(): void {
    patchState(this.state, {
      userMenuOpen: false,
    });
    this.layoutStore.closeMobileDrawer();
  }

  logout(): void {
    patchState(this.state, {
      userMenuOpen: false,
    });
    this.layoutStore.closeMobileDrawer();
    this.authService.logout();
  }

  trackByRoute(_: number, item: { route: string }): string {
    return item.route;
  }
}
