import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { patchState, signalState } from '@ngrx/signals';
import { TranslateModule } from '@ngx-translate/core';
import { AuthStore } from '../../state/auth.store';
import { AuthService } from '../../services/auth.service';
import { LayoutStore } from '../../state/layout.store';
import { getDashboardNavItemsForRole } from '../../navigation/dashboard-nav';
import { FacilitySwitcherComponent } from '../facility-switcher/facility-switcher.component';
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
    FacilitySwitcherComponent,
    LanguageSwitcherComponent,
  ],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  readonly userMenuId = 'app-header-user-menu';

  private readonly authStore = inject(AuthStore);
  private readonly authService = inject(AuthService);
  private readonly layoutStore = inject(LayoutStore);
  private readonly hostElement = inject(ElementRef<HTMLElement>);

  private readonly state = signalState({
    userMenuOpen: false,
  });

  readonly userMenuOpen = this.state.userMenuOpen;
  readonly currentUser = this.authStore.user;
  readonly mobileDrawerOpen = this.layoutStore.mobileDrawerOpen;
  readonly navItems = computed(() =>
    getDashboardNavItemsForRole(this.currentUser()?.role)
  );

  toggleMobileMenu(): void {
    this.closeUserMenu();
    this.layoutStore.toggleMobileDrawer();
  }

  toggleUserMenu(): void {
    patchState(this.state, {
      userMenuOpen: !this.userMenuOpen(),
    });
  }

  onNavClick(): void {
    this.closeUserMenu();
    this.layoutStore.closeMobileDrawer();
  }

  logout(): void {
    this.closeUserMenu();
    this.layoutStore.closeMobileDrawer();
    this.authService.logout();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.userMenuOpen()) {
      return;
    }

    const target = event.target;
    if (
      target instanceof Node &&
      !this.hostElement.nativeElement.contains(target)
    ) {
      this.closeUserMenu();
    }
  }

  @HostListener('document:keydown.escape', ['$event'])
  onDocumentEscape(event: Event): void {
    if (!this.userMenuOpen()) {
      return;
    }

    if (event instanceof KeyboardEvent) {
      event.preventDefault();
    }
    this.closeUserMenu();
  }

  trackByRoute(_: number, item: { route: string }): string {
    return item.route;
  }

  private closeUserMenu(): void {
    patchState(this.state, {
      userMenuOpen: false,
    });
  }
}
