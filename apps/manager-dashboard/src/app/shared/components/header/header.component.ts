import {
  ChangeDetectionStrategy,
  Component,
  Input,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { patchState, signalState } from '@ngrx/signals';
import { AuthStore } from '../../state/auth.store';
import { AuthService } from '../../services/auth.service';

type NavItem = {
  label: string;
  route: string | null;
};

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeaderComponent {
  readonly navItems: NavItem[] = [
    { label: 'Dashboard', route: '/bookings' },
    { label: 'Bookings', route: '/calendar' },
    { label: 'Facilities', route: null },
    { label: 'Settings', route: null },
  ];

  readonly mobileMenuId = 'app-header-mobile-menu';
  readonly userMenuId = 'app-header-user-menu';

  // Auth integration
  private readonly authStore = inject(AuthStore);
  private readonly authService = inject(AuthService);

  private readonly state = signalState({
    mobileMenuOpen: false,
    userMenuOpen: false,
  });

  readonly mobileMenuOpen = this.state.mobileMenuOpen;
  readonly userMenuOpen = this.state.userMenuOpen;
  readonly currentUser = this.authStore.user;

  private readonly router = inject(Router);

  toggleMobileMenu(): void {
    patchState(this.state, {
      mobileMenuOpen: !this.mobileMenuOpen(),
      userMenuOpen: false,
    });
  }

  toggleUserMenu(): void {
    patchState(this.state, {
      userMenuOpen: !this.userMenuOpen(),
      mobileMenuOpen: false,
    });
  }

  navigate(route: string | null, event?: Event): void {
    event?.preventDefault();
    if (!route) {
      return;
    }
    void this.router.navigateByUrl(route);
    patchState(this.state, {
      mobileMenuOpen: false,
      userMenuOpen: false,
    });
  }

  logout(): void {
    patchState(this.state, {
      mobileMenuOpen: false,
      userMenuOpen: false,
    });
    this.authService.logout();
  }
}
