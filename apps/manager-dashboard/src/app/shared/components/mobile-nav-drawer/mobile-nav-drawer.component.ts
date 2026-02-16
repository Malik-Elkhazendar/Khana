import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  OnDestroy,
  Output,
  ViewChild,
  effect,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { LayoutStore } from '../../state/layout.store';

type NavItem = {
  label: string;
  route: string | null;
};

@Component({
  selector: 'app-mobile-nav-drawer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './mobile-nav-drawer.component.html',
  styleUrl: './mobile-nav-drawer.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MobileNavDrawerComponent implements OnDestroy {
  @Output() navigate = new EventEmitter<string>();

  @ViewChild('drawerPanel') drawerPanel?: ElementRef<HTMLElement>;
  @ViewChild('closeButton') closeButton?: ElementRef<HTMLButtonElement>;

  readonly navItems: NavItem[] = [
    { label: 'Dashboard', route: '/bookings' },
    { label: 'Bookings', route: '/calendar' },
    { label: 'Facilities', route: null },
    { label: 'Settings', route: null },
  ];

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

  onNavClick(item: NavItem, event: Event): void {
    if (!item.route) return;
    event.preventDefault();
    this.navigate.emit(item.route);
    this.closeDrawer();
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
