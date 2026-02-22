import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { LayoutShellComponent } from './layout-shell.component';
import { LayoutStore } from '../../shared/state/layout.store';
import { AuthService } from '../../shared/services/auth.service';

const EN_TRANSLATIONS = {
  DASHBOARD: {
    ACCESSIBILITY: {
      SKIP_TO_MAIN_CONTENT: 'Skip to main content',
    },
    NAV: {
      BRAND_LABEL: 'Khana dashboard',
      MAIN_NAVIGATION: 'Main navigation',
      PRIMARY_NAVIGATION: 'Primary navigation',
      TOGGLE_SIDEBAR: 'Toggle sidebar',
      TOGGLE_NAVIGATION: 'Toggle navigation',
      TOGGLE_USER_MENU: 'Toggle user menu',
      MOBILE_NAVIGATION: 'Mobile navigation',
      MOBILE_NAVIGATION_LINKS: 'Mobile navigation links',
      NAVIGATION_TITLE: 'Navigation',
      CLOSE_NAVIGATION: 'Close navigation',
      CLOSE: 'Close',
      ITEMS: {
        BOOKINGS: 'Bookings',
        CALENDAR: 'Calendar',
        NEW_BOOKING: 'New Booking',
      },
    },
    USER: {
      LOGOUT: 'Logout',
      SIGN_IN: 'Sign in',
    },
    LAYOUT: {
      PRIMARY_SIDEBAR: 'Primary sidebar',
      CONTENT_REGION: 'Dashboard content',
    },
  },
};

describe('LayoutShellComponent', () => {
  let fixture: ComponentFixture<LayoutShellComponent>;
  let component: LayoutShellComponent;
  let store: InstanceType<typeof LayoutStore>;
  let translateService: TranslateService;

  const setWindowWidth = (width: number) => {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: width,
    });
  };

  beforeEach(async () => {
    setWindowWidth(1200);
    await TestBed.configureTestingModule({
      imports: [
        LayoutShellComponent,
        RouterModule.forRoot([]),
        TranslateModule.forRoot(),
      ],
      providers: [
        {
          provide: AuthService,
          useValue: {
            logout: jest.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LayoutShellComponent);
    component = fixture.componentInstance;
    store = component.layoutStore;
    translateService = TestBed.inject(TranslateService);
    translateService.setTranslation('en', EN_TRANSLATIONS);
    translateService.use('en');
    fixture.detectChanges();
  });

  it('creates the component', () => {
    expect(component).toBeTruthy();
  });

  it('toggles sidebar collapse state', () => {
    expect(store.sidebarCollapsed()).toBe(false);
    store.toggleSidebar();
    expect(store.sidebarCollapsed()).toBe(true);
  });

  it('toggles mobile drawer state', () => {
    setWindowWidth(500);
    component.onResize(new Event('resize'));
    expect(store.mobileDrawerOpen()).toBe(false);
    store.toggleMobileDrawer();
    expect(store.mobileDrawerOpen()).toBe(true);
  });

  it('detects desktop viewport width', () => {
    setWindowWidth(1200);
    component.onResize(new Event('resize'));
    expect(component.isDesktop()).toBe(true);
  });

  it('detects mobile viewport width', () => {
    setWindowWidth(500);
    component.onResize(new Event('resize'));
    expect(component.isDesktop()).toBe(false);
  });

  it('renders header and router outlet', () => {
    const header = fixture.nativeElement.querySelector('app-header');
    const outlet = fixture.nativeElement.querySelector('router-outlet');
    const drawer = fixture.nativeElement.querySelector('app-mobile-nav-drawer');
    expect(header).toBeTruthy();
    expect(outlet).toBeTruthy();
    expect(drawer).toBeTruthy();
  });

  it('renders sidebar on tablet widths', () => {
    setWindowWidth(900);
    component.onResize(new Event('resize'));
    fixture.detectChanges();
    const sidebar = fixture.nativeElement.querySelector('app-sidebar');
    expect(sidebar).toBeTruthy();
    expect(store.sidebarCollapsed()).toBe(true);
  });

  it('hides sidebar on mobile widths', () => {
    setWindowWidth(500);
    component.onResize(new Event('resize'));
    fixture.detectChanges();
    const sidebar = fixture.nativeElement.querySelector('app-sidebar');
    expect(sidebar).toBeNull();
  });

  it('renders skip link pointing to main content', () => {
    const skipLink = fixture.nativeElement.querySelector(
      '.dashboard-skip-link'
    );
    expect(skipLink).toBeTruthy();
    expect(skipLink?.getAttribute('href')).toBe('#dashboard-route-content');
  });

  it('closes the drawer when switching to desktop', () => {
    setWindowWidth(500);
    component.onResize(new Event('resize'));
    store.toggleMobileDrawer();
    expect(store.mobileDrawerOpen()).toBe(true);

    setWindowWidth(1200);
    component.onResize(new Event('resize'));
    expect(store.mobileDrawerOpen()).toBe(false);
  });
});
