import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { UserDto, UserRole } from '@khana/shared-dtos';
import { ApiService } from '../../shared/services/api.service';
import { LocaleFormatService } from '../../shared/services/locale-format.service';
import { AuthStore } from '../../shared/state/auth.store';
import { TeamComponent } from './team.component';

const createUser = (
  overrides: Partial<UserDto> = {},
  id = 'user-1'
): UserDto => ({
  id,
  tenantId: 'tenant-1',
  email: 'owner@khana.dev',
  name: 'Owner User',
  role: UserRole.OWNER,
  isActive: true,
  onboardingCompleted: true,
  createdAt: new Date('2026-02-28T10:00:00.000Z'),
  updatedAt: new Date('2026-02-28T10:00:00.000Z'),
  ...overrides,
});

describe('TeamComponent', () => {
  const owner = createUser();
  const manager = createUser(
    {
      id: 'manager-1',
      role: UserRole.MANAGER,
      email: 'manager@khana.dev',
      name: 'Manager User',
    },
    'manager-1'
  );
  const staff = createUser(
    {
      id: 'staff-1',
      role: UserRole.STAFF,
      email: 'staff@khana.dev',
      name: 'Staff User',
    },
    'staff-1'
  );

  const authStoreMock = {
    user: signal<UserDto | null>(owner),
  };

  const apiMock = {
    listUsers: jest.fn(() => of<UserDto[]>([owner, manager, staff])),
    updateUserRole: jest.fn((id: string, request: { role: UserRole }) => {
      return of(
        createUser(
          {
            id,
            role: request.role,
            email: id === 'manager-1' ? 'manager@khana.dev' : 'staff@khana.dev',
            name: id === 'manager-1' ? 'Manager User' : 'Staff User',
          },
          id
        )
      );
    }),
    updateUserStatus: jest.fn((id: string, request: { isActive: boolean }) => {
      return of(
        createUser(
          {
            id,
            role: id === 'manager-1' ? UserRole.MANAGER : UserRole.STAFF,
            isActive: request.isActive,
            email: id === 'manager-1' ? 'manager@khana.dev' : 'staff@khana.dev',
            name: id === 'manager-1' ? 'Manager User' : 'Staff User',
          },
          id
        )
      );
    }),
    inviteUser: jest.fn(() =>
      of({
        message: 'Invitation sent successfully.',
        user: createUser(
          {
            id: 'viewer-1',
            role: UserRole.VIEWER,
            email: 'viewer@khana.dev',
            name: 'Viewer User',
          },
          'viewer-1'
        ),
      })
    ),
  };

  const localeFormatMock = {
    formatDate: jest.fn(() => 'Feb 28, 2026, 10:00 AM'),
  };

  beforeEach(async () => {
    authStoreMock.user.set(owner);
    apiMock.listUsers.mockClear();
    apiMock.updateUserRole.mockClear();
    apiMock.updateUserStatus.mockClear();
    apiMock.inviteUser.mockClear();

    await TestBed.configureTestingModule({
      imports: [TeamComponent, TranslateModule.forRoot()],
      providers: [
        { provide: ApiService, useValue: apiMock },
        { provide: AuthStore, useValue: authStoreMock },
        { provide: LocaleFormatService, useValue: localeFormatMock },
      ],
    }).compileComponents();
  });

  it('loads team members on init', () => {
    const fixture = TestBed.createComponent(TeamComponent);
    fixture.detectChanges();

    expect(apiMock.listUsers).toHaveBeenCalledTimes(1);
    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBeGreaterThan(0);
  });

  it('allows owner to update user role', () => {
    const fixture = TestBed.createComponent(TeamComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.onRoleChange(manager, UserRole.STAFF);

    expect(apiMock.updateUserRole).toHaveBeenCalledWith('manager-1', {
      role: UserRole.STAFF,
    });
  });

  it('allows owner to invite user by email and role', () => {
    const fixture = TestBed.createComponent(TeamComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.inviteForm.setValue({
      email: 'NEW.USER@khana.dev',
      role: UserRole.MANAGER,
    });

    component.submitInvite();

    expect(apiMock.inviteUser).toHaveBeenCalledWith({
      email: 'new.user@khana.dev',
      role: UserRole.MANAGER,
    });
  });

  it('renders manager as read-only (no invite form)', () => {
    authStoreMock.user.set(manager);

    const fixture = TestBed.createComponent(TeamComponent);
    fixture.detectChanges();

    const invitePanel = fixture.nativeElement.querySelector('.invite-panel');
    const roleSelects = fixture.nativeElement.querySelectorAll('tbody select');

    expect(invitePanel).toBeNull();
    expect(roleSelects.length).toBe(0);
  });
});
