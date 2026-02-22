import { TestBed } from '@angular/core/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { UserRole } from '@khana/shared-dtos';
import { AuthStore } from '../../state/auth.store';
import { AuthService } from '../../services/auth.service';
import { LayoutStore } from '../../state/layout.store';
import { HeaderComponent } from './header.component';

const EN_TRANSLATIONS = {
  DASHBOARD: {
    NAV: {
      BRAND_LABEL: 'Khana dashboard',
      PRIMARY_NAVIGATION: 'Primary navigation',
      TOGGLE_NAVIGATION: 'Toggle navigation',
      TOGGLE_USER_MENU: 'Toggle user menu',
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
  },
};

describe('HeaderComponent', () => {
  const authServiceMock = {
    logout: jest.fn(),
  };
  let translateService: TranslateService;

  const setup = () => {
    const fixture = TestBed.createComponent(HeaderComponent);
    const component = fixture.componentInstance;
    const authStore = TestBed.inject(AuthStore);
    const layoutStore = TestBed.inject(LayoutStore);
    fixture.detectChanges();
    return { fixture, component, authStore, layoutStore };
  };

  beforeEach(async () => {
    authServiceMock.logout.mockReset();

    await TestBed.configureTestingModule({
      imports: [
        HeaderComponent,
        RouterTestingModule.withRoutes([]),
        TranslateModule.forRoot(),
      ],
      providers: [{ provide: AuthService, useValue: authServiceMock }],
    }).compileComponents();

    translateService = TestBed.inject(TranslateService);
    translateService.setTranslation('en', EN_TRANSLATIONS);
    translateService.use('en');
  });

  it('creates the component', () => {
    const { component } = setup();
    expect(component).toBeTruthy();
  });

  it('toggles mobile drawer and closes user menu', () => {
    const { component, layoutStore } = setup();
    const toggleSpy = jest.spyOn(layoutStore, 'toggleMobileDrawer');

    component.toggleUserMenu();
    expect(component.userMenuOpen()).toBe(true);

    component.toggleMobileMenu();

    expect(toggleSpy).toHaveBeenCalled();
    expect(component.userMenuOpen()).toBe(false);
  });

  it('closes user menu and mobile drawer on nav click', () => {
    const { component, layoutStore } = setup();
    const closeSpy = jest.spyOn(layoutStore, 'closeMobileDrawer');

    component.toggleUserMenu();
    expect(component.userMenuOpen()).toBe(true);

    component.onNavClick();

    expect(closeSpy).toHaveBeenCalled();
    expect(component.userMenuOpen()).toBe(false);
  });

  it('closes menus and logs out', () => {
    const { component, layoutStore } = setup();
    const closeSpy = jest.spyOn(layoutStore, 'closeMobileDrawer');

    component.toggleUserMenu();
    component.logout();

    expect(closeSpy).toHaveBeenCalled();
    expect(component.userMenuOpen()).toBe(false);
    expect(authServiceMock.logout).toHaveBeenCalled();
  });

  it('renders the guest button when no user is set', () => {
    const { fixture } = setup();

    const guestButton = fixture.nativeElement.querySelector(
      '.user-button--ghost'
    ) as HTMLAnchorElement | null;
    const userName = fixture.nativeElement.querySelector('.user-name');

    expect(guestButton).toBeTruthy();
    expect(userName).toBeNull();
  });

  it('renders the user name and role when currentUser is set', () => {
    const { fixture, authStore } = setup();

    authStore.setUser({
      id: 'user-1',
      email: 'ava@example.com',
      name: 'Ava Hassan',
      role: UserRole.MANAGER,
      tenantId: 'tenant-1',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    fixture.detectChanges();

    const guestButton = fixture.nativeElement.querySelector(
      '.user-button--ghost'
    );
    const userName = fixture.nativeElement.querySelector('.user-name');
    const userRole = fixture.nativeElement.querySelector('.user-role');

    expect(guestButton).toBeNull();
    expect(userName?.textContent).toContain('Ava Hassan');
    expect(userRole?.textContent).toContain('MANAGER');
  });
});
