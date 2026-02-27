import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DashboardBreadcrumbsComponent } from './dashboard-breadcrumbs.component';

@Component({
  standalone: true,
  template: '',
})
class StubRouteComponent {}

const EN_TRANSLATIONS = {
  DASHBOARD: {
    BREADCRUMBS: {
      ARIA_LABEL: 'Breadcrumbs',
      HOME: 'Bookings',
      BOOKINGS: 'Bookings',
      FACILITIES: 'Facilities',
    },
  },
};

describe('DashboardBreadcrumbsComponent', () => {
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        DashboardBreadcrumbsComponent,
        TranslateModule.forRoot(),
        RouterTestingModule.withRoutes([
          {
            path: 'dashboard',
            children: [
              {
                path: 'bookings',
                component: StubRouteComponent,
                data: { breadcrumbKey: 'DASHBOARD.BREADCRUMBS.BOOKINGS' },
              },
              {
                path: 'facilities',
                component: StubRouteComponent,
                data: { breadcrumbKey: 'DASHBOARD.BREADCRUMBS.FACILITIES' },
              },
            ],
          },
        ]),
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    const translate = TestBed.inject(TranslateService);
    translate.setTranslation('en', EN_TRANSLATIONS);
    translate.use('en');
  });

  it('renders home and current route crumbs', async () => {
    const fixture = TestBed.createComponent(DashboardBreadcrumbsComponent);
    await router.navigateByUrl('/dashboard/facilities');
    await fixture.whenStable();
    fixture.detectChanges();

    const nav = fixture.nativeElement.querySelector(
      '.dashboard-breadcrumbs'
    ) as HTMLElement | null;
    const current = fixture.nativeElement.querySelector(
      '.dashboard-breadcrumbs__current'
    ) as HTMLElement | null;
    const firstLink = fixture.nativeElement.querySelector(
      '.dashboard-breadcrumbs__link'
    ) as HTMLElement | null;

    expect(nav?.getAttribute('aria-label')).toBe('Breadcrumbs');
    expect(firstLink?.textContent).toContain('Bookings');
    expect(current?.textContent).toContain('Facilities');
  });
});
