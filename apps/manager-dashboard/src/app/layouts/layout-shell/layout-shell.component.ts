import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import {
  ActivatedRouteSnapshot,
  NavigationEnd,
  Router,
  RouterModule,
} from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { filter } from 'rxjs';
import {
  DashboardBreadcrumbsComponent,
  HeaderComponent,
  MobileNavDrawerComponent,
  SidebarComponent,
} from '../../shared/components';
import { FacilityContextStore } from '../../shared/state';
import { LayoutStore } from '../../shared/state/layout.store';

const MOBILE_BREAKPOINT = 768;
const DESKTOP_BREAKPOINT = 1024;
type ContentArchetype = 'form' | 'data' | 'immersive';

const DEFAULT_CONTENT_ARCHETYPE: ContentArchetype = 'form';

@Component({
  selector: 'app-layout-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    TranslateModule,
    HeaderComponent,
    DashboardBreadcrumbsComponent,
    SidebarComponent,
    MobileNavDrawerComponent,
  ],
  templateUrl: './layout-shell.component.html',
  styleUrl: './layout-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LayoutShellComponent {
  readonly layoutStore = inject(LayoutStore);
  private readonly facilityContext = inject(FacilityContextStore);
  private readonly router = inject(Router);
  readonly sidebarCollapsed = this.layoutStore.sidebarCollapsed;

  private readonly viewportWidth = signal(
    typeof window === 'undefined' ? DESKTOP_BREAKPOINT : window.innerWidth
  );
  readonly contentArchetype = signal<ContentArchetype>(
    DEFAULT_CONTENT_ARCHETYPE
  );
  readonly contentMaxWidth = computed(() => {
    switch (this.contentArchetype()) {
      case 'data':
        return 'var(--content-max-data)';
      case 'immersive':
        return 'var(--content-max-immersive)';
      case 'form':
      default:
        return 'var(--content-max-form)';
    }
  });

  readonly isDesktop = computed(
    () => this.viewportWidth() >= DESKTOP_BREAKPOINT
  );
  readonly showSidebar = computed(
    () => this.viewportWidth() >= MOBILE_BREAKPOINT
  );

  constructor() {
    this.facilityContext.initialize();
    this.applyViewportState(this.viewportWidth());
    this.updateContentArchetypeFromRoute();

    this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd => event instanceof NavigationEnd
        ),
        takeUntilDestroyed()
      )
      .subscribe(() => {
        this.updateContentArchetypeFromRoute();
      });
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

  private updateContentArchetypeFromRoute(): void {
    let pointer: ActivatedRouteSnapshot | null =
      this.router.routerState.snapshot.root;
    let detectedArchetype: ContentArchetype | null = null;

    while (pointer) {
      const candidate = pointer.data?.['contentArchetype'];
      if (
        candidate === 'form' ||
        candidate === 'data' ||
        candidate === 'immersive'
      ) {
        detectedArchetype = candidate;
      }

      pointer = pointer.firstChild ?? null;
    }

    this.contentArchetype.set(detectedArchetype ?? DEFAULT_CONTENT_ARCHETYPE);
  }
}
