import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { NotificationPreferencesDto, UserRole } from '@khana/shared-dtos';
import { AuthStore } from '../../shared/state/auth.store';
import { AuthService } from '../../shared/services/auth.service';
import { ApiService } from '../../shared/services/api.service';
import { LanguageService } from '../../shared/services/language.service';
import { SettingsComponent } from './settings.component';

const mockUser = {
  id: 'user-1',
  email: 'owner@khana.sa',
  name: 'Khana Owner',
  role: UserRole.OWNER,
  tenantId: 'tenant-1',
  isActive: true,
  onboardingCompleted: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const createNotificationPreferences = (): NotificationPreferencesDto => ({
  morningDigest: {
    enabled: true,
    sendTime: '07:00',
    channels: {
      whatsapp: { enabled: true },
      email: { enabled: true },
    },
  },
  weeklySummary: {
    enabled: true,
    dayOfWeek: 0,
    sendTime: '19:00',
    channels: {
      whatsapp: { enabled: false },
      email: { enabled: true },
    },
  },
  bookingCreated: {
    enabled: true,
    channels: {
      whatsapp: { enabled: true },
      email: { enabled: false },
    },
  },
  bookingCancelled: {
    enabled: true,
    channels: {
      whatsapp: { enabled: true },
      email: { enabled: false },
    },
  },
  holdExpiring: {
    enabled: true,
    leadMinutes: 30,
    channels: {
      whatsapp: { enabled: true },
      email: { enabled: false },
    },
  },
});

describe('SettingsComponent', () => {
  const authStoreMock = {
    user: signal(mockUser),
  };
  const authServiceMock = {
    getTenantContext: jest.fn(() =>
      of({
        id: 'tenant-1',
        name: 'Khana Club',
        slug: 'khana-club',
        timezone: 'Asia/Riyadh',
      })
    ),
    setTenantTimeZone: jest.fn(),
    logoutAllDevices: jest.fn(() => of(void 0)),
  };
  const languageServiceMock = {
    toggleLanguage: jest.fn(),
  };
  const apiServiceMock = {
    getTenantSettings: jest.fn(() =>
      of({
        timezone: 'Asia/Riyadh',
        notificationPreferences: createNotificationPreferences(),
        updatedAt: new Date().toISOString(),
      })
    ),
    updateTenantSettings: jest.fn(() =>
      of({
        timezone: 'Europe/Istanbul',
        notificationPreferences: createNotificationPreferences(),
        updatedAt: new Date().toISOString(),
      })
    ),
    getGoalSettings: jest.fn(() =>
      of({
        monthlyRevenueTarget: null,
        monthlyOccupancyTarget: null,
        goalsNudgeShownAt: null,
        goalsNudgeDismissedAt: null,
        shouldShowNudge: false,
        updatedAt: new Date().toISOString(),
      })
    ),
    updateGoalSettings: jest.fn(() =>
      of({
        monthlyRevenueTarget: 24000,
        monthlyOccupancyTarget: 70,
        goalsNudgeShownAt: null,
        goalsNudgeDismissedAt: null,
        shouldShowNudge: false,
        updatedAt: new Date().toISOString(),
      })
    ),
  };
  const routerMock = {
    navigateByUrl: jest.fn(),
  };

  beforeEach(async () => {
    authStoreMock.user.set(mockUser);
    authServiceMock.getTenantContext.mockClear();
    authServiceMock.setTenantTimeZone.mockClear();
    authServiceMock.logoutAllDevices.mockClear();
    languageServiceMock.toggleLanguage.mockClear();
    apiServiceMock.getTenantSettings.mockClear();
    apiServiceMock.updateTenantSettings.mockClear();
    apiServiceMock.getGoalSettings.mockClear();
    apiServiceMock.updateGoalSettings.mockClear();
    routerMock.navigateByUrl.mockClear();

    await TestBed.configureTestingModule({
      imports: [SettingsComponent, TranslateModule.forRoot()],
      providers: [
        { provide: AuthStore, useValue: authStoreMock },
        { provide: AuthService, useValue: authServiceMock },
        { provide: ApiService, useValue: apiServiceMock },
        { provide: LanguageService, useValue: languageServiceMock },
        { provide: Router, useValue: routerMock },
      ],
    }).compileComponents();
  });

  it('loads tenant context and tenant settings on init', () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();

    expect(authServiceMock.getTenantContext).toHaveBeenCalledTimes(1);
    expect(apiServiceMock.getTenantSettings).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('Khana Club');
  });

  it('renders the five scoped settings sections', () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#account')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#organization')).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('#notifications')
    ).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#goals')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#security')).not.toBeNull();
  });

  it('renders scope badges with correct scope kinds', () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();

    const scopeBadges = fixture.nativeElement.querySelectorAll(
      '.settings-scope-badge'
    );
    expect(scopeBadges.length).toBe(5);

    const personalBadges = fixture.nativeElement.querySelectorAll(
      '.settings-scope-badge--personal'
    );
    const tenantBadges = fixture.nativeElement.querySelectorAll(
      '.settings-scope-badge--tenant'
    );
    expect(personalBadges.length).toBe(2);
    expect(tenantBadges.length).toBe(3);
  });

  it('executes language toggle, navigation, and logout-all actions', () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();

    const toggleLanguageButton = fixture.nativeElement.querySelector(
      '[data-testid="settings-toggle-language"]'
    ) as HTMLButtonElement | null;
    const changePasswordButton = fixture.nativeElement.querySelector(
      '[data-testid="settings-change-password"]'
    ) as HTMLButtonElement | null;
    const logoutAllButton = fixture.nativeElement.querySelector(
      '[data-testid="settings-logout-all"]'
    ) as HTMLButtonElement | null;

    toggleLanguageButton?.click();
    changePasswordButton?.click();
    logoutAllButton?.click();

    expect(languageServiceMock.toggleLanguage).toHaveBeenCalledTimes(1);
    expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/change-password');
    expect(authServiceMock.logoutAllDevices).toHaveBeenCalledTimes(1);
  });

  it('shows organization scoped error without hiding account section', () => {
    authServiceMock.getTenantContext.mockReturnValueOnce(
      throwError(() => new Error('tenant-failed'))
    );

    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#account')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'DASHBOARD.PAGES.SETTINGS.ORGANIZATION.ERROR'
    );
  });

  it('saves timezone setting when a valid IANA value is submitted', () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();

    const timezoneInput = fixture.nativeElement.querySelector(
      '.settings-preferences__input'
    ) as HTMLInputElement | null;
    const saveButton = fixture.nativeElement.querySelector(
      '[data-testid="settings-save-timezone"]'
    ) as HTMLButtonElement | null;

    timezoneInput!.value = 'Europe/Istanbul';
    timezoneInput!.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    saveButton?.click();
    fixture.detectChanges();

    expect(apiServiceMock.updateTenantSettings).toHaveBeenCalledWith({
      timezone: 'Europe/Istanbul',
    });
  });

  it('filters timezone datalist options from the current search input', () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();

    const timezoneInput = fixture.nativeElement.querySelector(
      '.settings-preferences__input'
    ) as HTMLInputElement | null;

    timezoneInput!.value = 'istanbul';
    timezoneInput!.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const options = Array.from(
      fixture.nativeElement.querySelectorAll(
        '#settings-timezone-options option'
      )
    ) as HTMLOptionElement[];

    expect(options.length).toBe(1);
    expect(options[0]?.value).toBe('Europe/Istanbul');
  });

  it('shows timezone empty-search state only when no rendered options match', () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();

    const timezoneInput = fixture.nativeElement.querySelector(
      '.settings-preferences__input'
    ) as HTMLInputElement | null;

    timezoneInput!.value = 'not-a-real-time-zone';
    timezoneInput!.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const options = fixture.nativeElement.querySelectorAll(
      '#settings-timezone-options option'
    );
    expect(options.length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain(
      'DASHBOARD.PAGES.SETTINGS.TIMEZONE.SEARCH_EMPTY'
    );
  });

  it('saves notification preferences when owner updates alert channels', () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();

    fixture.componentInstance.onNotificationChannelChange(
      'bookingCreated',
      'email',
      true
    );
    fixture.componentInstance.saveNotificationPreferences();

    expect(apiServiceMock.updateTenantSettings).toHaveBeenCalledWith({
      notificationPreferences: expect.objectContaining({
        bookingCreated: expect.objectContaining({
          channels: expect.objectContaining({
            email: { enabled: true },
          }),
        }),
      }),
    });
  });

  it('allows manager role to save notification preferences', () => {
    authStoreMock.user.set({
      ...mockUser,
      role: UserRole.MANAGER,
    });

    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();

    const saveButton = fixture.nativeElement.querySelector(
      '[data-testid="settings-save-notifications"]'
    ) as HTMLButtonElement | null;

    expect(saveButton).not.toBeNull();

    saveButton?.click();
    fixture.detectChanges();

    expect(apiServiceMock.updateTenantSettings).toHaveBeenCalledTimes(1);
  });

  it('shows notification read-only state for staff users', () => {
    authStoreMock.user.set({
      ...mockUser,
      role: UserRole.STAFF,
    });

    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();

    const saveButton = fixture.nativeElement.querySelector(
      '[data-testid="settings-save-notifications"]'
    );
    expect(saveButton).toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'DASHBOARD.PAGES.SETTINGS.NOTIFICATIONS.READ_ONLY'
    );
  });

  it('still hides timezone save action for non-owner and non-manager roles', () => {
    authStoreMock.user.set({
      ...mockUser,
      role: UserRole.STAFF,
    });

    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();

    const saveButton = fixture.nativeElement.querySelector(
      '[data-testid="settings-save-timezone"]'
    );
    expect(saveButton).toBeNull();
  });
});
