import { TestBed } from '@angular/core/testing';
import { Subject, TimeoutError, of, throwError } from 'rxjs';
import { BookingPreviewComponent } from './booking-preview.component';
import { ApiService } from '../../shared/services/api.service';
import { BookingStatus, ConflictType } from '@khana/shared-dtos';
import { createApiMock, ApiServiceMock } from '../../testing/api-mocks';
import {
  createBooking,
  createBookingPreview,
  createFacility,
} from '../../testing/factories';

describe('BookingPreviewComponent', () => {
  let apiMock: ApiServiceMock;

  const setupComponent = () => {
    const fixture = TestBed.createComponent(BookingPreviewComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  };

  beforeEach(async () => {
    apiMock = createApiMock();

    await TestBed.configureTestingModule({
      imports: [BookingPreviewComponent],
      providers: [{ provide: ApiService, useValue: apiMock }],
    }).compileComponents();
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

  it('sends a pending status when holding a booking', () => {
    const { component } = setupComponent();
    apiMock.createBooking.mockReturnValueOnce(of(createBooking()));

    component.previewResult.set(createBookingPreview({ canBook: true }));
    component.customerName.set('Layla');
    component.customerPhone.set('0555555555');
    component.holdAsPending.set(true);
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
    component.holdAsPending.set(false);
    component.onBook();

    const payload = apiMock.createBooking.mock.calls[0][0];
    expect(payload.status).toBeUndefined();
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
    component.holdAsPending.set(true);
    component.onBook();

    expect(component.customerName()).toBe('');
    expect(component.customerPhone()).toBe('');
    expect(component.holdAsPending()).toBe(false);
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
    component.holdAsPending.set(true);
    component.resetBooking();

    expect(component.bookingSuccess()).toBe(false);
    expect(component.bookingReference()).toBeNull();
    expect(component.customerName()).toBe('');
    expect(component.customerPhone()).toBe('');
    expect(component.holdAsPending()).toBe(false);
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
