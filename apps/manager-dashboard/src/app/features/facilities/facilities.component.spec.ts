import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import {
  FacilityManagementItemDto,
  UserDto,
  UserRole,
} from '@khana/shared-dtos';
import { ApiService } from '../../shared/services/api.service';
import { LocaleFormatService } from '../../shared/services/locale-format.service';
import { AuthStore } from '../../shared/state/auth.store';
import { FacilityContextStore } from '../../shared/state';
import { FacilitiesComponent } from './facilities.component';

const createUser = (role: UserRole): UserDto => ({
  id: 'user-1',
  tenantId: 'tenant-1',
  email: 'owner@khana.dev',
  name: 'Owner',
  role,
  isActive: true,
  onboardingCompleted: true,
  createdAt: new Date('2025-01-01T10:00:00.000Z'),
  updatedAt: new Date('2025-01-01T10:00:00.000Z'),
});

const createFacility = (
  overrides: Partial<FacilityManagementItemDto> = {}
): FacilityManagementItemDto => ({
  id: 'facility-1',
  tenantId: 'tenant-1',
  name: 'Center Court',
  type: 'PADEL_COURT',
  isActive: true,
  config: {
    pricePerHour: 220,
    openTime: '08:00',
    closeTime: '23:00',
  },
  createdAt: '2025-01-01T10:00:00.000Z',
  updatedAt: '2025-01-01T10:00:00.000Z',
  ...overrides,
});

describe('FacilitiesComponent', () => {
  const authStoreMock = {
    user: signal<UserDto | null>(createUser(UserRole.OWNER)),
  };

  const facilityContextMock = {
    refreshFacilities: jest.fn(),
  };

  const apiMock = {
    getManagedFacilities: jest.fn(),
    createFacility: jest.fn(),
    updateFacility: jest.fn(),
    deactivateFacility: jest.fn(),
  };

  const localeFormatMock = {
    formatCurrency: jest.fn((amount: number, currency: string) => {
      return `${currency} ${amount}`;
    }),
    formatDate: jest.fn(() => 'Jan 1, 2025, 10:00 AM'),
  };

  beforeEach(async () => {
    authStoreMock.user.set(createUser(UserRole.OWNER));
    facilityContextMock.refreshFacilities.mockReset();

    apiMock.getManagedFacilities.mockReset();
    apiMock.createFacility.mockReset();
    apiMock.updateFacility.mockReset();
    apiMock.deactivateFacility.mockReset();

    apiMock.getManagedFacilities.mockReturnValue(of([createFacility()]));
    apiMock.createFacility.mockImplementation((payload: { name: string }) => {
      return of(
        createFacility({
          id: 'facility-2',
          name: payload.name,
          type: 'CHALET',
        })
      );
    });
    apiMock.updateFacility.mockReturnValue(
      of(createFacility({ id: 'facility-1', isActive: false }))
    );
    apiMock.deactivateFacility.mockReturnValue(
      of(createFacility({ id: 'facility-1', isActive: false }))
    );

    await TestBed.configureTestingModule({
      imports: [FacilitiesComponent, TranslateModule.forRoot()],
      providers: [
        { provide: ApiService, useValue: apiMock },
        { provide: LocaleFormatService, useValue: localeFormatMock },
        { provide: AuthStore, useValue: authStoreMock },
        { provide: FacilityContextStore, useValue: facilityContextMock },
      ],
    }).compileComponents();
  });

  it('renders managed facilities in a table', () => {
    const fixture = TestBed.createComponent(FacilitiesComponent);
    fixture.detectChanges();

    const rows = fixture.nativeElement.querySelectorAll('tbody tr');
    expect(rows.length).toBe(1);
    expect(apiMock.getManagedFacilities).toHaveBeenCalledWith(true);
  });

  it('creates a facility for owner/manager roles', () => {
    const fixture = TestBed.createComponent(FacilitiesComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    component.startCreate();
    component.facilityForm.setValue({
      name: 'VIP Chalet',
      type: 'CHALET',
      pricePerHour: 500,
      openTime: '09:00',
      closeTime: '22:00',
    });

    component.submit();

    expect(apiMock.createFacility).toHaveBeenCalledWith({
      name: 'VIP Chalet',
      type: 'CHALET',
      config: {
        pricePerHour: 500,
        openTime: '09:00',
        closeTime: '22:00',
      },
    });
    expect(facilityContextMock.refreshFacilities).toHaveBeenCalled();
  });

  it('hides create/edit actions for staff role', () => {
    authStoreMock.user.set(createUser(UserRole.STAFF));

    const fixture = TestBed.createComponent(FacilitiesComponent);
    fixture.detectChanges();

    const createButton = fixture.nativeElement.querySelector(
      '.dashboard-page__header .dashboard-btn'
    );
    const formPanel = fixture.nativeElement.querySelector(
      '.facilities-form-panel'
    );

    expect(createButton).toBeNull();
    expect(formPanel).toBeNull();
  });

  it('deactivates active facility from row action', () => {
    const fixture = TestBed.createComponent(FacilitiesComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const facility = component.facilities()[0];
    expect(facility).toBeTruthy();

    component.toggleFacilityStatus(facility);

    expect(apiMock.deactivateFacility).toHaveBeenCalledWith('facility-1');
    expect(facilityContextMock.refreshFacilities).toHaveBeenCalled();
  });
});
