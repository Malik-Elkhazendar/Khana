import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { UserRole } from '@khana/shared-dtos';
import { AuthStore } from '../../shared/state/auth.store';
import { AuthService } from '../../shared/services/auth.service';
import { TeamComponent } from './team.component';

const mockUser = {
  id: 'user-1',
  email: 'manager@khana.sa',
  name: 'Khana Manager',
  role: UserRole.MANAGER,
  tenantId: 'tenant-1',
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('TeamComponent', () => {
  const authStoreMock = {
    user: signal(mockUser),
    setUser: jest.fn(),
  };
  const authServiceMock = {
    getCurrentUser: jest.fn(() => of(mockUser)),
  };

  beforeEach(async () => {
    authStoreMock.setUser.mockReset();
    authServiceMock.getCurrentUser.mockClear();

    await TestBed.configureTestingModule({
      imports: [TeamComponent, TranslateModule.forRoot()],
      providers: [
        { provide: AuthStore, useValue: authStoreMock },
        { provide: AuthService, useValue: authServiceMock },
      ],
    }).compileComponents();
  });

  it('refreshes current user on init', () => {
    const fixture = TestBed.createComponent(TeamComponent);
    fixture.detectChanges();

    expect(authServiceMock.getCurrentUser).toHaveBeenCalledTimes(1);
    expect(authStoreMock.setUser).toHaveBeenCalledWith(mockUser);
  });

  it('uses shared dashboard button primitives for refresh action', () => {
    const fixture = TestBed.createComponent(TeamComponent);
    fixture.detectChanges();

    const refreshButton = fixture.nativeElement.querySelector(
      '.dashboard-page__actions .dashboard-btn.dashboard-btn--secondary'
    ) as HTMLButtonElement | null;

    expect(refreshButton).toBeTruthy();
  });
});
