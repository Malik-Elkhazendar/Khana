import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ComponentFixture,
  TestBed,
  fakeAsync,
  flushMicrotasks,
} from '@angular/core/testing';
import {
  ActivatedRoute,
  Params,
  Router,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { UserRole, WaitlistStatus } from '@khana/shared-dtos';
import { ApiService } from '../../shared/services/api.service';
import { WAITLIST_UPCOMING_WINDOW_DAYS } from '../../shared/constants/waitlist.constants';
import { FacilityContextStore } from '../../shared/state';
import { AuthStore } from '../../shared/state/auth.store';
import { WaitlistComponent } from './waitlist.component';

describe('WaitlistComponent', () => {
  let fixture: ComponentFixture<WaitlistComponent>;
  let component: WaitlistComponent;
  let queryParamMap$: BehaviorSubject<ReturnType<typeof convertToParamMap>>;

  const defaultWaitlistResponse = {
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
  };

  const apiMock = {
    getWaitlistEntries: jest.fn((query?: unknown) => {
      void query;
      return of(defaultWaitlistResponse);
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
  const authStoreMock = {
    user: signal({
      id: 'owner-1',
      tenantId: 'tenant-1',
      email: 'owner@khana.dev',
      name: 'Owner User',
      role: UserRole.OWNER,
      isActive: true,
      onboardingCompleted: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  };

  const toInputDate = (value: Date): string => {
    const offset = value.getTimezoneOffset();
    const local = new Date(value.getTime() - offset * 60_000);
    return local.toISOString().slice(0, 10);
  };

  const buildUpcomingRange = (baseDate: Date = new Date()) => {
    const toDate = new Date(baseDate);
    toDate.setDate(toDate.getDate() + WAITLIST_UPCOMING_WINDOW_DAYS);

    return {
      from: toInputDate(baseDate),
      to: toInputDate(toDate),
    };
  };

  const toRangeIso = (value: string, boundary: 'start' | 'end'): string => {
    const time = boundary === 'start' ? '00:00:00.000' : '23:59:59.999';
    return new Date(`${value}T${time}`).toISOString();
  };

  const setQueryParams = (params: Params): void => {
    queryParamMap$.next(convertToParamMap(params));
  };

  beforeEach(async () => {
    queryParamMap$ = new BehaviorSubject(convertToParamMap({}));
    apiMock.getWaitlistEntries.mockReset();
    apiMock.getWaitlistEntries.mockImplementation((query?: unknown) => {
      void query;
      return of(defaultWaitlistResponse);
    });
    authStoreMock.user.set({
      id: 'owner-1',
      tenantId: 'tenant-1',
      email: 'owner@khana.dev',
      name: 'Owner User',
      role: UserRole.OWNER,
      isActive: true,
      onboardingCompleted: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await TestBed.configureTestingModule({
      imports: [WaitlistComponent, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: queryParamMap$.asObservable(),
            snapshot: {
              get queryParamMap() {
                return queryParamMap$.value;
              },
            },
          },
        },
        { provide: ApiService, useValue: apiMock },
        { provide: FacilityContextStore, useValue: facilityContextMock },
        { provide: AuthStore, useValue: authStoreMock },
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
              UPCOMING: 'Upcoming',
              TODAY: 'Today',
            },
            REPORT: {
              TITLE: 'Operations Report',
              SUBTITLE:
                'Review queue activity across the selected report window.',
              SUMMARY_SCOPE: 'Summary cards reflect the current filters only.',
              FACILITY_LABEL: 'Facility',
              RANGE_LABEL: 'Range',
              STATUS_LABEL: 'Status',
            },
            CONTEXT: {
              TITLE: 'Selected slot context',
              MESSAGE:
                'Showing queue context for the slot you opened from Booking Preview.',
              FACILITY_LABEL: 'Facility',
              SLOT_LABEL: 'Slot',
              EMPTY_TITLE: 'No queue entries match this slot context',
              EMPTY:
                'The current report window does not contain any waitlist entries for this exact slot.',
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
              NOT_AVAILABLE: 'N/A',
              CREATED_AT: 'Created',
              ACTIONS: 'Actions',
            },
            ACTIONS: {
              BOOK_NOW: 'Book Now',
            },
            STATE: {
              LOADING: 'Loading...',
              EMPTY_TITLE: 'No waitlist activity in this report',
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

  it('loads waitlist entries on init with upcoming defaults', () => {
    expect(component).toBeTruthy();
    expect(apiMock.getWaitlistEntries).toHaveBeenCalledTimes(1);
    const firstCallQuery = apiMock.getWaitlistEntries.mock.calls[0]?.[0] as
      | { from: string; to: string; page: number; pageSize: number }
      | undefined;
    const expectedRange = buildUpcomingRange();
    expect(firstCallQuery?.from).toBe(toRangeIso(expectedRange.from, 'start'));
    expect(firstCallQuery?.to).toBe(toRangeIso(expectedRange.to, 'end'));
    expect(firstCallQuery?.page).toBe(1);
    expect(firstCallQuery?.pageSize).toBe(20);
    expect(component.items().length).toBe(1);
  });

  it('clears waitlist results on auth-sensitive load failures', async () => {
    expect(component.items()).toEqual(defaultWaitlistResponse.items);
    expect(component.summary()).toEqual(defaultWaitlistResponse.summary);

    apiMock.getWaitlistEntries.mockReset();
    apiMock.getWaitlistEntries.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 401 }))
    );

    await component.applyFilters();

    expect(component.items()).toEqual([]);
    expect(component.summary()).toEqual({
      waiting: 0,
      notified: 0,
      expired: 0,
      fulfilled: 0,
    });
    expect(component.total()).toBe(0);
  });

  it('hydrates exact date, facility, status, and slot context from query params', async () => {
    fixture.destroy();
    setQueryParams({
      date: '2026-03-04',
      facilityId: 'facility-1',
      status: WaitlistStatus.WAITING,
      slotStart: '2026-03-04T10:00:00.000Z',
      slotEnd: '2026-03-04T11:00:00.000Z',
      source: 'booking-preview',
    });

    fixture = TestBed.createComponent(WaitlistComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.fromDate()).toBe('2026-03-04');
    expect(component.toDate()).toBe('2026-03-04');
    expect(component.facilityId()).toBe('facility-1');
    expect(component.statusFilter()).toBe(WaitlistStatus.WAITING);
    expect(component.slotContext()).toEqual({
      facilityId: 'facility-1',
      startTime: '2026-03-04T10:00:00.000Z',
      endTime: '2026-03-04T11:00:00.000Z',
      source: 'booking-preview',
    });
  });

  it('rehydrates filters and slot context when query params change after mount', async () => {
    apiMock.getWaitlistEntries.mockClear();

    setQueryParams({
      date: '2026-03-04',
      facilityId: 'facility-1',
      status: WaitlistStatus.NOTIFIED,
      slotStart: '2026-03-04T10:00:00.000Z',
      slotEnd: '2026-03-04T11:00:00.000Z',
      source: 'booking-preview',
    });
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.fromDate()).toBe('2026-03-04');
    expect(component.toDate()).toBe('2026-03-04');
    expect(component.facilityId()).toBe('facility-1');
    expect(component.statusFilter()).toBe(WaitlistStatus.NOTIFIED);
    expect(component.slotContext()).toEqual({
      facilityId: 'facility-1',
      startTime: '2026-03-04T10:00:00.000Z',
      endTime: '2026-03-04T11:00:00.000Z',
      source: 'booking-preview',
    });

    const lastCallQuery = apiMock.getWaitlistEntries.mock.calls.at(-1)?.[0] as
      | { from: string; to: string; status?: WaitlistStatus }
      | undefined;
    expect(lastCallQuery?.from).toBe(toRangeIso('2026-03-04', 'start'));
    expect(lastCallQuery?.to).toBe(toRangeIso('2026-03-04', 'end'));
    expect(lastCallQuery?.status).toBe(WaitlistStatus.NOTIFIED);
  });

  it('applies date=today query default', async () => {
    fixture.destroy();
    setQueryParams({ date: 'today' });
    apiMock.getWaitlistEntries.mockClear();

    const localFixture = TestBed.createComponent(WaitlistComponent);
    localFixture.detectChanges();
    await localFixture.whenStable();
    localFixture.detectChanges();

    const localComponent = localFixture.componentInstance;
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const localNow = new Date(now.getTime() - offset * 60_000);
    const today = localNow.toISOString().slice(0, 10);
    expect(localComponent.fromDate()).toBe(today);
    expect(localComponent.toDate()).toBe(today);
  });

  it('applies valid status query default', async () => {
    fixture.destroy();
    setQueryParams({ status: WaitlistStatus.NOTIFIED });
    apiMock.getWaitlistEntries.mockClear();

    const localFixture = TestBed.createComponent(WaitlistComponent);
    localFixture.detectChanges();
    await localFixture.whenStable();

    const callQuery = apiMock.getWaitlistEntries.mock.calls[0]?.[0] as
      | { status?: WaitlistStatus }
      | undefined;
    expect(callQuery?.status).toBe(WaitlistStatus.NOTIFIED);
  });

  it('restores the upcoming operational window', async () => {
    component.fromDate.set('2026-03-04');
    component.toDate.set('2026-03-04');
    apiMock.getWaitlistEntries.mockClear();

    await component.setUpcoming();

    const expectedRange = buildUpcomingRange();
    expect(component.fromDate()).toBe(expectedRange.from);
    expect(component.toDate()).toBe(expectedRange.to);
    expect(apiMock.getWaitlistEntries).toHaveBeenCalled();
  });

  it('ignores unsupported status query values', async () => {
    fixture.destroy();
    setQueryParams({ status: 'INVALID_STATUS' });
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

  it('ignores stale waitlist responses when a newer filter request finishes later', fakeAsync(() => {
    const firstRequest = new Subject<typeof defaultWaitlistResponse>();
    const secondRequest = new Subject<typeof defaultWaitlistResponse>();

    apiMock.getWaitlistEntries.mockReset();
    apiMock.getWaitlistEntries
      .mockReturnValueOnce(firstRequest)
      .mockReturnValueOnce(secondRequest);

    const localFixture = TestBed.createComponent(WaitlistComponent);
    localFixture.detectChanges();
    const localComponent = localFixture.componentInstance;

    localComponent.onStatusChange(WaitlistStatus.NOTIFIED);

    secondRequest.next({
      items: [
        {
          ...defaultWaitlistResponse.items[0],
          entryId: 'entry-2',
          userName: 'Newer request',
          status: WaitlistStatus.NOTIFIED,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
      summary: { waiting: 0, notified: 1, expired: 0, fulfilled: 0 },
    });
    flushMicrotasks();

    expect(localComponent.items()[0]?.entryId).toBe('entry-2');
    expect(localComponent.loading()).toBe(false);

    firstRequest.next({
      items: [
        {
          ...defaultWaitlistResponse.items[0],
          entryId: 'entry-older',
          userName: 'Older request',
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
      summary: { waiting: 1, notified: 0, expired: 0, fulfilled: 0 },
    });
    flushMicrotasks();

    expect(localComponent.items()[0]?.entryId).toBe('entry-2');
    expect(localComponent.summary().notified).toBe(1);
  }));

  it('renders translated not-available text when queue position is missing', async () => {
    apiMock.getWaitlistEntries.mockReset();
    apiMock.getWaitlistEntries.mockReturnValue(
      of({
        ...defaultWaitlistResponse,
        items: [
          {
            ...defaultWaitlistResponse.items[0],
            queuePosition: null,
          },
        ],
      })
    );

    const localFixture = TestBed.createComponent(WaitlistComponent);
    localFixture.detectChanges();
    await localFixture.whenStable();
    localFixture.detectChanges();

    const cellTexts = Array.from(
      localFixture.nativeElement.querySelectorAll('tbody td')
    ).map((cell) => cell.textContent?.trim());

    expect(cellTexts).toContain('N/A');
  });

  it('renders waitlist table headers with scope="col"', () => {
    fixture.detectChanges();
    const headers = Array.from(
      fixture.nativeElement.querySelectorAll('thead th')
    ) as HTMLTableCellElement[];

    expect(headers.length).toBeGreaterThan(0);
    expect(
      headers.every((header) => header.getAttribute('scope') === 'col')
    ).toBe(true);
  });

  it('shows slot context banner and highlights the matching row', async () => {
    fixture.destroy();
    setQueryParams({
      date: '2026-03-04',
      facilityId: 'facility-1',
      status: WaitlistStatus.WAITING,
      slotStart: '2026-03-04T10:00:00.000Z',
      slotEnd: '2026-03-04T11:00:00.000Z',
      source: 'booking-preview',
    });

    const localFixture = TestBed.createComponent(WaitlistComponent);
    localFixture.detectChanges();
    await localFixture.whenStable();
    localFixture.detectChanges();

    expect(localFixture.nativeElement.textContent).toContain(
      'Selected slot context'
    );
    expect(
      localFixture.nativeElement.querySelector('.waitlist-table__row--context')
    ).not.toBeNull();
  });

  it('shows slot-context empty state when report data does not contain the selected slot', async () => {
    fixture.destroy();
    setQueryParams({
      date: '2026-03-04',
      facilityId: 'facility-1',
      status: WaitlistStatus.WAITING,
      slotStart: '2026-03-04T12:00:00.000Z',
      slotEnd: '2026-03-04T13:00:00.000Z',
      source: 'booking-preview',
    });

    const localFixture = TestBed.createComponent(WaitlistComponent);
    localFixture.detectChanges();
    await localFixture.whenStable();
    localFixture.detectChanges();

    expect(localFixture.nativeElement.textContent).toContain(
      'No queue entries match this slot context'
    );
  });

  it('shows Book Now action for owner/manager roles', () => {
    fixture.detectChanges();
    const actionButtons = fixture.nativeElement.querySelectorAll(
      '[data-testid="waitlist-book-now"]'
    );

    expect(actionButtons.length).toBe(1);
  });

  it('hides Book Now action for staff role', async () => {
    authStoreMock.user.set({
      id: 'staff-1',
      tenantId: 'tenant-1',
      email: 'staff@khana.dev',
      name: 'Staff User',
      role: UserRole.STAFF,
      isActive: true,
      onboardingCompleted: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const localFixture = TestBed.createComponent(WaitlistComponent);
    localFixture.detectChanges();
    await localFixture.whenStable();
    localFixture.detectChanges();

    const actionButtons = localFixture.nativeElement.querySelectorAll(
      '[data-testid="waitlist-book-now"]'
    );
    expect(actionButtons.length).toBe(0);
  });

  it('navigates to booking preview with prefilled query params on Book Now', () => {
    fixture.detectChanges();
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);

    const actionButton = fixture.nativeElement.querySelector(
      '[data-testid="waitlist-book-now"]'
    ) as HTMLButtonElement | null;
    expect(actionButton).not.toBeNull();

    actionButton?.click();
    fixture.detectChanges();

    const item = component.items()[0];
    const desiredStart = new Date(item.desiredStartTime);
    const desiredEnd = new Date(item.desiredEndTime);
    const expectedDate = `${desiredStart.getFullYear()}-${String(
      desiredStart.getMonth() + 1
    ).padStart(2, '0')}-${String(desiredStart.getDate()).padStart(2, '0')}`;
    const expectedStartTime = `${String(desiredStart.getHours()).padStart(
      2,
      '0'
    )}:${String(desiredStart.getMinutes()).padStart(2, '0')}`;
    const expectedEndTime = `${String(desiredEnd.getHours()).padStart(
      2,
      '0'
    )}:${String(desiredEnd.getMinutes()).padStart(2, '0')}`;

    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard/new'], {
      queryParams: {
        facilityId: item.facilityId,
        date: expectedDate,
        startTime: expectedStartTime,
        endTime: expectedEndTime,
      },
    });
  });
});
