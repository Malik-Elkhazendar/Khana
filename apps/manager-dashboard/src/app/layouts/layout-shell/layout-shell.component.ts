import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import {
  HeaderComponent,
  MobileNavDrawerComponent,
  SidebarComponent,
} from '../../shared/components';
import { LayoutStore } from '../../shared/state/layout.store';

const MOBILE_BREAKPOINT = 768;
const DESKTOP_BREAKPOINT = 1024;

@Component({
  selector: 'app-layout-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    HeaderComponent,
    SidebarComponent,
    MobileNavDrawerComponent,
  ],
  templateUrl: './layout-shell.component.html',
  styleUrl: './layout-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayoutShellComponent {
  readonly layoutStore = inject(LayoutStore);
  readonly sidebarCollapsed = this.layoutStore.sidebarCollapsed;

  private readonly viewportWidth = signal(
    typeof window === 'undefined' ? DESKTOP_BREAKPOINT : window.innerWidth
  );

  readonly isDesktop = computed(
    () => this.viewportWidth() >= DESKTOP_BREAKPOINT
  );
  readonly showSidebar = computed(
    () => this.viewportWidth() >= MOBILE_BREAKPOINT
  );

  constructor() {
    this.applyViewportState(this.viewportWidth());
  }

  @HostListener('window:resize')
  onResize(): void {
    const width =
      typeof window === 'undefined' ? DESKTOP_BREAKPOINT : window.innerWidth;
    this.applyViewportState(width);
  }

  private applyViewportState(width: number): void {
    const isDesktop = width >= DESKTOP_BREAKPOINT;
    const isTablet = width >= MOBILE_BREAKPOINT && width < DESKTOP_BREAKPOINT;

    this.viewportWidth.set(width);

    if (isDesktop || isTablet) {
      this.layoutStore.closeMobileDrawer();
    }

    if (isDesktop) {
      if (this.sidebarCollapsed()) {
        this.layoutStore.toggleSidebar();
      }
    } else if (isTablet) {
      if (!this.sidebarCollapsed()) {
        this.layoutStore.toggleSidebar();
      }
    }
  }
}
