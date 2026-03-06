import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { UserRole } from '@khana/shared-dtos';
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
        updatedAt: new Date().toISOString(),
      })
    ),
    updateTenantSettings: jest.fn(() =>
      of({
        timezone: 'Europe/Istanbul',
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

  it('loads tenant context on init', () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();

    expect(authServiceMock.getTenantContext).toHaveBeenCalledTimes(1);
    expect(apiServiceMock.getTenantSettings).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('Khana Club');
  });

  it('renders the four scoped settings sections', () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#account')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#organization')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#goals')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('#security')).not.toBeNull();
  });

  it('renders scope badges with correct scope kinds and accessibility labels', () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();

    const scopeBadges = fixture.nativeElement.querySelectorAll(
      '.settings-scope-badge'
    );
    expect(scopeBadges.length).toBe(4);

    const personalBadges = fixture.nativeElement.querySelectorAll(
      '.settings-scope-badge--personal'
    );
    const tenantBadges = fixture.nativeElement.querySelectorAll(
      '.settings-scope-badge--tenant'
    );
    expect(personalBadges.length).toBe(2);
    expect(tenantBadges.length).toBe(2);

    const accountBadge = fixture.nativeElement.querySelector(
      '[data-testid="settings-scope-account"] .settings-scope-badge'
    ) as HTMLElement | null;
    expect(accountBadge).not.toBeNull();
    expect(accountBadge?.getAttribute('aria-label')).toContain(
      'DASHBOARD.PAGES.SETTINGS.SCOPE_LABEL'
    );

    const decorativeIcons = fixture.nativeElement.querySelectorAll(
      '.settings-scope-badge__icon[aria-hidden="true"]'
    );
    expect(decorativeIcons.length).toBe(4);
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

    expect(toggleLanguageButton).not.toBeNull();
    expect(changePasswordButton).not.toBeNull();
    expect(logoutAllButton).not.toBeNull();

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

    expect(timezoneInput).not.toBeNull();
    expect(saveButton).not.toBeNull();

    timezoneInput!.value = 'Europe/Istanbul';
    timezoneInput!.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    saveButton?.click();
    fixture.detectChanges();

    expect(apiServiceMock.updateTenantSettings).toHaveBeenCalledWith({
      timezone: 'Europe/Istanbul',
    });
    expect(fixture.nativeElement.textContent).toContain(
      'DASHBOARD.PAGES.SETTINGS.TIMEZONE.SAVE_SUCCESS'
    );
  });

  it('allows manager role to save timezone', () => {
    authStoreMock.user.set({
      ...mockUser,
      role: UserRole.MANAGER,
    });

    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();

    const saveButton = fixture.nativeElement.querySelector(
      '[data-testid="settings-save-timezone"]'
    ) as HTMLButtonElement | null;
    expect(saveButton).not.toBeNull();

    saveButton?.click();
    fixture.detectChanges();

    expect(apiServiceMock.updateTenantSettings).toHaveBeenCalledTimes(1);
  });

  it('hides timezone save action for non-owner/manager roles', () => {
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
