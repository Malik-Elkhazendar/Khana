import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import {
  ActivatedRoute,
  Params,
  Router,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { Subject, TimeoutError, of, throwError } from 'rxjs';
import {
  TranslateModule,
  TranslateService,
  TranslationObject,
} from '@ngx-translate/core';
import { BookingPreviewComponent } from './booking-preview.component';
import { ApiService } from '../../shared/services/api.service';
import { FacilityContextStore } from '../../shared/state';
import { AuthStore } from '../../shared/state/auth.store';
import {
  BookingStatus,
  ConflictType,
  CustomerSummaryDto,
  PromoDiscountType,
  PromoValidationReason,
  RecurrenceFrequency,
  UserRole,
  WaitlistStatus,
} from '@khana/shared-dtos';
import { createApiMock, ApiServiceMock } from '../../testing/api-mocks';
import {
  createBooking,
  createBookingPreview,
  createFacility,
} from '../../testing/factories';
import { readFileSync } from 'fs';
import { join } from 'path';

const EN_TRANSLATIONS = JSON.parse(
  readFileSync(
    join(process.cwd(), 'apps/manager-dashboard/public/assets/i18n/en.json'),
    'utf8'
  )
) as TranslationObject;

describe('BookingPreviewComponent', () => {
  let apiMock: ApiServiceMock;
  let queryParams: Params;
  const facilityContextMock = {
    facilities: signal([]),
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
      id: 'manager-1',
      tenantId: 'tenant-1',
      email: 'manager@khana.dev',
      name: 'Manager User',
      role: UserRole.MANAGER,
      isActive: true,
      onboardingCompleted: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  };

  const setupComponent = () => {
    const fixture = TestBed.createComponent(BookingPreviewComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  };

  beforeEach(async () => {
    apiMock = createApiMock();
    queryParams = {};
    facilityContextMock.initialize.mockReset();
    facilityContextMock.refreshFacilities.mockReset();
    facilityContextMock.selectFacility.mockReset();
    facilityContextMock.selectFacility.mockImplementation(
      (facilityId: string | null) => {
        facilityContextMock.selectedFacilityId.set(facilityId);
      }
    );
    facilityContextMock.clearError.mockReset();
    facilityContextMock.selectedFacilityId.set(null);

    await TestBed.configureTestingModule({
      imports: [BookingPreviewComponent, TranslateModule.forRoot()],
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
        { provide: AuthStore, useValue: authStoreMock },
      ],
    }).compileComponents();

    const translateService = TestBed.inject(TranslateService);
    translateService.setTranslation('en', EN_TRANSLATIONS, true);
    translateService.use('en');
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('loads facilities on init and selects the first facility', () => {
    const { component } = setupComponent();

    expect(apiMock.getFacilities).toHaveBeenCalled();
    expect(component.facilities().length).toBe(1);
    expect(component.selectedFacilityId()).toBe(component.facilities()[0].id);
  });

  it('pre-fills facility, date, and times from query params on load', () => {
    queryParams = {
      facilityId: 'facility-1',
      date: '2026-04-12',
      startTime: '14:30',
      endTime: '15:30',
    };

    const { component } = setupComponent();

    expect(component.selectedFacilityId()).toBe('facility-1');
    expect(component.selectedDate()).toBe('2026-04-12');
    expect(component.startTime()).toBe('14:30');
    expect(component.endTime()).toBe('15:30');
  });

  it('gives query prefill precedence over shared facility selection', () => {
    const facilityA = createFacility({ id: 'facility-a', name: 'Court A' });
    const facilityB = createFacility({ id: 'facility-b', name: 'Court B' });

    facilityContextMock.selectedFacilityId.set('facility-a');
    apiMock.getFacilities.mockReturnValueOnce(of([facilityA, facilityB]));
    queryParams = {
      facilityId: 'facility-b',
      date: '2026-04-12',
      startTime: '16:00',
      endTime: '17:00',
    };

    const { component } = setupComponent();

    expect(component.selectedFacilityId()).toBe('facility-b');
    expect(facilityContextMock.selectFacility).toHaveBeenCalledWith(
      'facility-b'
    );
  });

  it('handles an empty facility list', () => {
    apiMock.getFacilities.mockReturnValueOnce(of([]));

    const { component } = setupComponent();

    expect(component.facilities()).toEqual([]);
    expect(component.selectedFacilityId()).toBe('');
    expect(component.canSubmit()).toBe(false);
  });

  it('sets an error when facility loading fails', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    apiMock.getFacilities.mockReturnValueOnce(
      throwError(() => new Error('Network error'))
    );

    const { component } = setupComponent();

    expect(component.error()?.message).toBe(
      'Failed to load facilities. Please try again.'
    );
  });

  it('returns false for canSubmit while loading', () => {
    const { component } = setupComponent();

    component.loading.set(true);

    expect(component.canSubmit()).toBe(false);
  });

  it('returns true for canSubmit with a valid form', () => {
    const { component } = setupComponent();

    expect(component.canSubmit()).toBe(true);
  });

  it('does not submit when canSubmit is false', () => {
    const { component } = setupComponent();

    component.selectedFacilityId.set('');
    component.onSubmit();

    expect(apiMock.previewBooking).not.toHaveBeenCalled();
  });

  it('performs debounced customer lookup when phone has at least 10 digits', () => {
    jest.useFakeTimers();
    const { component } = setupComponent();

    component.onPhoneInput('0551234567');
    expect(apiMock.lookupCustomerByPhone).not.toHaveBeenCalled();

    jest.advanceTimersByTime(400);

    expect(apiMock.lookupCustomerByPhone).toHaveBeenCalledWith('0551234567');
  });

  it('ignores stale customer lookup responses and keeps the latest result', () => {
    jest.useFakeTimers();

    const firstLookup = new Subject<CustomerSummaryDto | null>();
    const secondLookup = new Subject<CustomerSummaryDto | null>();

    apiMock.lookupCustomerByPhone
      .mockReturnValueOnce(firstLookup)
      .mockReturnValueOnce(secondLookup);

    const { component } = setupComponent();

    component.onPhoneInput('0551234567');
    jest.advanceTimersByTime(400);
    expect(component.lookupLoading()).toBe(true);

    component.onPhoneInput('0557654321');
    jest.advanceTimersByTime(400);

    firstLookup.next({
      id: 'customer-old',
      name: 'Old Customer',
      phone: '+966551234567',
      totalBookings: 1,
      totalSpend: 100,
      tags: ['VIP'],
    });
    firstLookup.complete();

    expect(component.lookupLoading()).toBe(true);
    expect(component.matchedCustomer()).toBeNull();

    const latestCustomer = {
      id: 'customer-new',
      name: 'New Customer',
      phone: '+966557654321',
      totalBookings: 2,
      totalSpend: 250,
      tags: ['Corporate'],
    };
    secondLookup.next(latestCustomer);
    secondLookup.complete();

    expect(component.lookupLoading()).toBe(false);
    expect(component.matchedCustomer()).toEqual(latestCustomer);
  });

  it('clears matched customer when phone has less than 10 digits', () => {
    const { component } = setupComponent();
    component.matchedCustomer.set({
      id: 'customer-1',
      name: 'Layla',
      phone: '+966551234567',
      totalBookings: 0,
      totalSpend: 0,
      tags: ['VIP'],
    });

    component.onPhoneInput('055');

    expect(component.matchedCustomer()).toBeNull();
    expect(apiMock.lookupCustomerByPhone).not.toHaveBeenCalled();
  });

  it('toggles customer tag and persists through API', () => {
    const { component } = setupComponent();
    component.matchedCustomer.set({
      id: 'customer-1',
      name: 'Layla',
      phone: '+966551234567',
      totalBookings: 0,
      totalSpend: 0,
      tags: ['VIP'],
    });

    component.toggleTag('Corporate');

    expect(apiMock.updateCustomerTags).toHaveBeenCalledWith('customer-1', [
      'VIP',
      'Corporate',
    ]);
  });

  it('adds a new tag when tenant tags are empty', () => {
    const { component } = setupComponent();
    component.matchedCustomer.set({
      id: 'customer-1',
      name: 'Layla',
      phone: '+966551234567',
      totalBookings: 0,
      totalSpend: 0,
      tags: [],
    });
    component.availableTags.set([]);

    apiMock.updateCustomerTags.mockReturnValueOnce(
      of({
        id: 'customer-1',
        name: 'Layla',
        phone: '+966551234567',
        totalBookings: 0,
        totalSpend: 0,
        tags: ['Corporate'],
      })
    );

    component.onNewTagInput('Corporate');
    component.addNewTag();

    expect(apiMock.updateCustomerTags).toHaveBeenCalledWith('customer-1', [
      'Corporate',
    ]);
    expect(component.newTagInput()).toBe('');
    expect(component.availableTags()).toContain('Corporate');
  });

  it('does not add duplicate tags case-insensitively', () => {
    const { component } = setupComponent();
    component.matchedCustomer.set({
      id: 'customer-1',
      name: 'Layla',
      phone: '+966551234567',
      totalBookings: 0,
      totalSpend: 0,
      tags: ['VIP'],
    });

    component.onNewTagInput(' vip ');
    component.addNewTag();

    expect(apiMock.updateCustomerTags).not.toHaveBeenCalled();
  });

  it('calls preview API with selected inputs', () => {
    const { component } = setupComponent();
    apiMock.previewBooking.mockReturnValueOnce(of(createBookingPreview()));

    component.selectedDate.set('2025-03-02');
    component.startTime.set('10:00');
    component.endTime.set('11:00');
    component.promoCode.set('SAVE10');
    component.onSubmit();

    expect(apiMock.previewBooking).toHaveBeenCalledWith(
      expect.objectContaining({
        facilityId: component.selectedFacilityId(),
        promoCode: 'SAVE10',
      })
    );
  });

  it('stores preview results from the API', () => {
    const result = createBookingPreview({ canBook: false });
    apiMock.previewBooking.mockReturnValueOnce(of(result));

    const { component } = setupComponent();

    component.onSubmit();

    expect(component.previewResult()).toEqual(result);
  });

  it('renders the waitlist panel with a join CTA for an unavailable slot', () => {
    const { component, fixture } = setupComponent();

    component.previewResult.set(createBookingPreview({ canBook: false }));
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="booking-preview-waitlist"]'
      )
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="booking-preview-waitlist-join"]'
      )
    ).not.toBeNull();
  });

  it('renders an explanatory message instead of a join CTA for unavailable past slots', () => {
    const { component, fixture } = setupComponent();

    component.selectedDate.set('2024-01-01');
    component.previewResult.set(createBookingPreview({ canBook: false }));
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="booking-preview-waitlist"]'
      )
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="booking-preview-waitlist-future-only"]'
      )?.textContent
    ).toContain('future slots');
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="booking-preview-waitlist-join"]'
      )
    ).toBeNull();
  });

  it('renders waitlist loading state while checking status', () => {
    const { component, fixture } = setupComponent();

    component.previewResult.set(createBookingPreview({ canBook: false }));
    component.waitlistLoading.set(true);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="booking-preview-waitlist-loading"]'
      )?.textContent
    ).toContain('Checking your waitlist status');
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="booking-preview-waitlist-join"]'
      )
    ).toBeNull();
  });

  it('shows queue position and hides join CTA when already waiting', () => {
    const { component, fixture } = setupComponent();

    component.previewResult.set(createBookingPreview({ canBook: false }));
    component.waitlistStatus.set({
      isOnWaitlist: true,
      entryId: 'waitlist-1',
      status: WaitlistStatus.WAITING,
      queuePosition: 3,
    });
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="booking-preview-waitlist-waiting"]'
      )?.textContent
    ).toContain('position #3');
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="booking-preview-waitlist-join"]'
      )
    ).toBeNull();
    expect(
      fixture.nativeElement.querySelector('.booking-preview__waitlist-link')
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('.booking-preview__waitlist-link')
        ?.textContent
    ).toContain('View queue for this slot');
  });

  it('falls back to a generic waitlist message when queue position is invalid', () => {
    const { component, fixture } = setupComponent();

    component.previewResult.set(createBookingPreview({ canBook: false }));
    component.waitlistStatus.set({
      isOnWaitlist: true,
      entryId: 'waitlist-1',
      status: WaitlistStatus.WAITING,
      queuePosition: 0,
    });
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="booking-preview-waitlist-waiting"]'
      )?.textContent
    ).toContain("You're on the waitlist");
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="booking-preview-waitlist-waiting"]'
      )?.textContent
    ).not.toContain('position #0');
  });

  it('shows notified state and hides join CTA when the user was already notified', () => {
    const { component, fixture } = setupComponent();

    component.previewResult.set(createBookingPreview({ canBook: false }));
    component.waitlistStatus.set({
      isOnWaitlist: false,
      entryId: 'waitlist-1',
      status: WaitlistStatus.NOTIFIED,
    });
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="booking-preview-waitlist-notified"]'
      )?.textContent
    ).toContain('already notified');
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="booking-preview-waitlist-join"]'
      )
    ).toBeNull();
  });

  it('shows join CTA again when the latest waitlist entry is fulfilled', () => {
    const { component, fixture } = setupComponent();

    component.previewResult.set(createBookingPreview({ canBook: false }));
    component.waitlistStatus.set({
      isOnWaitlist: false,
      entryId: 'waitlist-1',
      status: WaitlistStatus.FULFILLED,
    });
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="booking-preview-waitlist-join"]'
      )
    ).not.toBeNull();
  });

  it('joins the waitlist from the unavailable preview and updates the UI state', () => {
    const { component, fixture } = setupComponent();

    component.previewResult.set(createBookingPreview({ canBook: false }));
    fixture.detectChanges();

    const joinButton = fixture.nativeElement.querySelector<HTMLButtonElement>(
      '[data-testid="booking-preview-waitlist-join"]'
    );
    joinButton?.click();
    fixture.detectChanges();

    expect(apiMock.joinBookingWaitlist).toHaveBeenCalledTimes(1);
    expect(component.waitlistStatus()?.status).toBe(WaitlistStatus.WAITING);
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="booking-preview-waitlist-join"]'
      )
    ).toBeNull();
  });

  it('opens waitlist operations with matching filters for active waitlist entries', async () => {
    const { component } = setupComponent();
    const router = TestBed.inject(Router);
    const navigateSpy = jest.spyOn(router, 'navigate').mockResolvedValue(true);
    component.selectedDate.set('2026-03-04');
    component.startTime.set('10:00');
    component.endTime.set('11:00');
    const expectedSlotStart = new Date('2026-03-04T10:00').toISOString();
    const expectedSlotEnd = new Date('2026-03-04T11:00').toISOString();

    component.waitlistStatus.set({
      isOnWaitlist: true,
      entryId: 'waitlist-1',
      status: WaitlistStatus.WAITING,
      queuePosition: 2,
    });

    component.openWaitlistOperations();

    expect(navigateSpy).toHaveBeenCalledWith(['/dashboard/waitlist'], {
      queryParams: {
        date: component.selectedDate(),
        facilityId: component.selectedFacilityId(),
        status: WaitlistStatus.WAITING,
        slotStart: expectedSlotStart,
        slotEnd: expectedSlotEnd,
        source: 'booking-preview',
      },
    });
  });

  it('still allows opening waitlist operations when active status has no entry id', () => {
    const { component } = setupComponent();

    component.waitlistStatus.set({
      isOnWaitlist: true,
      status: WaitlistStatus.WAITING,
      queuePosition: 1,
    });

    expect(component.canOpenWaitlistOperations()).toBe(true);
  });

  it('does not render the waitlist panel for an available slot', () => {
    const { component, fixture } = setupComponent();

    component.previewResult.set(createBookingPreview({ canBook: true }));
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="booking-preview-waitlist"]'
      )
    ).toBeNull();
  });

  it('clears error and booking success before previewing', () => {
    const { component } = setupComponent();

    component.error.set({
      action: 'preview',
      category: 'unknown',
      message: 'Old error',
    });
    component.bookingSuccess.set(true);
    component.bookingReference.set('REF-1');
    component.onSubmit();

    expect(component.error()).toBeNull();
    expect(component.bookingSuccess()).toBe(false);
    expect(component.bookingReference()).toBeNull();
  });

  it('uses cache for identical preview requests', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-03-01T10:00:00Z'));
    const { component } = setupComponent();
    apiMock.previewBooking.mockReturnValue(of(createBookingPreview()));

    component.onSubmit();
    jest.advanceTimersByTime(301);
    component.onSubmit();

    expect(apiMock.previewBooking).toHaveBeenCalledTimes(1);
  });

  it('expires cache entries after two minutes', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-03-01T10:00:00Z'));
    const { component } = setupComponent();
    apiMock.previewBooking.mockReturnValue(of(createBookingPreview()));

    component.onSubmit();
    jest.advanceTimersByTime(301);
    component.onSubmit();
    const cacheKey = (
      component as unknown as {
        buildCacheKey: (start: Date, end: Date) => string;
      }
    ).buildCacheKey(
      new Date(`${component.selectedDate()}T${component.startTime()}`),
      new Date(`${component.selectedDate()}T${component.endTime()}`)
    );
    const cache = (
      component as unknown as {
        previewCache: Map<string, { expiresAt: number }>;
      }
    ).previewCache;
    const entry = cache.get(cacheKey);
    if (entry) {
      entry.expiresAt = Date.now() - 1;
    }
    jest.advanceTimersByTime(301);
    component.onSubmit();

    expect(apiMock.previewBooking).toHaveBeenCalledTimes(2);
  });

  it('normalizes promo code casing when caching', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-03-01T10:00:00Z'));
    const { component } = setupComponent();
    apiMock.previewBooking.mockReturnValue(of(createBookingPreview()));

    component.promoCode.set(' save10 ');
    component.onSubmit();
    jest.advanceTimersByTime(301);
    component.promoCode.set('SAVE10');
    component.onSubmit();

    expect(apiMock.previewBooking).toHaveBeenCalledTimes(1);
  });

  it('invalidates cache when time inputs change', () => {
    jest.useFakeTimers();
    const { component } = setupComponent();
    apiMock.previewBooking.mockReturnValue(of(createBookingPreview()));

    component.startTime.set('10:00');
    component.endTime.set('11:00');
    component.onSubmit();
    jest.advanceTimersByTime(301);
    component.startTime.set('11:00');
    component.endTime.set('12:00');
    component.onSubmit();

    expect(apiMock.previewBooking).toHaveBeenCalledTimes(2);
  });

  it('sets a specific error message for 404 preview failures', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    apiMock.previewBooking.mockReturnValueOnce(
      throwError(() => ({ status: 404 }))
    );

    const { component } = setupComponent();

    component.onSubmit();

    expect(component.error()?.message).toBe('Facility not found.');
    expect(component.loading()).toBe(false);
  });

  it('sets a generic error message for preview failures', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    apiMock.previewBooking.mockReturnValueOnce(
      throwError(() => ({ status: 500 }))
    );

    const { component } = setupComponent();

    component.onSubmit();

    expect(component.error()?.message).toBe(
      'Failed to preview booking. Please try again.'
    );
  });

  it('retries the last preview action after a failure', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    apiMock.previewBooking
      .mockReturnValueOnce(throwError(() => ({ status: 500 })))
      .mockReturnValueOnce(of(createBookingPreview()));

    const { component } = setupComponent();

    component.onSubmit();
    expect(apiMock.previewBooking).toHaveBeenCalledTimes(1);

    component.retry();
    expect(apiMock.previewBooking).toHaveBeenCalledTimes(2);
  });

  it('categorizes network errors during preview', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    apiMock.previewBooking.mockReturnValueOnce(
      throwError(() => ({ status: 0 }))
    );

    const { component } = setupComponent();

    component.onSubmit();

    expect(component.error()?.category).toBe('network');
  });

  it('debounces rapid preview submissions', () => {
    jest.useFakeTimers();
    const { component } = setupComponent();
    apiMock.previewBooking.mockReturnValue(of(createBookingPreview()));

    component.onSubmit();
    component.onSubmit();

    expect(apiMock.previewBooking).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(301);
    component.promoCode.set('NEXT');
    component.onSubmit();

    expect(apiMock.previewBooking).toHaveBeenCalledTimes(2);
  });

  it('auto-retries preview requests with exponential backoff', () => {
    jest.useFakeTimers();
    jest.spyOn(Math, 'random').mockReturnValue(0);
    apiMock.previewBooking
      .mockReturnValueOnce(throwError(() => ({ status: 0 })))
      .mockReturnValueOnce(of(createBookingPreview()));

    const { component } = setupComponent();

    component.onSubmit();
    expect(component.retryScheduledAt()).not.toBeNull();

    jest.advanceTimersByTime(800);

    expect(apiMock.previewBooking).toHaveBeenCalledTimes(2);
    expect(component.retryAttempt()).toBe(0);
  });

  it('does not auto-retry validation errors', () => {
    jest.useFakeTimers();
    apiMock.previewBooking.mockReturnValueOnce(
      throwError(() => ({ status: 400 }))
    );

    const { component } = setupComponent();

    component.onSubmit();

    expect(component.retryScheduledAt()).toBeNull();
  });

  it('restores last successful preview after network failures', () => {
    jest.useFakeTimers();
    const firstPreview = createBookingPreview({ canBook: true });
    apiMock.previewBooking
      .mockReturnValueOnce(of(firstPreview))
      .mockReturnValueOnce(throwError(() => ({ status: 0 })));

    const { component } = setupComponent();

    component.onSubmit();
    jest.advanceTimersByTime(301);
    component.promoCode.set('NEXT');
    component.onSubmit();

    expect(component.previewResult()).toEqual(firstPreview);
    expect(component.previewStale()).toBe(true);
  });

  it('queues preview requests when offline', () => {
    const { component } = setupComponent();
    component.isOnline.set(false);

    component.onSubmit();

    expect(component.pendingActions().length).toBe(1);
    expect(apiMock.previewBooking).not.toHaveBeenCalled();
    expect(component.error()?.message).toContain('offline');
  });

  it('flushes queued preview requests when online', () => {
    const { component } = setupComponent();
    component.isOnline.set(false);

    component.onSubmit();
    component.isOnline.set(true);
    apiMock.previewBooking.mockReturnValueOnce(of(createBookingPreview()));

    (
      component as unknown as { flushOfflineQueue: () => void }
    ).flushOfflineQueue();

    expect(apiMock.previewBooking).toHaveBeenCalled();
  });

  it('ignores stale preview responses when a new request starts', () => {
    jest.useFakeTimers();
    const { component } = setupComponent();
    const firstSubject = new Subject<ReturnType<typeof createBookingPreview>>();
    const secondSubject = new Subject<
      ReturnType<typeof createBookingPreview>
    >();
    apiMock.previewBooking
      .mockReturnValueOnce(firstSubject.asObservable())
      .mockReturnValueOnce(secondSubject.asObservable());

    component.onSubmit();
    jest.advanceTimersByTime(301);
    component.promoCode.set('ALT');
    component.onSubmit();

    firstSubject.next(createBookingPreview({ canBook: false }));
    secondSubject.next(createBookingPreview({ canBook: true }));

    expect(component.previewResult()?.canBook).toBe(true);
  });

  it('marks preview data as stale after the TTL window', () => {
    const { component } = setupComponent();
    const now = Date.now();

    component.lastPreviewAt.set(now - 5 * 60 * 1000 - 1);
    component.nowTick.set(now);

    expect(component.isPreviewStale()).toBe(true);
  });

  it('virtualizes alternative slots for large lists', () => {
    const { component } = setupComponent();
    const alternatives = Array.from({ length: 120 }, (_, index) => ({
      startTime: `2025-03-01T${(index % 24)
        .toString()
        .padStart(2, '0')}:00:00Z`,
      endTime: `2025-03-01T${(index % 24).toString().padStart(2, '0')}:30:00Z`,
      price: 100,
      currency: 'SAR',
    }));

    component.previewResult.set(
      createBookingPreview({ suggestedAlternatives: alternatives })
    );
    component.alternativesScrollTop.set(200);

    expect(component.shouldVirtualizeAlternatives()).toBe(true);
    expect(component.alternativesWindow().items.length).toBeLessThan(
      alternatives.length
    );
  });

  it('toggles alternatives visibility for large lists', () => {
    const { component } = setupComponent();
    const alternatives = Array.from({ length: 7 }, (_, index) => ({
      startTime: `2025-03-01T${(index % 24)
        .toString()
        .padStart(2, '0')}:00:00Z`,
      endTime: `2025-03-01T${(index % 24).toString().padStart(2, '0')}:30:00Z`,
      price: 100,
      currency: 'SAR',
    }));

    component.previewResult.set(
      createBookingPreview({ suggestedAlternatives: alternatives })
    );

    expect(component.showAlternatives()).toBe(false);
    component.toggleAlternatives();
    expect(component.showAlternatives()).toBe(true);
  });

  it('categorizes timeout errors as network errors', () => {
    const { component } = setupComponent();
    const timeoutError = new TimeoutError();
    const resolved = (
      component as unknown as {
        resolveError: (
          action: string,
          err: unknown
        ) => { category: string; message: string };
      }
    ).resolveError('preview', timeoutError);

    expect(resolved.category).toBe('network');
    expect(resolved.message).toContain('timed out');
  });

  it('clears booking success when loading begins', () => {
    const { component } = setupComponent();

    component.bookingSuccess.set(true);
    component.loading.set(true);
    (
      component as unknown as {
        enforceStateConsistency: (state: unknown) => void;
      }
    ).enforceStateConsistency(component.stateSnapshot());

    expect(component.bookingSuccess()).toBe(false);
  });

  it('updates form values when selecting an alternative slot', () => {
    const { component } = setupComponent();
    const start = new Date(2025, 2, 5, 12, 0, 0);
    const end = new Date(2025, 2, 5, 13, 0, 0);
    const alt = {
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      price: 100,
      currency: 'SAR',
    };
    const submitSpy = jest.spyOn(component, 'onSubmit').mockImplementation();

    component.selectAlternative(alt);

    expect(component.selectedDate()).toBe(start.toISOString().split('T')[0]);
    expect(component.startTime()).toBe(start.toTimeString().slice(0, 5));
    expect(component.endTime()).toBe(end.toTimeString().slice(0, 5));
    expect(submitSpy).toHaveBeenCalled();
  });

  it.each([
    [ConflictType.EXACT_OVERLAP, 'Exact overlap with an existing booking'],
    [
      ConflictType.CONTAINED_WITHIN,
      'Requested time falls within an existing booking',
    ],
    [
      ConflictType.PARTIAL_START_OVERLAP,
      'Requested start overlaps an existing booking',
    ],
    [
      ConflictType.PARTIAL_END_OVERLAP,
      'Requested end overlaps an existing booking',
    ],
    [
      ConflictType.CONTAINS_EXISTING,
      'Requested time contains an existing booking',
    ],
    [undefined, 'Conflict detected'],
  ])('formats conflict type %s as %s', (type, label) => {
    const { component } = setupComponent();

    expect(component.formatConflictType(type)).toBe(label);
  });

  it.each([
    ['BOOKED', 'Booked'],
    ['BLOCKED', 'Blocked'],
    ['MAINTENANCE', 'Maintenance'],
    ['UNKNOWN_STATUS', 'Occupied'],
  ])('maps conflict slot status %s to %s', (status, label) => {
    const { component } = setupComponent();

    expect(component.conflictSlotStatusLabel(status)).toBe(label);
  });

  it('builds an aria label for conflicting slots', () => {
    const { component } = setupComponent();
    const slot = {
      startTime: '2025-03-01T10:00:00Z',
      endTime: '2025-03-01T11:00:00Z',
      status: 'BOOKED',
    };

    expect(component.conflictSlotAriaLabel(slot)).toContain('Booked slot');
  });

  it('returns empty string when formatting a null time', () => {
    const { component } = setupComponent();

    expect(component.formatTime(null)).toBe('');
  });

  it('formats time strings for display', () => {
    const { component } = setupComponent();

    expect(component.formatTime('2025-03-01T10:00:00Z')).toContain(':');
  });

  it('formats prices using the SAR currency', () => {
    const { component } = setupComponent();

    expect(component.formatPrice(100, 'SAR')).toContain('SAR');
  });

  it('returns false for canBook when preview is missing', () => {
    const { component } = setupComponent();

    expect(component.canBook()).toBe(false);
  });

  it('returns false for canBook when customer name is empty', () => {
    const { component } = setupComponent();

    component.previewResult.set(createBookingPreview({ canBook: true }));
    component.customerName.set('');
    component.customerPhone.set('0555555555');

    expect(component.canBook()).toBe(false);
  });

  it('returns false for canBook when customer phone is empty', () => {
    const { component } = setupComponent();

    component.previewResult.set(createBookingPreview({ canBook: true }));
    component.customerName.set('Layla');
    component.customerPhone.set('');

    expect(component.canBook()).toBe(false);
  });

  it('returns false for canBook while booking is in progress', () => {
    const { component } = setupComponent();

    component.previewResult.set(createBookingPreview({ canBook: true }));
    component.customerName.set('Layla');
    component.customerPhone.set('0555555555');
    component.bookingInProgress.set(true);

    expect(component.canBook()).toBe(false);
  });

  it('returns true for canBook with valid details and preview', () => {
    const { component } = setupComponent();

    component.previewResult.set(createBookingPreview({ canBook: true }));
    component.customerName.set('Layla');
    component.customerPhone.set('0555555555');

    expect(component.canBook()).toBe(true);
  });

  it('opens a confirmation dialog before booking', () => {
    const { component } = setupComponent();

    component.previewResult.set(createBookingPreview({ canBook: true }));
    component.customerName.set('Layla');
    component.customerPhone.set('0555555555');

    component.openConfirmDialog();

    expect(component.confirmDialogOpen()).toBe(true);
  });

  it('does not open confirmation dialog when booking is invalid', () => {
    const { component } = setupComponent();

    component.previewResult.set(createBookingPreview({ canBook: true }));
    component.customerName.set('');
    component.customerPhone.set('0555555555');

    component.openConfirmDialog();

    expect(component.confirmDialogOpen()).toBe(false);
  });

  it('does not create a booking when canBook is false', () => {
    const { component } = setupComponent();

    component.onBook();

    expect(apiMock.createBooking).not.toHaveBeenCalled();
  });

  it('renders booking mode controls before a preview is available', () => {
    const { fixture } = setupComponent();

    const fieldset = fixture.nativeElement.querySelector(
      '.booking-preview__booking-mode'
    );
    const holdInput = fixture.nativeElement.querySelector<HTMLInputElement>(
      'input[name="bookingSubmissionMode"][value="HOLD"]'
    );

    expect(fieldset).not.toBeNull();
    expect(holdInput).not.toBeNull();
    expect(holdInput?.disabled).toBe(true);
  });

  it('enables place-on-hold mode when the preview is bookable', () => {
    const { component, fixture } = setupComponent();

    component.previewResult.set(createBookingPreview({ canBook: true }));
    fixture.detectChanges();

    const holdInput = fixture.nativeElement.querySelector<HTMLInputElement>(
      'input[name="bookingSubmissionMode"][value="HOLD"]'
    );

    expect(holdInput?.disabled).toBe(false);
  });

  it('sends a pending status when holding a booking', () => {
    const { component } = setupComponent();
    apiMock.createBooking.mockReturnValueOnce(of(createBooking()));

    component.previewResult.set(createBookingPreview({ canBook: true }));
    component.customerName.set('Layla');
    component.customerPhone.set('0555555555');
    component.bookingSubmissionMode.set('HOLD');
    component.onBook();

    const payload = apiMock.createBooking.mock.calls[0][0];
    expect(payload.status).toBe(BookingStatus.PENDING);
  });

  it('omits status when not holding a booking', () => {
    const { component } = setupComponent();
    apiMock.createBooking.mockReturnValueOnce(of(createBooking()));

    component.previewResult.set(createBookingPreview({ canBook: true }));
    component.customerName.set('Layla');
    component.customerPhone.set('0555555555');
    component.bookingSubmissionMode.set('CONFIRMED');
    component.onBook();

    const payload = apiMock.createBooking.mock.calls[0][0];
    expect(payload.status).toBeUndefined();
  });

  it('resets hold mode when the preview becomes unavailable', () => {
    const { component, fixture } = setupComponent();

    component.previewResult.set(createBookingPreview({ canBook: true }));
    component.bookingSubmissionMode.set('HOLD');
    fixture.detectChanges();

    component.previewResult.set(createBookingPreview({ canBook: false }));
    fixture.detectChanges();

    expect(component.bookingSubmissionMode()).toBe('CONFIRMED');
  });

  it('uses hold-specific confirmation copy when hold mode is selected', () => {
    const { component } = setupComponent();

    component.previewResult.set(createBookingPreview({ canBook: true }));
    component.bookingSubmissionMode.set('HOLD');

    expect(component.confirmCopy.title).toBe('Place booking on hold');
    expect(component.confirmCopy.confirmLabel).toBe('Place on hold');
  });

  it('trims customer details before creating a booking', () => {
    const { component } = setupComponent();
    apiMock.createBooking.mockReturnValueOnce(of(createBooking()));

    component.previewResult.set(createBookingPreview({ canBook: true }));
    component.customerName.set('  Layla  ');
    component.customerPhone.set('  0555555555  ');
    component.onBook();

    const payload = apiMock.createBooking.mock.calls[0][0];
    expect(payload.customerName).toBe('Layla');
    expect(payload.customerPhone).toBe('0555555555');
  });

  it('supports Arabic customer names when booking', () => {
    const { component } = setupComponent();
    apiMock.createBooking.mockReturnValueOnce(of(createBooking()));
    const arabicName = '\u0623\u062d\u0645\u062f';

    component.previewResult.set(createBookingPreview({ canBook: true }));
    component.customerName.set(arabicName);
    component.customerPhone.set('0555555555');
    component.onBook();

    const payload = apiMock.createBooking.mock.calls[0][0];
    expect(payload.customerName).toBe(arabicName);
  });

  it('sends promoCode on booking create when promo validation is valid', () => {
    const { component } = setupComponent();
    apiMock.createBooking.mockReturnValueOnce(of(createBooking()));

    component.previewResult.set(
      createBookingPreview({
        canBook: true,
        promoValidation: {
          code: 'SAVE10',
          isValid: true,
          promoCodeId: 'promo-1',
          discountType: PromoDiscountType.PERCENTAGE,
          discountValue: 10,
          discountAmount: 10,
        },
      })
    );
    component.customerName.set('Layla');
    component.customerPhone.set('0555555555');
    component.onBook();

    const payload = apiMock.createBooking.mock.calls[0][0];
    expect(payload.promoCode).toBe('SAVE10');
  });

  it('omits promoCode on booking create when promo validation is invalid', () => {
    const { component } = setupComponent();
    apiMock.createBooking.mockReturnValueOnce(of(createBooking()));

    component.previewResult.set(
      createBookingPreview({
        canBook: true,
        promoValidation: {
          code: 'SAVE10',
          isValid: false,
          reason: PromoValidationReason.NOT_FOUND,
        },
      })
    );
    component.customerName.set('Layla');
    component.customerPhone.set('0555555555');
    component.onBook();

    const payload = apiMock.createBooking.mock.calls[0][0];
    expect(payload.promoCode).toBeUndefined();
  });

  it('derives date-mode end date from weeks count without timezone drift', () => {
    const { component } = setupComponent();

    component.selectedDate.set('2026-02-28');
    component.recurrenceWeeksCount.set(8);
    component.recurrenceEndDate.set('');
    component.onRecurrenceEndModeChange('DATE');

    expect(component.recurrenceEndDate()).toBe('2026-04-18');
  });

  it('shows recurring preset shortcuts only when repeat is enabled', () => {
    const { component, fixture } = setupComponent();

    expect(
      fixture.nativeElement.querySelector('.booking-preview__recurring-presets')
    ).toBeNull();

    component.onRepeatWeeklyChange(true);
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll(
      '.booking-preview__recurring-preset-btn'
    );
    expect(buttons.length).toBe(4);
  });

  it('applies four-week preset in count mode and marks it active', () => {
    const { component, fixture } = setupComponent();

    component.selectedDate.set('2026-03-01');
    component.onRepeatWeeklyChange(true);
    component.onRecurrenceEndModeChange('COUNT');
    fixture.detectChanges();

    const buttons = fixture.nativeElement.querySelectorAll<HTMLButtonElement>(
      '.booking-preview__recurring-preset-btn'
    );
    buttons[0].click();
    fixture.detectChanges();

    expect(component.recurrenceWeeksCount()).toBe(4);
    expect(component.recurrenceEndDate()).toBe('2026-03-22');
    expect(component.activeRecurringPreset()).toBe('FOUR_WEEKS');
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
  });

  it('applies three-month preset in date mode using duration weeks', () => {
    const { component } = setupComponent();

    component.selectedDate.set('2026-03-01');
    component.onRepeatWeeklyChange(true);
    component.onRecurrenceEndModeChange('DATE');
    component.applyRecurringPreset('THREE_MONTHS');

    expect(component.recurrenceEndDate()).toBe('2026-05-24');
    expect(component.recurrenceWeeksCount()).toBe(13);
    expect(component.activeRecurringPreset()).toBe('THREE_MONTHS');
  });

  it('clears active recurring preset when weeks count is manually edited', () => {
    const { component } = setupComponent();

    component.onRepeatWeeklyChange(true);
    component.onRecurrenceEndModeChange('COUNT');
    component.applyRecurringPreset('EIGHT_WEEKS');

    expect(component.activeRecurringPreset()).toBe('EIGHT_WEEKS');

    component.onRecurrenceWeeksCountChange(9);

    expect(component.activeRecurringPreset()).toBeNull();
  });

  it('clears active recurring preset when end date is manually edited', () => {
    const { component } = setupComponent();

    component.onRepeatWeeklyChange(true);
    component.onRecurrenceEndModeChange('DATE');
    component.applyRecurringPreset('SIX_MONTHS');

    expect(component.activeRecurringPreset()).toBe('SIX_MONTHS');

    component.onRecurrenceEndDateChange('2026-10-10');

    expect(component.activeRecurringPreset()).toBeNull();
  });

  it('keeps active preset duration when selected date changes', () => {
    const { component } = setupComponent();

    component.selectedDate.set('2026-03-01');
    component.onRepeatWeeklyChange(true);
    component.onRecurrenceEndModeChange('DATE');
    component.applyRecurringPreset('FOUR_WEEKS');

    component.onDateChange('2026-03-08');

    expect(component.recurrenceEndDate()).toBe('2026-03-29');
    expect(component.recurrenceWeeksCount()).toBe(4);
    expect(component.activeRecurringPreset()).toBe('FOUR_WEEKS');
  });

  it('keeps preset-applied horizon stable when frequency changes', () => {
    const { component } = setupComponent();

    component.selectedDate.set('2026-03-01');
    component.onRepeatWeeklyChange(true);
    component.onRecurrenceEndModeChange('COUNT');
    component.applyRecurringPreset('EIGHT_WEEKS');

    component.onRecurrenceFrequencyChange(RecurrenceFrequency.BIWEEKLY);

    expect(component.recurrenceWeeksCount()).toBe(8);
    expect(component.recurrenceEndDate()).toBe('2026-04-19');
    expect(component.activeRecurringPreset()).toBe('EIGHT_WEEKS');
  });

  it('maps count mode to an inclusive recurrence end date for recurring bookings', () => {
    const { component } = setupComponent();
    apiMock.createRecurringBooking.mockReturnValueOnce(
      of({
        recurrenceGroupId: 'group-1',
        createdCount: 1,
        bookings: [createBooking()],
      })
    );

    component.selectedDate.set('2026-02-28');
    component.startTime.set('13:00');
    component.endTime.set('14:00');
    component.previewResult.set(createBookingPreview({ canBook: true }));
    component.customerName.set('Layla');
    component.customerPhone.set('0555555555');
    component.repeatWeekly.set(true);
    component.recurrenceFrequency.set(RecurrenceFrequency.WEEKLY);
    component.recurrenceEndMode.set('COUNT');
    component.recurrenceWeeksCount.set(8);

    component.onBook();

    expect(apiMock.createRecurringBooking).toHaveBeenCalledTimes(1);
    const payload = apiMock.createRecurringBooking.mock.calls[0][0];
    expect(payload.recurrenceRule.endsAtDate).toBe('2026-04-18');
    expect(payload.promoCode).toBeUndefined();
  });

  it('keeps end date in sync when weeks count changes in count mode', () => {
    const { component } = setupComponent();

    component.selectedDate.set('2026-03-01');
    component.repeatWeekly.set(true);
    component.recurrenceEndMode.set('COUNT');
    component.onRecurrenceWeeksCountChange(4);

    expect(component.recurrenceWeeksCount()).toBe(4);
    expect(component.recurrenceEndDate()).toBe('2026-03-22');
  });

  it('updates weeks count when end date changes in date mode', () => {
    const { component } = setupComponent();

    component.selectedDate.set('2026-03-01');
    component.repeatWeekly.set(true);
    component.recurrenceEndMode.set('DATE');
    component.onRecurrenceEndDateChange('2026-03-29');

    expect(component.recurrenceEndDate()).toBe('2026-03-29');
    expect(component.recurrenceWeeksCount()).toBe(5);
  });

  it('recomputes count-mode end date when selected date changes', () => {
    const { component } = setupComponent();

    component.repeatWeekly.set(true);
    component.recurrenceEndMode.set('COUNT');
    component.onRecurrenceWeeksCountChange(3);
    component.onDateChange('2026-03-10');

    expect(component.recurrenceEndDate()).toBe('2026-03-24');
  });

  it('sets booking success state after creation', () => {
    const { component } = setupComponent();
    apiMock.createBooking.mockReturnValueOnce(
      of(createBooking({ bookingReference: 'REF-1' }))
    );

    component.previewResult.set(createBookingPreview({ canBook: true }));
    component.customerName.set('Layla');
    component.customerPhone.set('0555555555');
    component.onBook();

    expect(component.bookingSuccess()).toBe(true);
    expect(component.bookingReference()).toBe('REF-1');
  });

  it('closes the confirmation dialog after booking success', () => {
    const { component } = setupComponent();
    apiMock.createBooking.mockReturnValueOnce(of(createBooking()));

    component.previewResult.set(createBookingPreview({ canBook: true }));
    component.customerName.set('Layla');
    component.customerPhone.set('0555555555');
    component.confirmDialogOpen.set(true);
    component.onBook();

    expect(component.confirmDialogOpen()).toBe(false);
  });

  it('resets customer details after booking success', () => {
    const { component } = setupComponent();
    apiMock.createBooking.mockReturnValueOnce(of(createBooking()));

    component.previewResult.set(createBookingPreview({ canBook: true }));
    component.customerName.set('Layla');
    component.customerPhone.set('0555555555');
    component.bookingSubmissionMode.set('HOLD');
    component.onBook();

    expect(component.customerName()).toBe('');
    expect(component.customerPhone()).toBe('');
    expect(component.bookingSubmissionMode()).toBe('CONFIRMED');
  });

  it('shows hold-specific success and toast copy after creating a hold', () => {
    const { component } = setupComponent();
    apiMock.createBooking.mockReturnValueOnce(
      of(createBooking({ bookingReference: 'REF-HOLD' }))
    );

    component.previewResult.set(createBookingPreview({ canBook: true }));
    component.customerName.set('Layla');
    component.customerPhone.set('0555555555');
    component.bookingSubmissionMode.set('HOLD');
    component.onBook();

    expect(component.lastSuccessfulBookingMode()).toBe('HOLD');
    expect(component.bookingSuccessCopy().title).toBe(
      'Booking Placed on Hold!'
    );
    expect(component.toast()?.message).toBe('Booking placed on hold');
  });

  it('clears preview results after booking success', () => {
    const { component } = setupComponent();
    apiMock.createBooking.mockReturnValueOnce(of(createBooking()));

    component.previewResult.set(createBookingPreview({ canBook: true }));
    component.customerName.set('Layla');
    component.customerPhone.set('0555555555');
    component.onBook();

    expect(component.previewResult()).toBeNull();
  });

  it('sets error message from API response when booking fails', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    apiMock.createBooking.mockReturnValueOnce(
      throwError(() => ({ error: { message: 'Slot unavailable' } }))
    );

    const { component } = setupComponent();

    component.previewResult.set(createBookingPreview({ canBook: true }));
    component.customerName.set('Layla');
    component.customerPhone.set('0555555555');
    component.onBook();

    expect(component.error()?.message).toBe('Slot unavailable');
    expect(component.bookingInProgress()).toBe(false);
  });

  it('uses a generic error message when booking fails without details', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    apiMock.createBooking.mockReturnValueOnce(
      throwError(() => ({ error: null }))
    );

    const { component } = setupComponent();

    component.previewResult.set(createBookingPreview({ canBook: true }));
    component.customerName.set('Layla');
    component.customerPhone.set('0555555555');
    component.onBook();

    expect(component.error()?.message).toBe(
      'Failed to create booking. Please try again.'
    );
  });

  it('reopens the confirmation dialog when retrying a booking error', () => {
    const { component } = setupComponent();

    component.previewResult.set(createBookingPreview({ canBook: true }));
    component.customerName.set('Layla');
    component.customerPhone.set('0555555555');
    component.lastAction.set('booking');
    component.error.set({
      action: 'booking',
      category: 'server',
      message: 'Failed to create booking. Please try again.',
      status: 500,
    });

    component.retry();

    expect(component.confirmDialogOpen()).toBe(true);
  });

  it('resets booking success state when requested', () => {
    const { component } = setupComponent();

    component.bookingSuccess.set(true);
    component.bookingReference.set('REF-2');
    component.customerName.set('Layla');
    component.customerPhone.set('0555555555');
    component.bookingSubmissionMode.set('HOLD');
    component.lastSuccessfulBookingMode.set('HOLD');
    component.resetBooking();

    expect(component.bookingSuccess()).toBe(false);
    expect(component.bookingReference()).toBeNull();
    expect(component.customerName()).toBe('');
    expect(component.customerPhone()).toBe('');
    expect(component.bookingSubmissionMode()).toBe('CONFIRMED');
    expect(component.lastSuccessfulBookingMode()).toBeNull();
  });

  it('keeps preview results when loading facilities succeeds', () => {
    const { component } = setupComponent();

    component.previewResult.set(createBookingPreview({ canBook: true }));

    expect(component.previewResult()).not.toBeNull();
  });

  it('updates selected facility when facilities are reloaded', () => {
    const { component } = setupComponent();
    const facility = createFacility({ id: 'facility-2' });

    component.facilities.set([facility]);
    component.selectedFacilityId.set(facility.id);

    expect(component.selectedFacilityId()).toBe('facility-2');
  });

  it('validates that start time must be before end time', () => {
    const { component } = setupComponent();

    component.startTime.set('15:00');
    component.endTime.set('14:00');

    expect(component.isValidTimeRange()).toBe(false);
    expect(component.inputsValid()).toBe(false);
  });

  it('allows valid time ranges', () => {
    const { component } = setupComponent();

    component.startTime.set('10:00');
    component.endTime.set('11:00');

    expect(component.isValidTimeRange()).toBe(true);
    expect(component.inputsValid()).toBe(true);
  });

  it('generates validation error messages for missing inputs', () => {
    const { component } = setupComponent();

    component.selectedFacilityId.set('');
    component.selectedDate.set('');
    component.startTime.set('');
    component.endTime.set('');

    const errors = component.validationErrors();
    expect(errors).toContain('Facility is required');
    expect(errors).toContain('Date is required');
    expect(errors).toContain('Start time is required');
    expect(errors).toContain('End time is required');
  });

  it('generates validation error for invalid time range', () => {
    const { component } = setupComponent();

    component.startTime.set('15:00');
    component.endTime.set('14:00');

    const errors = component.validationErrors();
    expect(errors).toContain('Start time must be before end time');
  });

  it('does not generate validation error messages when inputs are valid', () => {
    const { component } = setupComponent();

    expect(component.validationErrors()).toEqual([]);
  });

  it('attempts booking offline and shows error', () => {
    const { component } = setupComponent();

    component.previewResult.set(createBookingPreview({ canBook: true }));
    component.customerName.set('Layla');
    component.customerPhone.set('0555555555');
    component.isOnline.set(false);
    component.onBook();

    expect(component.error()?.message).toContain('offline');
    expect(component.confirmDialogOpen()).toBe(false);
    expect(apiMock.createBooking).not.toHaveBeenCalled();
  });

  it('closes confirmation dialog when offline booking is attempted', () => {
    const { component } = setupComponent();

    component.previewResult.set(createBookingPreview({ canBook: true }));
    component.customerName.set('Layla');
    component.customerPhone.set('0555555555');
    component.confirmDialogOpen.set(true);
    component.isOnline.set(false);
    component.onBook();

    expect(component.confirmDialogOpen()).toBe(false);
  });

  it('displays validation errors with aria-live for accessibility', () => {
    const { component } = setupComponent();

    component.selectedFacilityId.set('');
    component.startTime.set('15:00');
    component.endTime.set('14:00');

    expect(component.validationErrors().length).toBeGreaterThan(0);
  });

  it('prevents booking when customer name is missing', () => {
    const { component } = setupComponent();

    component.previewResult.set(createBookingPreview({ canBook: true }));
    component.customerName.set('');
    component.customerPhone.set('0555555555');

    expect(component.canBook()).toBe(false);
  });

  it('prevents booking when customer phone is missing', () => {
    const { component } = setupComponent();

    component.previewResult.set(createBookingPreview({ canBook: true }));
    component.customerName.set('Layla');
    component.customerPhone.set('');

    expect(component.canBook()).toBe(false);
  });

  it('allows booking with valid customer details and preview', () => {
    const { component } = setupComponent();

    component.previewResult.set(createBookingPreview({ canBook: true }));
    component.customerName.set('Layla');
    component.customerPhone.set('0555555555');

    expect(component.canBook()).toBe(true);
  });

  it('closes confirmation dialog on escape key by calling closeConfirmDialog', () => {
    const { component } = setupComponent();

    component.confirmDialogOpen.set(true);
    component.closeConfirmDialog();

    expect(component.confirmDialogOpen()).toBe(false);
  });

  it('does not close confirmation dialog during booking', () => {
    const { component } = setupComponent();

    component.confirmDialogOpen.set(true);
    component.bookingInProgress.set(true);
    component.closeConfirmDialog();

    expect(component.confirmDialogOpen()).toBe(true);
  });

  it('shows aria-invalid on inputs with missing values', () => {
    const { component } = setupComponent();

    component.selectedFacilityId.set('');
    component.selectedDate.set('');

    expect(component.selectedFacilityId().trim().length).toBe(0);
    expect(component.selectedDate().trim().length).toBe(0);
  });

  it('shows aria-invalid on time inputs with invalid range', () => {
    const { component } = setupComponent();

    component.startTime.set('15:00');
    component.endTime.set('14:00');

    expect(component.isValidTimeRange()).toBe(false);
  });
});
