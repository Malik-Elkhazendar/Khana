import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
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

    expect(component.error()).toBe(
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

    component.loading.set(true);
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

    component.error.set('Old error');
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
    component.onSubmit();

    expect(apiMock.previewBooking).toHaveBeenCalledTimes(1);
  });

  it('expires cache entries after two minutes', () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-03-01T10:00:00Z'));
    const { component } = setupComponent();
    apiMock.previewBooking.mockReturnValue(of(createBookingPreview()));

    component.onSubmit();
    component.onSubmit();
    jest.advanceTimersByTime(2 * 60 * 1000 + 1);
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
    component.promoCode.set('SAVE10');
    component.onSubmit();

    expect(apiMock.previewBooking).toHaveBeenCalledTimes(1);
  });

  it('invalidates cache when time inputs change', () => {
    const { component } = setupComponent();
    apiMock.previewBooking.mockReturnValue(of(createBookingPreview()));

    component.startTime.set('10:00');
    component.endTime.set('11:00');
    component.onSubmit();
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

    expect(component.error()).toBe('Facility not found.');
    expect(component.loading()).toBe(false);
  });

  it('sets a generic error message for preview failures', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    apiMock.previewBooking.mockReturnValueOnce(
      throwError(() => ({ status: 500 }))
    );

    const { component } = setupComponent();

    component.onSubmit();

    expect(component.error()).toBe(
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

    expect(component.error()).toBe('Slot unavailable');
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

    expect(component.error()).toBe(
      'Failed to create booking. Please try again.'
    );
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
});
