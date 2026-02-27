import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ActivatedRouteSnapshot,
  NavigationEnd,
  Router,
  RouterModule,
} from '@angular/router';
import { filter } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';

type Breadcrumb = {
  labelKey: string;
  route: string;
  isCurrent: boolean;
};

@Component({
  selector: 'app-dashboard-breadcrumbs',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslateModule],
  templateUrl: './dashboard-breadcrumbs.component.html',
  styleUrl: './dashboard-breadcrumbs.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardBreadcrumbsComponent {
  private readonly router = inject(Router);

  readonly breadcrumbs = signal<Breadcrumb[]>([]);

  constructor() {
    this.updateBreadcrumbs();
    this.router.events
      .pipe(
        filter(
          (event): event is NavigationEnd => event instanceof NavigationEnd
        )
      )
      .subscribe(() => {
        this.updateBreadcrumbs();
      });
  }

  trackByRoute(_: number, item: Breadcrumb): string {
    return item.route;
  }

  private updateBreadcrumbs(): void {
    const crumbs = this.buildBreadcrumbs(this.router.routerState.snapshot.root);
    this.breadcrumbs.set(crumbs);
  }

  private buildBreadcrumbs(route: ActivatedRouteSnapshot): Breadcrumb[] {
    const rootCrumb: Breadcrumb = {
      labelKey: 'DASHBOARD.BREADCRUMBS.HOME',
      route: '/dashboard/bookings',
      isCurrent: false,
    };

    const collected: Breadcrumb[] = [rootCrumb];
    let pointer: ActivatedRouteSnapshot | null = route.firstChild;
    let routePath = '';

    while (pointer) {
      const segment = pointer.url.map((part) => part.path).join('/');
      if (segment.length > 0) {
        routePath = `${routePath}/${segment}`;
      }

      const breadcrumbKey = pointer.data?.['breadcrumbKey'];
      if (breadcrumbKey && routePath.startsWith('/dashboard')) {
        collected.push({
          labelKey: String(breadcrumbKey),
          route: routePath,
          isCurrent: false,
        });
      }

      pointer = pointer.firstChild;
    }

    if (collected.length === 0) {
      return [];
    }

    return collected.map((crumb, index) => ({
      ...crumb,
      isCurrent: index === collected.length - 1,
    }));
  }
}
