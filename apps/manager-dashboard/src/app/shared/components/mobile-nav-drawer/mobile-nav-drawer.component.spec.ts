import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { MobileNavDrawerComponent } from './mobile-nav-drawer.component';
import { FacilityContextStore } from '../../state';
import { LayoutStore } from '../../state/layout.store';
import { signal } from '@angular/core';

@Component({
  template: '',
  standalone: true,
})
class StubRouteComponent {}

const EN_TRANSLATIONS = {
  DASHBOARD: {
    NAV: {
      MOBILE_NAVIGATION: 'Mobile navigation',
      MOBILE_NAVIGATION_LINKS: 'Mobile navigation links',
      NAVIGATION_TITLE: 'Navigation',
      CLOSE_NAVIGATION: 'Close navigation',
      CLOSE: 'Close',
      ITEMS: {
        BOOKINGS: 'Bookings',
        CALENDAR: 'Calendar',
        NEW_BOOKING: 'New Booking',
        PROMO_CODES: 'Promo Codes',
        FACILITIES: 'Facilities',
        TEAM: 'Team',
        SETTINGS: 'Settings',
      },
    },
  },
};

describe('MobileNavDrawerComponent', () => {
  let fixture: ComponentFixture<MobileNavDrawerComponent>;
  let component: MobileNavDrawerComponent;
  let store: InstanceType<typeof LayoutStore>;
  let router: Router;
  let translateService: TranslateService;
  const facilityContextMock = {
    facilities: signal([]),
    selectedFacilityId: signal<string | null>(null),
    loading: signal(false),
    error: signal<Error | null>(null),
    initialized: signal(true),
    initialize: jest.fn(),
    refreshFacilities: jest.fn(),
    selectFacility: jest.fn(),
    clearError: jest.fn(),
  };

  const openDrawer = () => {
    store.openMobileDrawer();
    fixture.detectChanges();
  };

  beforeEach(async () => {
    facilityContextMock.initialize.mockReset();
    facilityContextMock.refreshFacilities.mockReset();
    facilityContextMock.selectFacility.mockReset();
    facilityContextMock.clearError.mockReset();

    await TestBed.configureTestingModule({
      imports: [
        MobileNavDrawerComponent,
        TranslateModule.forRoot(),
        RouterTestingModule.withRoutes([
          { path: 'dashboard/bookings', component: StubRouteComponent },
          { path: 'dashboard/calendar', component: StubRouteComponent },
          { path: 'dashboard/new', component: StubRouteComponent },
          { path: 'dashboard/promo-codes', component: StubRouteComponent },
        ]),
      ],
      providers: [
        { provide: FacilityContextStore, useValue: facilityContextMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(MobileNavDrawerComponent);
    component = fixture.componentInstance;
    store = TestBed.inject(LayoutStore);
    router = TestBed.inject(Router);
    translateService = TestBed.inject(TranslateService);
    translateService.setTranslation('en', EN_TRANSLATIONS);
    translateService.use('en');
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('does not render when closed', () => {
    const dialog = fixture.nativeElement.querySelector('.mobile-drawer');
    expect(dialog).toBeNull();
  });

  it('renders when open', () => {
    openDrawer();
    const dialog = fixture.nativeElement.querySelector('.mobile-drawer');
    expect(dialog).toBeTruthy();
  });

  it('sets dialog aria attributes', () => {
    openDrawer();
    const dialog = fixture.nativeElement.querySelector('.mobile-drawer');
    expect(dialog?.getAttribute('role')).toBe('dialog');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(dialog?.getAttribute('aria-label')).toBe('Mobile navigation');
  });

  it('closeDrawer calls layoutStore.closeMobileDrawer', () => {
    const closeSpy = jest.spyOn(store, 'closeMobileDrawer');
    component.closeDrawer();
    expect(closeSpy).toHaveBeenCalled();
  });

  it('closes on close button click', () => {
    openDrawer();
    const closeButton = fixture.nativeElement.querySelector(
      '.mobile-drawer__close'
    ) as HTMLButtonElement | null;
    closeButton?.click();
    fixture.detectChanges();
    expect(store.mobileDrawerOpen()).toBe(false);
  });

  it('closes on overlay click', () => {
    openDrawer();
    const overlay = fixture.nativeElement.querySelector(
      '.mobile-drawer__overlay'
    ) as HTMLButtonElement | null;
    overlay?.click();
    fixture.detectChanges();
    expect(store.mobileDrawerOpen()).toBe(false);
  });

  it('navigates and closes on nav click', async () => {
    openDrawer();

    const navLink = fixture.nativeElement.querySelector(
      '.mobile-drawer__link'
    ) as HTMLAnchorElement | null;
    navLink?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(router.url).toBe('/dashboard/bookings');
    expect(store.mobileDrawerOpen()).toBe(false);
  });

  it('shows promo nav item for owner and hides it for viewer', () => {
    openDrawer();
    expect(fixture.nativeElement.textContent).toContain('Promo Codes');

    const authStore = TestBed.inject(AuthStore);
    authStore.setUser({
      id: 'user-2',
      tenantId: 'tenant-1',
      email: 'viewer@khana.dev',
      name: 'Viewer',
      role: UserRole.VIEWER,
      isActive: true,
      onboardingCompleted: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Promo Codes');
  });

  it('closes on Escape key', () => {
    openDrawer();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(store.mobileDrawerOpen()).toBe(false);
  });

  it('focuses the close button on open', () => {
    jest.useFakeTimers();
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    openDrawer();
    jest.runOnlyPendingTimers();
    fixture.detectChanges();

    const closeButton = fixture.nativeElement.querySelector(
      '.mobile-drawer__close'
    ) as HTMLButtonElement | null;
    expect(document.activeElement).toBe(closeButton);

    document.body.removeChild(trigger);
  });

  it('traps focus on Tab from last element to first', () => {
    jest.useFakeTimers();
    openDrawer();
    jest.runOnlyPendingTimers();
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector(
      '.mobile-drawer'
    ) as HTMLElement | null;
    const focusables = panel?.querySelectorAll(
      'button:not([disabled]), a[href]'
    ) as NodeListOf<HTMLElement>;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    last.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));

    expect(document.activeElement).toBe(first);
  });

  it('traps focus on Shift+Tab from first element to last', () => {
    jest.useFakeTimers();
    openDrawer();
    jest.runOnlyPendingTimers();
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector(
      '.mobile-drawer'
    ) as HTMLElement | null;
    const focusables = panel?.querySelectorAll(
      'button:not([disabled]), a[href]'
    ) as NodeListOf<HTMLElement>;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    first.focus();
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true })
    );

    expect(document.activeElement).toBe(last);
  });

  it('restores focus to the previously focused element on close', () => {
    jest.useFakeTimers();
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    openDrawer();
    jest.runOnlyPendingTimers();
    fixture.detectChanges();

    store.closeMobileDrawer();
    fixture.detectChanges();
    jest.runOnlyPendingTimers();

    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
  });
});
