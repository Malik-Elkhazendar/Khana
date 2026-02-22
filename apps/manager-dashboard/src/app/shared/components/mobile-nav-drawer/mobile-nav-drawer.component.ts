import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  effect,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { LayoutStore } from '../../state/layout.store';
import { DASHBOARD_NAV_ITEMS } from '../../navigation/dashboard-nav';
import { LanguageSwitcherComponent } from '../language-switcher/language-switcher.component';
import { UiIconComponent } from '../ui';

@Component({
  selector: 'app-mobile-nav-drawer',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    UiIconComponent,
    LanguageSwitcherComponent,
  ],
  templateUrl: './mobile-nav-drawer.component.html',
  styleUrl: './mobile-nav-drawer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileNavDrawerComponent implements OnDestroy {
  @ViewChild('drawerPanel') drawerPanel?: ElementRef<HTMLElement>;
  @ViewChild('closeButton') closeButton?: ElementRef<HTMLButtonElement>;

  readonly navItems = DASHBOARD_NAV_ITEMS;
  readonly layoutStore = inject(LayoutStore);

  private lastFocusedElement: HTMLElement | null = null;
  private wasOpen = false;

  constructor() {
    effect(() => {
      const isOpen = this.layoutStore.mobileDrawerOpen();

      if (isOpen && !this.wasOpen) {
        this.wasOpen = true;
        this.captureFocus();
        this.focusCloseButton();
        return;
      }

      if (!isOpen && this.wasOpen) {
        this.wasOpen = false;
        this.restoreFocus();
      }
    });
  }

  ngOnDestroy(): void {
    this.restoreFocus();
  }

  closeDrawer(): void {
    this.layoutStore.closeMobileDrawer();
  }

  onOverlayClick(): void {
    this.closeDrawer();
  }

  onNavClick(): void {
    this.closeDrawer();
  }

  trackByRoute(_: number, item: { route: string }): string {
    return item.route;
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.layoutStore.mobileDrawerOpen()) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.closeDrawer();
      return;
    }

    if (event.key !== 'Tab') return;
    this.trapFocus(event);
  }

  private captureFocus(): void {
    this.lastFocusedElement = document.activeElement as HTMLElement | null;
  }

  private focusCloseButton(): void {
    setTimeout(() => {
      this.closeButton?.nativeElement?.focus();
    }, 0);
  }

  private restoreFocus(): void {
    if (!this.lastFocusedElement) return;
    const target = this.lastFocusedElement;
    this.lastFocusedElement = null;
    setTimeout(() => {
      target.focus();
    }, 0);
  }

  private trapFocus(event: KeyboardEvent): void {
    event.stopPropagation();

    const panel = this.drawerPanel?.nativeElement;
    if (!panel) return;
    const focusable = this.getFocusableElements(panel);
    if (focusable.length === 0) {
      event.preventDefault();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (!panel.contains(active)) {
      event.preventDefault();
      first.focus();
      return;
    }

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private getFocusableElements(container: HTMLElement): HTMLElement[] {
    const selectors = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ];
    return Array.from(
      container.querySelectorAll<HTMLElement>(selectors.join(','))
    );
  }
}
