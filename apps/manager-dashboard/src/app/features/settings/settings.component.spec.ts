import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
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
    getTenantContext: jest.fn(() => of({ id: 'tenant-1', name: 'Khana Club' })),
    logoutAllDevices: jest.fn(() => of(void 0)),
  };
  const languageServiceMock = {
    toggleLanguage: jest.fn(),
  };
  const apiServiceMock = {
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
    authServiceMock.getTenantContext.mockClear();
    authServiceMock.logoutAllDevices.mockClear();
    languageServiceMock.toggleLanguage.mockClear();
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
    expect(fixture.nativeElement.textContent).toContain('Khana Club');
  });

  it('uses shared dashboard button primitives for settings actions', () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();

    const actionButtons = fixture.nativeElement.querySelectorAll(
      '.dashboard-btn.dashboard-btn--secondary'
    );
    expect(actionButtons.length).toBeGreaterThanOrEqual(3);
  });

  it('executes language toggle, navigation, and logout-all actions', () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll(
      '.dashboard-btn.dashboard-btn--secondary'
    ) as NodeListOf<HTMLButtonElement>;

    buttons[0]?.click();
    buttons[1]?.click();
    buttons[2]?.click();

    expect(languageServiceMock.toggleLanguage).toHaveBeenCalledTimes(1);
    expect(routerMock.navigateByUrl).toHaveBeenCalledWith('/change-password');
    expect(authServiceMock.logoutAllDevices).toHaveBeenCalledTimes(1);
  });
});
