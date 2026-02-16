import { TestBed } from '@angular/core/testing';
import { ElementRef } from '@angular/core';
import { BookingCalendarComponent } from './booking-calendar.component';
import { BookingStore } from '../../state/bookings/booking.store';
import { BookingStatus, PaymentStatus } from '@khana/shared-dtos';
import { createBooking } from '../../testing/factories';
import { createStoreMock, BookingStoreMock } from '../../testing/store-mocks';

describe('BookingCalendarComponent', () => {
  let storeMock: BookingStoreMock;
  const baseDate = new Date('2025-03-05T10:00:00Z');

  const createTimedBooking = (overrides = {}) => {
    return createBooking({
      id: 'booking-1',
      startTime: '2025-03-05T10:00:00Z',
      endTime: '2025-03-05T11:00:00Z',
      status: BookingStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PENDING,
      ...overrides,
    });
  };

  const setupComponent = (bookings = []) => {
    storeMock.bookings.set(bookings);
    const fixture = TestBed.createComponent(BookingCalendarComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  };

  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(baseDate);
    storeMock = createStoreMock();

    await TestBed.configureTestingModule({
      imports: [BookingCalendarComponent],
      providers: [{ provide: BookingStore, useValue: storeMock }],
    }).compileComponents();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('loads bookings on init', () => {
    setupComponent();

    expect(storeMock.loadBookings).toHaveBeenCalledWith(null);
  });

  it('renders error banner and retries loading bookings', () => {
    storeMock.error.set(new Error('Load failed'));
    const { fixture } = setupComponent();

    storeMock.loadBookings.mockClear();
    const retryButton = fixture.nativeElement.querySelector(
      '.calendar__error button'
    ) as HTMLButtonElement | null;
    retryButton?.click();

    expect(fixture.nativeElement.textContent).toContain('Load failed');
    expect(storeMock.loadBookings).toHaveBeenCalledWith(null);
  });

  it('clears the error when dismissing recovery options', () => {
    storeMock.error.set(new Error('Load failed'));
    const { component } = setupComponent();

    component.handleErrorRecovery('dismiss');

    expect(storeMock.clearError).toHaveBeenCalled();
  });

  it('categorizes errors and exposes recovery options', () => {
    storeMock.error.set(new Error('Network error'));
    storeMock.errorCode.set('NETWORK');
    const { component } = setupComponent();

    expect(component.errorCategory()).toBe('network');
    expect(
      component.errorRecoveryOptions().map((option) => option.action)
    ).toContain('retry');
  });

  it('auto-retries failed loads with backoff for network errors', () => {
    storeMock.error.set(new Error('Network error'));
    storeMock.errorCode.set('NETWORK');
    setupComponent();

    storeMock.loadBookings.mockClear();
    jest.runOnlyPendingTimers();

    expect(storeMock.loadBookings).toHaveBeenCalledWith(null);
  });

  it('does not auto-retry validation errors', () => {
    storeMock.error.set(new Error('Validation error'));
    storeMock.errorCode.set('VALIDATION');
    setupComponent();

    storeMock.loadBookings.mockClear();
    jest.runOnlyPendingTimers();

    expect(storeMock.loadBookings).not.toHaveBeenCalled();
  });

  it('retains the last successful bookings when errors occur', () => {
    const booking = createTimedBooking();
    const { component } = setupComponent([booking]);

    storeMock.error.set(new Error('Load failed'));
    storeMock.errorCode.set('SERVER_ERROR');

    expect(component.displayBookings()).toEqual([booking]);
  });

  it('marks the calendar as busy while loading', () => {
    storeMock.loading.set(true);
    const { fixture } = setupComponent();

    const main = fixture.nativeElement.querySelector(
      'main.calendar'
    ) as HTMLElement | null;
    const loading = fixture.nativeElement.querySelector(
      '.calendar__loading'
    ) as HTMLElement | null;

    expect(main?.getAttribute('aria-busy')).toBe('true');
    expect(loading?.getAttribute('aria-live')).toBe('polite');
  });

  it('renders the empty state when no bookings are available', () => {
    const { fixture } = setupComponent([]);

    const empty = fixture.nativeElement.querySelector(
      '.calendar__empty'
    ) as HTMLElement | null;

    expect(empty?.textContent).toContain('No bookings');
  });

  it('builds a week starting on Sunday', () => {
    const { component } = setupComponent();

    const week = component.weekDays();
    expect(week.length).toBe(7);
    expect(week[0].getDay()).toBe(0);
    expect(week[6].getDay()).toBe(6);
  });

  it('includes the year in the week range label', () => {
    const { component } = setupComponent();

    expect(component.weekRange()).toContain('2025');
  });

  it('navigates to the previous week', () => {
    const { component } = setupComponent();
    const current = component.currentDate().getTime();

    component.previousWeek();

    const updated = component.currentDate().getTime();
    expect(updated).toBe(current - 7 * 24 * 60 * 60 * 1000);
  });

  it('navigates to the next week', () => {
    const { component } = setupComponent();
    const current = component.currentDate().getTime();

    component.nextWeek();

    const updated = component.currentDate().getTime();
    expect(updated).toBe(current + 7 * 24 * 60 * 60 * 1000);
  });

  it('throttles rapid navigation', () => {
    const { component } = setupComponent();
    const current = component.currentDate().getTime();

    component.nextWeek();
    const afterFirst = component.currentDate().getTime();
    component.nextWeek();

    expect(component.currentDate().getTime()).toBe(afterFirst);

    jest.runOnlyPendingTimers();
    component.nextWeek();

    expect(component.currentDate().getTime()).toBe(
      current + 14 * 24 * 60 * 60 * 1000
    );
  });

  it('returns to the current week when requested', () => {
    const { component } = setupComponent();
    component.currentDate.set(new Date('2025-02-01T00:00:00Z'));

    component.goToToday();

    const updated = component.currentDate();
    expect(updated.getFullYear()).toBe(2025);
    expect(updated.getMonth()).toBe(baseDate.getMonth());
    expect(updated.getDate()).toBe(baseDate.getDate());
  });

  it('detects today correctly', () => {
    const { component } = setupComponent();
    const today = new Date(baseDate);
    const otherDay = new Date('2025-03-08T00:00:00Z');

    expect(component.isToday(today)).toBe(true);
    expect(component.isToday(otherDay)).toBe(false);
  });

  it('returns bookings for a specific day/hour slot', () => {
    const booking = createTimedBooking({
      startTime: '2025-03-05T10:30:00Z',
      endTime: '2025-03-05T11:30:00Z',
    });
    const { component } = setupComponent([booking]);
    const start = new Date(booking.startTime);
    const day = new Date(start);
    day.setHours(0, 0, 0, 0);
    const hour = `${start.getHours().toString().padStart(2, '0')}:00`;

    const result = component.getBookingsForSlot(day, hour);

    expect(result.map((segment) => segment.booking)).toEqual([booking]);
  });

  it('returns empty array for empty slots', () => {
    const { component } = setupComponent();
    const day = new Date('2025-03-05T00:00:00Z');

    expect(component.getBookingsForSlot(day, '10:00')).toEqual([]);
  });

  it('splits bookings that span multiple days into day segments', () => {
    const booking = createTimedBooking({
      startTime: '2025-03-05T23:00:00',
      endTime: '2025-03-06T02:00:00',
    });
    const { component } = setupComponent([booking]);

    const segments = component.bookingSegments();
    const dayKeys = new Set(segments.map((segment) => segment.dayKey));

    expect(segments.length).toBe(2);
    expect(dayKeys.size).toBe(2);
    expect(
      component.getBookingsForSlot(new Date('2025-03-06T00:00:00'), '00:00')
        .length
    ).toBe(1);
  });

  it('assigns columns for overlapping bookings', () => {
    const first = createTimedBooking({
      id: 'booking-1',
      startTime: '2025-03-05T10:00:00Z',
      endTime: '2025-03-05T11:00:00Z',
    });
    const second = createTimedBooking({
      id: 'booking-2',
      startTime: '2025-03-05T10:30:00Z',
      endTime: '2025-03-05T11:30:00Z',
    });
    const { component } = setupComponent([first, second]);

    const layout = component.bookingLayout();
    const firstSegment = component
      .bookingSegments()
      .find((segment) => segment.booking.id === 'booking-1');
    const secondSegment = component
      .bookingSegments()
      .find((segment) => segment.booking.id === 'booking-2');

    expect(firstSegment).toBeDefined();
    expect(secondSegment).toBeDefined();
    expect(layout.get(firstSegment?.id ?? '')?.column).toBe(0);
    expect(layout.get(secondSegment?.id ?? '')?.column).toBe(1);
    expect(layout.get(firstSegment?.id ?? '')?.columns).toBe(2);
  });

  it('assigns a single column for non-overlapping bookings', () => {
    const first = createTimedBooking({
      id: 'booking-1',
      startTime: '2025-03-05T08:00:00Z',
      endTime: '2025-03-05T09:00:00Z',
    });
    const second = createTimedBooking({
      id: 'booking-2',
      startTime: '2025-03-05T09:00:00Z',
      endTime: '2025-03-05T10:00:00Z',
    });
    const { component } = setupComponent([first, second]);

    const layout = component.bookingLayout();
    const firstSegment = component
      .bookingSegments()
      .find((segment) => segment.booking.id === 'booking-1');
    const secondSegment = component
      .bookingSegments()
      .find((segment) => segment.booking.id === 'booking-2');

    expect(firstSegment).toBeDefined();
    expect(secondSegment).toBeDefined();
    expect(layout.get(firstSegment?.id ?? '')?.columns).toBe(1);
    expect(layout.get(secondSegment?.id ?? '')?.columns).toBe(1);
  });

  it('handles clusters of three overlapping bookings', () => {
    const first = createTimedBooking({
      id: 'booking-1',
      startTime: '2025-03-05T10:00:00Z',
      endTime: '2025-03-05T11:00:00Z',
    });
    const second = createTimedBooking({
      id: 'booking-2',
      startTime: '2025-03-05T10:15:00Z',
      endTime: '2025-03-05T11:15:00Z',
    });
    const third = createTimedBooking({
      id: 'booking-3',
      startTime: '2025-03-05T10:30:00Z',
      endTime: '2025-03-05T11:30:00Z',
    });
    const { component } = setupComponent([first, second, third]);

    const layout = component.bookingLayout();
    const firstSegment = component
      .bookingSegments()
      .find((segment) => segment.booking.id === 'booking-1');
    const secondSegment = component
      .bookingSegments()
      .find((segment) => segment.booking.id === 'booking-2');
    const thirdSegment = component
      .bookingSegments()
      .find((segment) => segment.booking.id === 'booking-3');

    expect(firstSegment).toBeDefined();
    expect(secondSegment).toBeDefined();
    expect(thirdSegment).toBeDefined();
    expect(layout.get(firstSegment?.id ?? '')?.columns).toBe(3);
    expect(layout.get(secondSegment?.id ?? '')?.columns).toBe(3);
    expect(layout.get(thirdSegment?.id ?? '')?.columns).toBe(3);
  });

  it('calculates booking styles based on time and columns', () => {
    const booking = createTimedBooking({
      startTime: '2025-03-05T10:15:00Z',
      endTime: '2025-03-05T11:45:00Z',
    });
    const { component } = setupComponent([booking]);
    const segment = component
      .bookingSegments()
      .find((item) => item.booking.id === booking.id);

    expect(segment).toBeDefined();
    const style = component.getBookingStyle(segment!, 1, 2);

    expect(style.top).toBe('25%');
    expect(style.height).toBe('calc(150% - var(--space-1))');
    expect(style.width).toBe('50%');
    expect(style.left).toBe('50%');
  });

  it('tracks layout calculation duration', () => {
    const booking = createTimedBooking();
    const { component } = setupComponent([booking]);

    expect(component.layoutDurationMs()).toBeGreaterThanOrEqual(0);
  });

  it('provides a default layout for unknown bookings', () => {
    const { component } = setupComponent();
    const booking = createTimedBooking({ id: 'unknown' });

    const segment = {
      id: 'unknown-0',
      booking,
      startMs: 0,
      endMs: 0,
      startHour: 0,
      startMinutes: 0,
      durationMs: 0,
      dayKey: '2025-03-05',
    };

    expect(component.getBookingLayout(segment)).toEqual({
      column: 0,
      columns: 1,
    });
  });

  it('updates selected booking from live store data', () => {
    const booking = createTimedBooking({ id: 'booking-1' });
    const { component } = setupComponent([booking]);

    component.selectedBooking.set(booking);
    storeMock.bookings.set([{ ...booking, status: BookingStatus.CANCELLED }]);

    expect(component.selectedBookingLive()?.status).toBe(
      BookingStatus.CANCELLED
    );
  });

  it('marks hold active for pending bookings with future holds', () => {
    const holdUntil = new Date(baseDate.getTime() + 60 * 1000).toISOString();
    const booking = createTimedBooking({
      status: BookingStatus.PENDING,
      holdUntil,
    });
    const { component } = setupComponent([booking]);

    expect(component.isHoldActive(booking)).toBe(true);
  });

  it('does not mark hold active for non-pending bookings', () => {
    const holdUntil = new Date(baseDate.getTime() + 60 * 1000).toISOString();
    const booking = createTimedBooking({
      status: BookingStatus.CONFIRMED,
      holdUntil,
    });
    const { component } = setupComponent([booking]);

    expect(component.isHoldActive(booking)).toBe(false);
  });

  it('does not mark hold active for expired holds', () => {
    const holdUntil = new Date(baseDate.getTime() - 60 * 1000).toISOString();
    const booking = createTimedBooking({
      status: BookingStatus.PENDING,
      holdUntil,
    });
    const { component } = setupComponent([booking]);

    expect(component.isHoldActive(booking)).toBe(false);
  });

  it('opens the action panel for a booking', () => {
    const booking = createTimedBooking();
    const { component } = setupComponent([booking]);

    component.openBooking(booking);

    expect(component.selectedBooking()).toEqual(booking);
  });

  it('focuses the close button when opening the panel', () => {
    const booking = createTimedBooking();
    const { component } = setupComponent([booking]);
    const closeButton = document.createElement('button');
    document.body.appendChild(closeButton);
    component.closeButton = new ElementRef(closeButton);

    component.openBooking(booking);
    jest.runAllTimers();

    expect(document.activeElement).toBe(closeButton);
    document.body.removeChild(closeButton);
  });

  it('closes the panel and resets dialog state', () => {
    const booking = createTimedBooking();
    const { component } = setupComponent([booking]);
    component.selectedBooking.set(booking);
    component.actionDialog.set({ type: 'confirm', bookingId: booking.id });
    component.cancelReason.set('Reason');

    component.closePanel();

    expect(component.selectedBooking()).toBeNull();
    expect(component.actionDialog()).toBeNull();
    expect(component.cancelReason()).toBe('');
  });

  it('restores focus to the trigger after closing the panel', () => {
    const booking = createTimedBooking();
    const { component } = setupComponent([booking]);
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    component.openBooking(booking, { currentTarget: trigger } as Event);
    jest.runAllTimers();
    component.closePanel();

    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
  });

  it('closes the panel when pressing Escape', () => {
    const booking = createTimedBooking();
    const { component } = setupComponent([booking]);
    component.selectedBooking.set(booking);
    const closeSpy = jest.spyOn(component, 'closePanel');

    component.onPanelKeydown({
      key: 'Escape',
      preventDefault: jest.fn(),
    } as unknown as KeyboardEvent);

    expect(closeSpy).toHaveBeenCalled();
  });

  it('cycles focus forward within the panel', () => {
    const { component } = setupComponent();
    const panel = document.createElement('div');
    const first = document.createElement('button');
    const last = document.createElement('button');
    panel.appendChild(first);
    panel.appendChild(last);
    document.body.appendChild(panel);
    component.actionPanel = new ElementRef(panel);

    last.focus();

    const event = {
      key: 'Tab',
      shiftKey: false,
      preventDefault: jest.fn(),
    } as unknown as KeyboardEvent;

    component.onPanelKeydown(event);

    expect(document.activeElement).toBe(first);
    expect(event.preventDefault).toHaveBeenCalled();
    document.body.removeChild(panel);
  });

  it('cycles focus backward within the panel', () => {
    const { component } = setupComponent();
    const panel = document.createElement('div');
    const first = document.createElement('button');
    const last = document.createElement('button');
    panel.appendChild(first);
    panel.appendChild(last);
    document.body.appendChild(panel);
    component.actionPanel = new ElementRef(panel);

    first.focus();

    const event = {
      key: 'Tab',
      shiftKey: true,
      preventDefault: jest.fn(),
    } as unknown as KeyboardEvent;

    component.onPanelKeydown(event);

    expect(document.activeElement).toBe(last);
    expect(event.preventDefault).toHaveBeenCalled();
    document.body.removeChild(panel);
  });

  it('moves slot focus with arrow keys', () => {
    const { component } = setupComponent();
    component.focusedSlot.set({ dayIndex: 0, hourIndex: 0 });
    const preventDefault = jest.fn();

    component.onSlotKeydown(
      { key: 'ArrowRight', preventDefault } as unknown as KeyboardEvent,
      0,
      0,
      []
    );

    expect(component.focusedSlot()).toEqual({ dayIndex: 1, hourIndex: 0 });
    expect(preventDefault).toHaveBeenCalled();
  });

  it('opens the first booking in a slot when pressing Enter', () => {
    const booking = createTimedBooking();
    const { component } = setupComponent([booking]);
    const start = new Date(booking.startTime);
    const day = new Date(start);
    day.setHours(0, 0, 0, 0);
    const dayIndex = component
      .weekDays()
      .findIndex(
        (candidate) =>
          candidate.getFullYear() === day.getFullYear() &&
          candidate.getMonth() === day.getMonth() &&
          candidate.getDate() === day.getDate()
      );
    const hourIndex = start.getHours();
    const slotBookings = component.getBookingsForSlot(
      day,
      `${start.getHours().toString().padStart(2, '0')}:00`
    );
    const openSpy = jest.spyOn(component, 'openBooking');
    const preventDefault = jest.fn();

    component.onSlotKeydown(
      { key: 'Enter', preventDefault } as unknown as KeyboardEvent,
      dayIndex,
      hourIndex,
      slotBookings
    );

    expect(openSpy).toHaveBeenCalledWith(booking, expect.any(Object));
    expect(preventDefault).toHaveBeenCalled();
  });

  it('opens the confirm dialog', () => {
    const booking = createTimedBooking();
    const { component } = setupComponent([booking]);
    component.selectedBooking.set(booking);

    component.openConfirmDialog();

    expect(component.actionDialog()).toEqual({
      type: 'confirm',
      bookingId: booking.id,
    });
  });

  it('opens the pay dialog', () => {
    const booking = createTimedBooking();
    const { component } = setupComponent([booking]);
    component.selectedBooking.set(booking);

    component.openPayDialog();

    expect(component.actionDialog()).toEqual({
      type: 'pay',
      bookingId: booking.id,
    });
  });

  it('opens the cancel dialog and clears the reason', () => {
    const booking = createTimedBooking();
    const { component } = setupComponent([booking]);
    component.selectedBooking.set(booking);
    component.cancelReason.set('Old reason');

    component.openCancelDialog();

    expect(component.actionDialog()).toEqual({
      type: 'cancel',
      bookingId: booking.id,
    });
    expect(component.cancelReason()).toBe('');
  });

  it('closes the dialog when requested', () => {
    const { component } = setupComponent();
    component.actionDialog.set({ type: 'confirm', bookingId: 'booking-1' });
    component.cancelReason.set('Reason');

    component.closeDialog();

    expect(component.actionDialog()).toBeNull();
    expect(component.cancelReason()).toBe('');
  });

  it('does not submit cancel action when reason is too short', async () => {
    const booking = createTimedBooking();
    const { component } = setupComponent([booking]);
    component.selectedBooking.set(booking);
    component.actionDialog.set({ type: 'cancel', bookingId: booking.id });
    component.cancelReason.set('no');

    await component.submitDialogAction();

    expect(storeMock.cancelBooking).not.toHaveBeenCalled();
  });

  it('submits confirm action through the dialog', async () => {
    const booking = createTimedBooking();
    const { component } = setupComponent([booking]);
    component.selectedBooking.set(booking);
    component.actionDialog.set({ type: 'confirm', bookingId: booking.id });

    await component.submitDialogAction();

    expect(storeMock.confirmBooking).toHaveBeenCalledWith(booking.id);
    expect(component.actionDialog()).toBeNull();
  });

  it('submits pay action through the dialog', async () => {
    const booking = createTimedBooking();
    const { component } = setupComponent([booking]);
    component.selectedBooking.set(booking);
    component.actionDialog.set({ type: 'pay', bookingId: booking.id });

    await component.submitDialogAction();

    expect(storeMock.markBookingPaid).toHaveBeenCalledWith(booking.id);
    expect(component.actionDialog()).toBeNull();
  });

  it('submits cancel action through the dialog with trimmed reason', async () => {
    const booking = createTimedBooking();
    const { component } = setupComponent([booking]);
    component.selectedBooking.set(booking);
    component.actionDialog.set({ type: 'cancel', bookingId: booking.id });
    component.cancelReason.set('  Too late  ');

    await component.submitDialogAction();

    expect(storeMock.cancelBooking).toHaveBeenCalledWith(
      booking.id,
      'Too late'
    );
    expect(component.actionDialog()).toBeNull();
  });

  it('shows an error toast when an action fails', async () => {
    const booking = createTimedBooking();
    storeMock.confirmBooking.mockResolvedValueOnce(false);
    const { component } = setupComponent([booking]);
    component.selectedBooking.set(booking);

    await component.confirmBooking();

    expect(component.toast()).toEqual({
      message: 'Action failed. Please try again.',
      tone: 'error',
    });
  });

  it('shows an error toast when an action throws', async () => {
    const booking = createTimedBooking();
    storeMock.confirmBooking.mockRejectedValueOnce(new Error('Boom'));
    const { component } = setupComponent([booking]);
    component.selectedBooking.set(booking);

    await component.confirmBooking();

    expect(component.toast()).toEqual({
      message: 'Action failed. Please try again.',
      tone: 'error',
    });
    expect(component.actionInProgress()).toBe(false);
  });

  it('shows a success toast when an action succeeds', async () => {
    const booking = createTimedBooking();
    storeMock.confirmBooking.mockResolvedValueOnce(true);
    const { component } = setupComponent([booking]);
    component.selectedBooking.set(booking);

    await component.confirmBooking();

    expect(component.toast()).toEqual({
      message: 'Booking confirmed',
      tone: 'success',
    });
  });

  it('shows a success toast when cancel action succeeds', async () => {
    const booking = createTimedBooking();
    storeMock.cancelBooking.mockResolvedValueOnce(true);
    const { component } = setupComponent([booking]);
    component.selectedBooking.set(booking);

    await component.cancelBooking();

    expect(component.toast()).toEqual({
      message: 'Booking cancelled',
      tone: 'success',
    });
  });

  it('closes the panel after a successful action', async () => {
    const booking = createTimedBooking();
    storeMock.confirmBooking.mockResolvedValueOnce(true);
    const { component } = setupComponent([booking]);
    component.selectedBooking.set(booking);

    await component.confirmBooking();
    jest.advanceTimersByTime(650);

    expect(component.selectedBooking()).toBeNull();
  });

  it('clears toast message after timeout', async () => {
    const booking = createTimedBooking();
    storeMock.confirmBooking.mockResolvedValueOnce(true);
    const { component } = setupComponent([booking]);
    component.selectedBooking.set(booking);

    await component.confirmBooking();
    jest.advanceTimersByTime(2000);

    expect(component.toast()).toBeNull();
  });

  it('prevents duplicate actions while another is in progress', async () => {
    const booking = createTimedBooking();
    let resolveAction: (value: boolean) => void;
    const pending = new Promise<boolean>((resolve) => {
      resolveAction = resolve;
    });
    storeMock.confirmBooking.mockReturnValueOnce(pending);
    const { component } = setupComponent([booking]);
    component.selectedBooking.set(booking);

    const first = component.confirmBooking();
    const second = component.confirmBooking();

    expect(storeMock.confirmBooking).toHaveBeenCalledTimes(1);

    resolveAction(true);
    await Promise.all([first, second]);
  });

  it.each([
    [BookingStatus.CONFIRMED, 'booking--confirmed'],
    [BookingStatus.PENDING, 'booking--pending'],
    [BookingStatus.CANCELLED, 'booking--cancelled'],
    [BookingStatus.COMPLETED, 'booking--completed'],
    [BookingStatus.NO_SHOW, 'booking--no-show'],
  ])('maps booking status %s to class %s', (status, expectedClass) => {
    const { component } = setupComponent();

    expect(component.getStatusClass(status)).toBe(expectedClass);
  });

  it.each([
    [BookingStatus.CONFIRMED, 'success'],
    [BookingStatus.COMPLETED, 'success'],
    [BookingStatus.PENDING, 'warning'],
    [BookingStatus.CANCELLED, 'danger'],
    [BookingStatus.NO_SHOW, 'danger'],
  ])('maps booking status %s to tone %s', (status, expectedTone) => {
    const { component } = setupComponent();

    expect(component.statusTone(status)).toBe(expectedTone);
  });

  it('returns neutral tone for unknown booking statuses', () => {
    const { component } = setupComponent();

    expect(component.statusTone('UNKNOWN' as BookingStatus)).toBe('neutral');
  });

  it.each([
    [BookingStatus.CONFIRMED, 'Confirmed'],
    [BookingStatus.PENDING, 'Pending'],
    [BookingStatus.CANCELLED, 'Cancelled'],
    [BookingStatus.COMPLETED, 'Completed'],
    [BookingStatus.NO_SHOW, 'No Show'],
  ])('maps booking status %s to label %s', (status, expectedLabel) => {
    const { component } = setupComponent();

    expect(component.statusLabel(status)).toBe(expectedLabel);
  });

  it.each([
    [PaymentStatus.PAID, 'success'],
    [PaymentStatus.PARTIALLY_PAID, 'warning'],
    [PaymentStatus.PENDING, 'neutral'],
    [PaymentStatus.REFUNDED, 'neutral'],
  ])('maps payment status %s to tone %s', (status, expectedTone) => {
    const { component } = setupComponent();

    expect(component.paymentTone(status)).toBe(expectedTone);
  });

  it.each([
    [PaymentStatus.PAID, 'Paid'],
    [PaymentStatus.PARTIALLY_PAID, 'Partial'],
    [PaymentStatus.REFUNDED, 'Refunded'],
    [PaymentStatus.PENDING, 'Unpaid'],
  ])('maps payment status %s to label %s', (status, expectedLabel) => {
    const { component } = setupComponent();

    expect(component.paymentLabel(status)).toBe(expectedLabel);
  });

  it('formats day numbers for display', () => {
    const { component } = setupComponent();
    const day = new Date('2025-03-05T00:00:00Z');

    expect(component.formatDayNumber(day)).toBe('5');
  });

  it.each([
    ['00:00', '12 AM'],
    ['12:00', '12 PM'],
    ['15:00', '3 PM'],
  ])('formats hour %s as %s', (hour, expected) => {
    const { component } = setupComponent();

    expect(component.formatHour(hour)).toBe(expected);
  });

  it('formats dates for display', () => {
    const { component } = setupComponent();

    expect(component.formatDate('2025-03-05T10:00:00Z')).toContain('Wed');
  });

  it('returns empty string for missing times', () => {
    const { component } = setupComponent();

    expect(component.formatTime(null)).toBe('');
  });

  it('formats times for display', () => {
    const { component } = setupComponent();

    expect(component.formatTime('2025-03-05T10:00:00Z')).toContain(':');
  });

  it('tracks days by timestamp', () => {
    const { component } = setupComponent();
    const day = new Date('2025-03-05T00:00:00Z');

    expect(component.trackByDay(0, day)).toBe(day.getTime());
  });

  it('tracks hours by value', () => {
    const { component } = setupComponent();

    expect(component.trackByHour(0, '09:00')).toBe('09:00');
  });

  it('tracks bookings by id', () => {
    const { component } = setupComponent();
    const booking = createTimedBooking({ id: 'booking-99' });

    const segment = {
      id: 'booking-99-0',
      booking,
      startMs: 0,
      endMs: 0,
      startHour: 0,
      startMinutes: 0,
      durationMs: 0,
      dayKey: '2025-03-05',
    };

    expect(component.trackByBooking(0, segment)).toBe('booking-99-0');
  });
});
