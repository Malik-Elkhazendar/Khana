import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { readFileSync } from 'fs';
import { join } from 'path';
import { SidebarComponent } from './sidebar.component';

@Component({
  template: '',
  standalone: true,
})
class StubRouteComponent {}

const EN_TRANSLATIONS = {
  DASHBOARD: {
    NAV: {
      MAIN_NAVIGATION: 'Main navigation',
      TOGGLE_SIDEBAR: 'Toggle sidebar',
      ITEMS: {
        BOOKINGS: 'Bookings',
        CALENDAR: 'Calendar',
        NEW_BOOKING: 'New Booking',
      },
    },
  },
};

describe('SidebarComponent', () => {
  let fixture: ComponentFixture<SidebarComponent>;
  let component: SidebarComponent;
  let router: Router;
  let translateService: TranslateService;

  const getStyles = () =>
    readFileSync(
      join(
        process.cwd(),
        'apps/manager-dashboard/src/app/shared/components/sidebar/sidebar.component.scss'
      ),
      'utf8'
    );

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        SidebarComponent,
        TranslateModule.forRoot(),
        RouterTestingModule.withRoutes([
          { path: 'dashboard/calendar', component: StubRouteComponent },
          { path: 'dashboard/bookings', component: StubRouteComponent },
          { path: 'dashboard/new', component: StubRouteComponent },
        ]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    translateService = TestBed.inject(TranslateService);
    translateService.setTranslation('en', EN_TRANSLATIONS);
    translateService.use('en');
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('renders navigation links', () => {
    const links = fixture.nativeElement.querySelectorAll('.sidebar__nav-link');
    expect(links.length).toBe(component.navItems.length);
  });

  it('renders logo when expanded', () => {
    const logo = fixture.nativeElement.querySelector('.sidebar__logo');
    expect(logo).toBeTruthy();
  });

  it('hides logo when collapsed', () => {
    fixture.componentRef.setInput('isCollapsed', true);
    fixture.detectChanges();
    const logo = fixture.nativeElement.querySelector('.sidebar__logo');
    expect(logo).toBeNull();
  });

  it('hides nav labels when collapsed', () => {
    fixture.componentRef.setInput('isCollapsed', true);
    fixture.detectChanges();
    const label = fixture.nativeElement.querySelector('.sidebar__nav-label');
    expect(label).toBeNull();
  });

  it('emits toggleCollapse on toggle button click', () => {
    const emitSpy = jest.spyOn(component.toggleCollapse, 'emit');
    const toggleButton = fixture.nativeElement.querySelector(
      '.sidebar__toggle'
    ) as HTMLButtonElement | null;

    toggleButton?.click();

    expect(emitSpy).toHaveBeenCalled();
  });

  it('navigates on link click', () => {
    const navigateSpy = jest
      .spyOn(router, 'navigateByUrl')
      .mockResolvedValue(true);
    const link = fixture.nativeElement.querySelector(
      '.sidebar__nav-link'
    ) as HTMLAnchorElement | null;

    link?.click();

    expect(navigateSpy).toHaveBeenCalled();
  });

  it('has role="navigation"', () => {
    const nav = fixture.nativeElement.querySelector('nav');
    expect(nav?.getAttribute('role')).toBe('navigation');
  });

  it('has aria-label on nav', () => {
    const nav = fixture.nativeElement.querySelector('nav');
    expect(nav?.getAttribute('aria-label')).toBe('Main navigation');
  });

  it('sets aria-current="page" on active link', async () => {
    await router.navigateByUrl('/dashboard/calendar');
    await fixture.whenStable();
    fixture.detectChanges();

    const links = Array.from(
      fixture.nativeElement.querySelectorAll('.sidebar__nav-link')
    ) as HTMLAnchorElement[];
    const calendarLink = links.find((link) =>
      link.textContent?.includes('Calendar')
    );

    expect(calendarLink?.getAttribute('aria-current')).toBe('page');
  });

  it('sets aria-expanded on toggle button based on collapse state', () => {
    let toggleButton = fixture.nativeElement.querySelector(
      '.sidebar__toggle'
    ) as HTMLButtonElement | null;

    expect(toggleButton?.getAttribute('aria-expanded')).toBe('true');

    fixture.componentRef.setInput('isCollapsed', true);
    fixture.detectChanges();
    toggleButton = fixture.nativeElement.querySelector(
      '.sidebar__toggle'
    ) as HTMLButtonElement | null;

    expect(toggleButton?.getAttribute('aria-expanded')).toBe('false');
  });

  it('uses 48px touch target on the toggle button', () => {
    expect(getStyles()).toMatch(
      /sidebar__toggle[^}]*min-block-size:\s*var\(--space-12\)/
    );
  });

  it('uses 48px touch target on nav links', () => {
    expect(getStyles()).toMatch(
      /sidebar__nav-link[^}]*min-block-size:\s*var\(--space-12\)/
    );
  });
});
