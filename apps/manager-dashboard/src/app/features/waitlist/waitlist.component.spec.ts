import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  Params,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { WaitlistStatus } from '@khana/shared-dtos';
import { ApiService } from '../../shared/services/api.service';
import { FacilityContextStore } from '../../shared/state';
import { WaitlistComponent } from './waitlist.component';

describe('WaitlistComponent', () => {
  let fixture: ComponentFixture<WaitlistComponent>;
  let component: WaitlistComponent;
  let queryParams: Params;

  const apiMock = {
    getWaitlistEntries: jest.fn((query?: unknown) => {
      void query;
      return of({
        items: [
          {
            entryId: 'entry-1',
            facilityId: 'facility-1',
            facilityName: 'Court A',
            userId: 'user-1',
            userName: 'Ali',
            userEmail: 'ali@khana.dev',
            desiredStartTime: '2026-03-04T10:00:00.000Z',
            desiredEndTime: '2026-03-04T11:00:00.000Z',
            status: WaitlistStatus.WAITING,
            queuePosition: 1,
            createdAt: '2026-03-04T08:00:00.000Z',
            notifiedAt: null,
            expiredAt: null,
            fulfilledByBookingId: null,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 20,
        summary: { waiting: 1, notified: 0, expired: 0, fulfilled: 0 },
      });
    }),
  };

  const facilityContextMock = {
    facilities: signal([
      {
        id: 'facility-1',
        name: 'Court A',
        openTime: '08:00',
        closeTime: '23:00',
        slotDurationMinutes: 60,
        basePrice: 180,
        currency: 'SAR',
      },
    ]),
    selectedFacilityId: signal<string | null>(null),
    loading: signal(false),
    error: signal<Error | null>(null),
    initialized: signal(true),
    initialize: jest.fn(),
    refreshFacilities: jest.fn(),
    selectFacility: jest.fn(),
    clearError: jest.fn(),
  };

  beforeEach(async () => {
    queryParams = {};
    apiMock.getWaitlistEntries.mockClear();

    await TestBed.configureTestingModule({
      imports: [WaitlistComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              get queryParamMap() {
                return convertToParamMap(queryParams);
              },
            },
          },
        },
        { provide: ApiService, useValue: apiMock },
        { provide: FacilityContextStore, useValue: facilityContextMock },
      ],
    }).compileComponents();

    const translateService = TestBed.inject(TranslateService);
    translateService.setTranslation('en', {
      DASHBOARD: {
        PAGES: {
          WAITLIST: {
            TITLE: 'Waitlist',
            SUBTITLE: 'Waitlist operations',
            FILTERS: {
              FROM: 'From',
              TO: 'To',
              FACILITY: 'Facility',
              ALL_FACILITIES: 'All facilities',
              STATUS: 'Status',
              ALL_STATUSES: 'All statuses',
              APPLY: 'Apply',
              TODAY: 'Today',
            },
            SUMMARY: {
              WAITING: 'Waiting',
              NOTIFIED: 'Notified',
              EXPIRED: 'Expired',
              FULFILLED: 'Fulfilled',
            },
            STATUS: {
              WAITING: 'Waiting',
              NOTIFIED: 'Notified',
              EXPIRED: 'Expired',
              FULFILLED: 'Fulfilled',
            },
            TABLE: {
              STATUS: 'Status',
              FACILITY: 'Facility',
              USER: 'User',
              SLOT: 'Slot',
              POSITION: 'Position',
              CREATED_AT: 'Created',
            },
            STATE: {
              LOADING: 'Loading...',
              EMPTY: 'No entries',
            },
            ERRORS: {
              INVALID_RANGE: 'Invalid date range',
            },
            PAGINATION: {
              PREVIOUS: 'Previous',
              NEXT: 'Next',
              LABEL: 'Page {{page}} of {{totalPages}}',
            },
          },
        },
        ACTIONS: { RETRY: 'Retry' },
      },
      CLIENT_ERRORS: {
        WAITLIST_OPERATIONS: {
          UNKNOWN: 'Unknown',
        },
      },
    });
    translateService.use('en');

    fixture = TestBed.createComponent(WaitlistComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('loads waitlist entries on init with today defaults', () => {
    expect(component).toBeTruthy();
    expect(apiMock.getWaitlistEntries).toHaveBeenCalledTimes(1);
    const firstCallQuery = apiMock.getWaitlistEntries.mock.calls[0]?.[0] as
      | { page: number; pageSize: number }
      | undefined;
    expect(firstCallQuery?.page).toBe(1);
    expect(firstCallQuery?.pageSize).toBe(20);
    expect(component.items().length).toBe(1);
  });

  it('applies date=today query default', async () => {
    queryParams = { date: 'today' };
    apiMock.getWaitlistEntries.mockClear();

    const localFixture = TestBed.createComponent(WaitlistComponent);
    localFixture.detectChanges();
    await localFixture.whenStable();

    const localComponent = localFixture.componentInstance;
    const today = new Date().toISOString().slice(0, 10);
    expect(localComponent.fromDate()).toBe(today);
    expect(localComponent.toDate()).toBe(today);
  });

  it('applies valid status query default', async () => {
    queryParams = { status: WaitlistStatus.NOTIFIED };
    apiMock.getWaitlistEntries.mockClear();

    const localFixture = TestBed.createComponent(WaitlistComponent);
    localFixture.detectChanges();
    await localFixture.whenStable();

    const callQuery = apiMock.getWaitlistEntries.mock.calls[0]?.[0] as
      | { status?: WaitlistStatus }
      | undefined;
    expect(callQuery?.status).toBe(WaitlistStatus.NOTIFIED);
  });

  it('ignores unsupported status query values', async () => {
    queryParams = { status: 'INVALID_STATUS' };
    apiMock.getWaitlistEntries.mockClear();

    const localFixture = TestBed.createComponent(WaitlistComponent);
    localFixture.detectChanges();
    await localFixture.whenStable();

    const localComponent = localFixture.componentInstance;
    expect(localComponent.statusFilter()).toBe('ALL');
  });

  it('validates date range before loading', async () => {
    component.fromDate.set('2026-03-10');
    component.toDate.set('2026-03-01');
    apiMock.getWaitlistEntries.mockClear();

    await component.applyFilters();

    expect(component.filterError()).toBe(
      'DASHBOARD.PAGES.WAITLIST.ERRORS.INVALID_RANGE'
    );
    expect(apiMock.getWaitlistEntries).not.toHaveBeenCalled();
  });
});
