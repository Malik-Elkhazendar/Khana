import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { patchState } from '@ngrx/signals';
import { of, throwError, Subject } from 'rxjs';
import { BookingStore } from './booking.store';
import { ApiService } from '../../shared/services/api.service';
import { BookingStatus, PaymentStatus } from '@khana/shared-dtos';
import { createApiMock, ApiServiceMock } from '../../testing/api-mocks';
import { createBooking } from '../../testing/factories';

const createHttpError = (status: number, message?: string) =>
  new HttpErrorResponse({
    status,
    error: message ? { message } : null,
  });

describe('BookingStore', () => {
  let store: BookingStore;
  let apiMock: ApiServiceMock;

  const seedBooking = (overrides = {}) => {
    const booking = createBooking({ id: 'booking-1', ...overrides });
    patchState(store, { bookings: [booking] });
    return booking;
  };

  const seedTwoBookings = () => {
    const first = createBooking({ id: 'booking-1' });
    const second = createBooking({ id: 'booking-2' });
    patchState(store, { bookings: [first, second] });
    return { first, second };
  };

  beforeEach(() => {
    apiMock = createApiMock();
    TestBed.configureTestingModule({
      providers: [{ provide: ApiService, useValue: apiMock }],
    });
    store = TestBed.inject(BookingStore);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('initializes with empty state', () => {
    expect(store.bookings()).toEqual([]);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
    expect(store.errorCode()).toBeNull();
    expect(store.filter()).toEqual({ facilityId: null });
  });

  it('calls getBookings without facility filter by default', () => {
    store.loadBookings(null);

    expect(apiMock.getBookings).toHaveBeenCalledWith(undefined);
  });

  it('calls getBookings with facility filter when provided', () => {
    store.loadBookings('facility-1');

    expect(apiMock.getBookings).toHaveBeenCalledWith('facility-1');
  });

  it('sets loading true while bookings request is in flight', () => {
    const subject = new Subject();
    apiMock.getBookings.mockReturnValueOnce(subject.asObservable());

    store.loadBookings(null);

    expect(store.loading()).toBe(true);

    subject.next([]);
    subject.complete();

    expect(store.loading()).toBe(false);
  });

  it('populates bookings on successful load', () => {
    const booking = createBooking({ id: 'booking-9' });
    apiMock.getBookings.mockReturnValueOnce(of([booking]));

    store.loadBookings(null);

    expect(store.bookings()).toEqual([booking]);
    expect(store.error()).toBeNull();
  });

  it('clears previous error state when loading bookings', () => {
    patchState(store, {
      error: new Error('Previous error'),
      errorCode: 'SERVER_ERROR',
    });

    store.loadBookings(null);

    expect(store.error()).toBeNull();
    expect(store.errorCode()).toBeNull();
  });

  it.each([
    [0, 'NETWORK'],
    [400, 'VALIDATION'],
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
    [409, 'CONFLICT'],
    [500, 'SERVER_ERROR'],
    [418, 'UNKNOWN'],
  ])('maps HTTP status %s to error code %s', (status, code) => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    apiMock.getBookings.mockReturnValueOnce(
      throwError(() => createHttpError(status))
    );

    store.loadBookings(null);

    expect(store.errorCode()).toBe(code);
    expect(store.error()).not.toBeNull();
    expect(store.loading()).toBe(false);
  });

  it('uses the server-provided error message when available', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    apiMock.getBookings.mockReturnValueOnce(
      throwError(() => createHttpError(400, 'Invalid filter'))
    );

    store.loadBookings(null);

    expect(store.error()?.message).toBe('Invalid filter');
  });

  it('maps non-HTTP load errors to UNKNOWN', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    apiMock.getBookings.mockReturnValueOnce(
      throwError(() => new Error('Boom'))
    );

    store.loadBookings(null);

    expect(store.errorCode()).toBe('UNKNOWN');
  });

  it('retains existing bookings when load fails', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const booking = seedBooking();
    apiMock.getBookings.mockReturnValueOnce(
      throwError(() => createHttpError(500))
    );

    store.loadBookings(null);

    expect(store.bookings()).toEqual([booking]);
  });

  it('returns false when confirming a missing booking', async () => {
    const result = await store.confirmBooking('missing');

    expect(result).toBe(false);
    expect(store.errorCode()).toBe('NOT_FOUND');
  });

  it('returns false when marking paid for a missing booking', async () => {
    const result = await store.markBookingPaid('missing');

    expect(result).toBe(false);
    expect(store.errorCode()).toBe('NOT_FOUND');
  });

  it('returns false when cancelling a missing booking', async () => {
    const result = await store.cancelBooking('missing', 'Reason');

    expect(result).toBe(false);
    expect(store.errorCode()).toBe('NOT_FOUND');
  });

  it('optimistically confirms a booking', async () => {
    const booking = seedBooking({ status: BookingStatus.PENDING });
    apiMock.updateBookingStatus.mockReturnValueOnce(
      of({ ...booking, status: BookingStatus.CONFIRMED })
    );

    const action = store.confirmBooking(booking.id);

    expect(store.bookings()[0].status).toBe(BookingStatus.CONFIRMED);
    await action;
  });

  it('calls updateBookingStatus with confirmed status', async () => {
    const booking = seedBooking({ status: BookingStatus.PENDING });
    apiMock.updateBookingStatus.mockReturnValueOnce(
      of({ ...booking, status: BookingStatus.CONFIRMED })
    );

    await store.confirmBooking(booking.id);

    expect(apiMock.updateBookingStatus).toHaveBeenCalledWith(
      booking.id,
      BookingStatus.CONFIRMED,
      undefined,
      undefined
    );
  });

  it('optimistically marks a booking as paid', async () => {
    const booking = seedBooking({ paymentStatus: PaymentStatus.PENDING });
    apiMock.updateBookingStatus.mockReturnValueOnce(
      of({ ...booking, paymentStatus: PaymentStatus.PAID })
    );

    const action = store.markBookingPaid(booking.id);

    expect(store.bookings()[0].paymentStatus).toBe(PaymentStatus.PAID);
    await action;
  });

  it('calls updateBookingStatus with paid status', async () => {
    const booking = seedBooking({ paymentStatus: PaymentStatus.PENDING });
    apiMock.updateBookingStatus.mockReturnValueOnce(
      of({ ...booking, paymentStatus: PaymentStatus.PAID })
    );

    await store.markBookingPaid(booking.id);

    expect(apiMock.updateBookingStatus).toHaveBeenCalledWith(
      booking.id,
      undefined,
      PaymentStatus.PAID,
      undefined
    );
  });

  it('optimistically cancels a booking and stores the reason', async () => {
    const booking = seedBooking({ status: BookingStatus.CONFIRMED });
    apiMock.updateBookingStatus.mockReturnValueOnce(
      of({
        ...booking,
        status: BookingStatus.CANCELLED,
        cancellationReason: 'Customer request',
      })
    );

    const action = store.cancelBooking(booking.id, 'Customer request');

    expect(store.bookings()[0].status).toBe(BookingStatus.CANCELLED);
    expect(store.bookings()[0].cancellationReason).toBe('Customer request');
    await action;
  });

  it('trims cancellation reasons before sending to the API', async () => {
    const booking = seedBooking({ status: BookingStatus.CONFIRMED });
    apiMock.updateBookingStatus.mockReturnValueOnce(of(booking));

    await store.cancelBooking(booking.id, '  Too noisy  ');

    expect(apiMock.updateBookingStatus).toHaveBeenCalledWith(
      booking.id,
      BookingStatus.CANCELLED,
      undefined,
      'Too noisy'
    );
  });

  it('rejects cancellation without a reason', async () => {
    const booking = seedBooking({ status: BookingStatus.CONFIRMED });

    const result = await store.cancelBooking(booking.id, '');

    expect(result).toBe(false);
    expect(store.errorCode()).toBe('VALIDATION');
    expect(store.actionErrorsById()[booking.id]).toBe(
      'Cancellation reason is required'
    );
  });

  it('rejects cancellation with only whitespace', async () => {
    const booking = seedBooking({ status: BookingStatus.CONFIRMED });

    const result = await store.cancelBooking(booking.id, '   ');

    expect(result).toBe(false);
    expect(store.errorCode()).toBe('VALIDATION');
  });

  it('does not set action loading when cancellation validation fails', async () => {
    const booking = seedBooking({ status: BookingStatus.CONFIRMED });

    await store.cancelBooking(booking.id, '');

    expect(store.actionLoadingById()[booking.id]).not.toBe(true);
  });

  it('does not change booking state when cancellation validation fails', async () => {
    const booking = seedBooking({ status: BookingStatus.CONFIRMED });

    await store.cancelBooking(booking.id, '');

    expect(store.bookings()[0].status).toBe(BookingStatus.CONFIRMED);
  });

  it('clears previous action errors for the booking before running an action', async () => {
    const booking = seedBooking({ status: BookingStatus.PENDING });
    patchState(store, {
      actionErrorsById: { [booking.id]: 'Previous error' },
    });
    apiMock.updateBookingStatus.mockReturnValueOnce(of(booking));

    await store.confirmBooking(booking.id);

    expect(store.actionErrorsById()[booking.id]).toBeNull();
  });

  it('keeps action errors cleared after a successful action', async () => {
    const booking = seedBooking({ status: BookingStatus.PENDING });
    patchState(store, {
      actionErrorsById: { [booking.id]: 'Previous error' },
    });
    apiMock.updateBookingStatus.mockReturnValueOnce(of(booking));

    await store.confirmBooking(booking.id);

    expect(store.actionErrorsById()[booking.id]).toBeNull();
  });

  it('toggles action loading state while confirming', async () => {
    const booking = seedBooking({ status: BookingStatus.PENDING });
    const subject = new Subject();
    apiMock.updateBookingStatus.mockReturnValueOnce(subject.asObservable());

    const action = store.confirmBooking(booking.id);

    expect(store.actionLoadingById()[booking.id]).toBe(true);

    subject.next(booking);
    subject.complete();
    await action;

    expect(store.actionLoadingById()[booking.id]).toBe(false);
  });

  it('toggles action loading state while marking paid', async () => {
    const booking = seedBooking({ paymentStatus: PaymentStatus.PENDING });
    const subject = new Subject();
    apiMock.updateBookingStatus.mockReturnValueOnce(subject.asObservable());

    const action = store.markBookingPaid(booking.id);

    expect(store.actionLoadingById()[booking.id]).toBe(true);

    subject.next(booking);
    subject.complete();
    await action;

    expect(store.actionLoadingById()[booking.id]).toBe(false);
  });

  it('toggles action loading state while cancelling', async () => {
    const booking = seedBooking({ status: BookingStatus.CONFIRMED });
    const subject = new Subject();
    apiMock.updateBookingStatus.mockReturnValueOnce(subject.asObservable());

    const action = store.cancelBooking(booking.id, 'Too late');

    expect(store.actionLoadingById()[booking.id]).toBe(true);

    subject.next(booking);
    subject.complete();
    await action;

    expect(store.actionLoadingById()[booking.id]).toBe(false);
  });

  it('rolls back confirmation on API failure', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const booking = seedBooking({ status: BookingStatus.PENDING });
    apiMock.updateBookingStatus.mockReturnValueOnce(
      throwError(() => createHttpError(500))
    );

    await store.confirmBooking(booking.id);

    expect(store.bookings()[0].status).toBe(BookingStatus.PENDING);
    expect(store.errorCode()).toBe('SERVER_ERROR');
  });

  it('uses UNKNOWN error code for non-HTTP action failures', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const booking = seedBooking({ status: BookingStatus.PENDING });
    apiMock.updateBookingStatus.mockReturnValueOnce(
      throwError(() => new Error('Boom'))
    );

    await store.confirmBooking(booking.id);

    expect(store.errorCode()).toBe('UNKNOWN');
  });

  it('rolls back mark paid on API failure', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const booking = seedBooking({ paymentStatus: PaymentStatus.PENDING });
    apiMock.updateBookingStatus.mockReturnValueOnce(
      throwError(() => createHttpError(500))
    );

    await store.markBookingPaid(booking.id);

    expect(store.bookings()[0].paymentStatus).toBe(PaymentStatus.PENDING);
    expect(store.errorCode()).toBe('SERVER_ERROR');
  });

  it('rolls back cancellation on API failure', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const booking = seedBooking({ status: BookingStatus.CONFIRMED });
    apiMock.updateBookingStatus.mockReturnValueOnce(
      throwError(() => createHttpError(409))
    );

    await store.cancelBooking(booking.id, 'Schedule conflict');

    expect(store.bookings()[0].status).toBe(BookingStatus.CONFIRMED);
    expect(store.errorCode()).toBe('CONFLICT');
  });

  it('stores action error messages on failure', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const booking = seedBooking({ status: BookingStatus.PENDING });
    apiMock.updateBookingStatus.mockReturnValueOnce(
      throwError(() => createHttpError(500))
    );

    await store.confirmBooking(booking.id);

    expect(store.actionErrorsById()[booking.id]).toBe(
      store.error()?.message ?? ''
    );
  });

  it('clears global error state after a successful action', async () => {
    const booking = seedBooking({ status: BookingStatus.PENDING });
    patchState(store, {
      error: new Error('Old error'),
      errorCode: 'SERVER_ERROR',
    });
    apiMock.updateBookingStatus.mockReturnValueOnce(of(booking));

    await store.confirmBooking(booking.id);

    expect(store.error()).toBeNull();
    expect(store.errorCode()).toBeNull();
  });

  it('deduplicates in-flight actions for the same booking', async () => {
    const booking = seedBooking({ status: BookingStatus.PENDING });
    const subject = new Subject();
    apiMock.updateBookingStatus.mockReturnValueOnce(subject.asObservable());

    const first = store.confirmBooking(booking.id);
    const second = store.confirmBooking(booking.id);

    expect(apiMock.updateBookingStatus).toHaveBeenCalledTimes(1);

    subject.next({ ...booking, status: BookingStatus.CONFIRMED });
    subject.complete();

    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(true);
  });

  it('allows concurrent actions for different bookings', async () => {
    const { first, second } = seedTwoBookings();
    const subjectA = new Subject();
    const subjectB = new Subject();
    apiMock.updateBookingStatus
      .mockReturnValueOnce(subjectA.asObservable())
      .mockReturnValueOnce(subjectB.asObservable());

    const firstPromise = store.confirmBooking(first.id);
    const secondPromise = store.confirmBooking(second.id);

    expect(apiMock.updateBookingStatus).toHaveBeenCalledTimes(2);

    subjectA.next({ ...first, status: BookingStatus.CONFIRMED });
    subjectA.complete();
    subjectB.next({ ...second, status: BookingStatus.CONFIRMED });
    subjectB.complete();

    await expect(firstPromise).resolves.toBe(true);
    await expect(secondPromise).resolves.toBe(true);
  });

  it('updates the facility filter', () => {
    store.setFacilityFilter('facility-2');

    expect(store.filter()).toEqual({ facilityId: 'facility-2' });
  });

  it('resets the facility filter to null', () => {
    store.setFacilityFilter('facility-2');
    store.setFacilityFilter(null);

    expect(store.filter()).toEqual({ facilityId: null });
  });
});
