import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { BookingListComponent } from './booking-list.component';
import { ApiService } from '../../shared/services/api.service';
import { BookingStore } from '../../state/bookings/booking.store';
import {
  BookingListItemDto,
  BookingStatus,
  FacilityListItemDto,
  PaymentStatus,
} from '@khana/shared-dtos';

const createFacility = (): FacilityListItemDto => ({
  id: 'facility-1',
  name: 'Court A',
  openTime: '08:00',
  closeTime: '22:00',
  slotDurationMinutes: 60,
  basePrice: 120,
  currency: 'SAR',
});

const createBooking = (
  overrides: Partial<BookingListItemDto> = {}
): BookingListItemDto => ({
  id: 'booking-1',
  bookingReference: 'REF-1001',
  facility: {
    id: 'facility-1',
    name: 'Court A',
    config: { pricePerHour: 120 },
  },
  startTime: '2025-03-01T10:00:00.000Z',
  endTime: '2025-03-01T11:00:00.000Z',
  customerName: 'Layla',
  customerPhone: '555-1111',
  totalAmount: 120,
  currency: 'SAR',
  holdUntil: null,
  cancellationReason: null,
  status: BookingStatus.CONFIRMED,
  paymentStatus: PaymentStatus.PENDING,
  createdAt: '2025-03-01T09:00:00.000Z',
  updatedAt: '2025-03-01T09:30:00.000Z',
  ...overrides,
});

const createStoreMock = (initialBookings: BookingListItemDto[] = []) => ({
  bookings: signal<BookingListItemDto[]>(initialBookings),
  loading: signal(false),
  error: signal<Error | null>(null),
  actionLoadingById: signal<Record<string, boolean>>({}),
  loadBookings: jest.fn(),
  cancelBooking: jest.fn(() => Promise.resolve(true)),
  markBookingPaid: jest.fn(() => Promise.resolve(true)),
});

describe('BookingListComponent', () => {
  let storeMock: ReturnType<typeof createStoreMock>;
  let apiMock: { getFacilities: jest.Mock };

  const setupComponent = (bookings: BookingListItemDto[] = []) => {
    storeMock.bookings.set(bookings);
    const fixture = TestBed.createComponent(BookingListComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  };

  beforeEach(async () => {
    storeMock = createStoreMock();
    apiMock = { getFacilities: jest.fn(() => of([createFacility()])) };

    await TestBed.configureTestingModule({
      imports: [BookingListComponent],
      providers: [
        { provide: BookingStore, useValue: storeMock },
        { provide: ApiService, useValue: apiMock },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('loads facilities and bookings on init', () => {
    const { component } = setupComponent();

    expect(apiMock.getFacilities).toHaveBeenCalled();
    expect(storeMock.loadBookings).toHaveBeenCalledWith(null);
    expect(component.facilities().length).toBe(1);
  });

  it('reloads bookings and clears selection when facility changes', () => {
    const booking = createBooking({ id: 'booking-1' });
    const { component } = setupComponent([booking]);

    component.selectedFacilityId.set('facility-1');
    component.selectedBookingIds.set(new Set(['booking-1']));
    component.currentPage.set(3);
    storeMock.loadBookings.mockClear();

    component.onFacilityChange();

    expect(storeMock.loadBookings).toHaveBeenCalledWith('facility-1');
    expect(component.currentPage()).toBe(1);
    expect(component.selectedBookingIds().size).toBe(0);
  });

  it('handles first page pagination state', () => {
    const bookings = [
      createBooking({ id: 'booking-1' }),
      createBooking({ id: 'booking-2' }),
      createBooking({ id: 'booking-3' }),
    ];
    const { component } = setupComponent(bookings);

    component.pageSize.set(2);
    component.currentPage.set(1);

    expect(component.hasPreviousPage()).toBe(false);
    expect(component.hasNextPage()).toBe(true);
    expect(component.pagedBookings().length).toBe(2);
  });

  it('handles last page pagination state', () => {
    const bookings = [
      createBooking({ id: 'booking-1' }),
      createBooking({ id: 'booking-2' }),
      createBooking({ id: 'booking-3' }),
    ];
    const { component } = setupComponent(bookings);

    component.pageSize.set(2);
    component.currentPage.set(2);

    expect(component.hasPreviousPage()).toBe(true);
    expect(component.hasNextPage()).toBe(false);
    expect(component.pagedBookings().length).toBe(1);
  });

  it('reports single page when results fit in one page', () => {
    const bookings = [createBooking({ id: 'booking-1' })];
    const { component } = setupComponent(bookings);

    component.pageSize.set(25);

    expect(component.totalPages()).toBe(1);
    expect(component.hasPreviousPage()).toBe(false);
    expect(component.hasNextPage()).toBe(false);
  });

  it('sorts by date descending by default', () => {
    const bookings = [
      createBooking({
        id: 'booking-1',
        startTime: '2025-03-01T10:00:00.000Z',
      }),
      createBooking({
        id: 'booking-2',
        startTime: '2025-03-03T10:00:00.000Z',
      }),
    ];
    const { component } = setupComponent(bookings);

    const sorted = component.filteredBookings();
    expect(sorted[0].id).toBe('booking-2');
    expect(sorted[1].id).toBe('booking-1');
  });

  it('sorts by customer name when selected', () => {
    const bookings = [
      createBooking({ id: 'booking-1', customerName: 'Zain' }),
      createBooking({ id: 'booking-2', customerName: 'Amal' }),
    ];
    const { component } = setupComponent(bookings);

    component.setSort('customer');

    const sorted = component.filteredBookings();
    expect(sorted[0].customerName).toBe('Amal');
    expect(sorted[1].customerName).toBe('Zain');
  });

  it('sorts by status when selected', () => {
    const bookings = [
      createBooking({ id: 'booking-1', status: BookingStatus.PENDING }),
      createBooking({ id: 'booking-2', status: BookingStatus.CONFIRMED }),
    ];
    const { component } = setupComponent(bookings);

    component.setSort('status');

    const sorted = component.filteredBookings();
    expect(sorted[0].status).toBe(BookingStatus.CONFIRMED);
    expect(sorted[1].status).toBe(BookingStatus.PENDING);
  });

  it('sorts by price when selected', () => {
    const bookings = [
      createBooking({ id: 'booking-1', totalAmount: 300 }),
      createBooking({ id: 'booking-2', totalAmount: 100 }),
    ];
    const { component } = setupComponent(bookings);

    component.setSort('price');

    const sorted = component.filteredBookings();
    expect(sorted[0].id).toBe('booking-2');
    expect(sorted[1].id).toBe('booking-1');
  });

  it('toggles sort direction and resets pagination', () => {
    const bookings = [createBooking({ id: 'booking-1' })];
    const { component } = setupComponent(bookings);

    component.currentPage.set(3);
    component.setSort('customer');
    expect(component.sortKey()).toBe('customer');
    expect(component.sortDirection()).toBe('asc');
    expect(component.currentPage()).toBe(1);

    component.currentPage.set(2);
    component.setSort('customer');
    expect(component.sortDirection()).toBe('desc');
    expect(component.currentPage()).toBe(1);
  });

  it('applies status and date range filters together', () => {
    const bookings = [
      createBooking({
        id: 'booking-1',
        status: BookingStatus.CONFIRMED,
        startTime: '2025-03-01T10:00:00.000Z',
      }),
      createBooking({
        id: 'booking-2',
        status: BookingStatus.CONFIRMED,
        startTime: '2025-03-05T10:00:00.000Z',
      }),
      createBooking({
        id: 'booking-3',
        status: BookingStatus.PENDING,
        startTime: '2025-03-06T10:00:00.000Z',
      }),
    ];
    const { component } = setupComponent(bookings);

    component.filterStatus.set(BookingStatus.CONFIRMED);
    component.startDateFilter.set('2025-03-02');
    component.endDateFilter.set('2025-03-06');

    const filtered = component.filteredBookings();
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('booking-2');
  });

  it('filters by payment status', () => {
    const bookings = [
      createBooking({
        id: 'booking-1',
        paymentStatus: PaymentStatus.PAID,
      }),
      createBooking({
        id: 'booking-2',
        paymentStatus: PaymentStatus.PENDING,
      }),
    ];
    const { component } = setupComponent(bookings);

    component.filterPaymentStatus.set(PaymentStatus.PAID);

    const filtered = component.filteredBookings();
    expect(filtered.length).toBe(1);
    expect(filtered[0].paymentStatus).toBe(PaymentStatus.PAID);
  });

  it('filters by search term', () => {
    const bookings = [
      createBooking({ id: 'booking-1', customerName: 'Lina' }),
      createBooking({ id: 'booking-2', customerName: 'Saleh' }),
    ];
    const { component } = setupComponent(bookings);

    component.searchTerm.set('lina');

    const filtered = component.filteredBookings();
    expect(filtered.length).toBe(1);
    expect(filtered[0].customerName).toBe('Lina');
  });

  it('selects only cancellable bookings when selecting all', () => {
    const bookings = [
      createBooking({
        id: 'booking-1',
        status: BookingStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PENDING,
      }),
      createBooking({
        id: 'booking-2',
        status: BookingStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
      }),
      createBooking({
        id: 'booking-3',
        status: BookingStatus.CANCELLED,
        paymentStatus: PaymentStatus.PENDING,
      }),
    ];
    const { component } = setupComponent(bookings);

    component.toggleSelectAllOnPage(true);

    expect(component.selectedBookingIds().size).toBe(1);
    expect(component.selectedBookingIds().has('booking-1')).toBe(true);
  });

  it('clears selections when deselecting all', () => {
    const bookings = [createBooking({ id: 'booking-1' })];
    const { component } = setupComponent(bookings);

    component.toggleSelectAllOnPage(true);
    component.toggleSelectAllOnPage(false);

    expect(component.selectedBookingIds().size).toBe(0);
  });

  it('toggles individual booking selection', () => {
    const booking = createBooking({ id: 'booking-1' });
    const { component } = setupComponent([booking]);

    component.toggleBookingSelection(booking, true);
    expect(component.selectedBookingIds().has('booking-1')).toBe(true);

    component.toggleBookingSelection(booking, false);
    expect(component.selectedBookingIds().has('booking-1')).toBe(false);
  });

  it('exports CSV with filtered data only', async () => {
    const bookings = [
      createBooking({ id: 'booking-1', customerName: 'Amal' }),
      createBooking({ id: 'booking-2', customerName: 'Zain' }),
    ];
    const { component } = setupComponent(bookings);

    component.searchTerm.set('amal');

    const originalBlob = globalThis.Blob;
    class TestBlob {
      constructor(
        private readonly parts: BlobPart[],
        public readonly options?: BlobPropertyBag
      ) {}

      text(): Promise<string> {
        return Promise.resolve(this.parts.join(''));
      }
    }
    (globalThis as { Blob: typeof Blob }).Blob =
      TestBlob as unknown as typeof Blob;

    const originalCreateObjectURL = URL.createObjectURL;
    const originalRevokeObjectURL = URL.revokeObjectURL;
    const createObjectURLSpy = jest.fn(() => 'blob:mock');
    const revokeObjectURLSpy = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      value: createObjectURLSpy,
      writable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: revokeObjectURLSpy,
      writable: true,
    });
    const linkMock = {
      href: '',
      download: '',
      click: jest.fn(),
    } as unknown as HTMLAnchorElement;
    jest.spyOn(document, 'createElement').mockReturnValue(linkMock);

    component.exportCsv();

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1);
    expect(linkMock.click).toHaveBeenCalled();
    expect(linkMock.download).toMatch(/^bookings-/);

    const calls = createObjectURLSpy.mock.calls as unknown[][];
    expect(calls.length).toBeGreaterThan(0);
    const blob = calls[0][0] as TestBlob;
    const text = await blob.text();
    expect(text).toContain('Amal');
    expect(text).not.toContain('Zain');
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock');

    (globalThis as { Blob: typeof Blob }).Blob = originalBlob;
    Object.defineProperty(URL, 'createObjectURL', {
      value: originalCreateObjectURL,
      writable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: originalRevokeObjectURL,
      writable: true,
    });
  });

  it('shows error toast when mark as paid fails', async () => {
    const booking = createBooking({ id: 'booking-1' });
    storeMock.markBookingPaid.mockResolvedValueOnce(false);
    const { component } = setupComponent([booking]);

    await component.markAsPaid(booking);

    expect(component.toast()).toEqual({
      message: 'Failed to mark booking as paid.',
      tone: 'error',
    });
  });

  it('skips mark as paid when action is already loading', async () => {
    const booking = createBooking({ id: 'booking-1' });
    storeMock.actionLoadingById.set({ 'booking-1': true });
    const { component } = setupComponent([booking]);

    await component.markAsPaid(booking);

    expect(storeMock.markBookingPaid).not.toHaveBeenCalled();
  });

  it('shows success toast when mark as paid succeeds', async () => {
    const booking = createBooking({ id: 'booking-1' });
    storeMock.markBookingPaid.mockResolvedValueOnce(true);
    const { component } = setupComponent([booking]);

    await component.markAsPaid(booking);

    expect(component.toast()).toEqual({
      message: 'Booking marked as paid.',
      tone: 'success',
    });
  });

  it('does not submit cancel dialog when reason is too short', async () => {
    const booking = createBooking({ id: 'booking-1' });
    const { component } = setupComponent([booking]);

    component.cancelDialogBooking.set(booking);
    component.cancelReason.set('no');

    await component.submitCancelDialog();

    expect(storeMock.cancelBooking).not.toHaveBeenCalled();
    expect(component.cancelError()).toBeNull();
  });

  it('submits cancel dialog and clears selection on success', async () => {
    const booking = createBooking({ id: 'booking-1' });
    const { component } = setupComponent([booking]);

    component.selectedBookingIds.set(new Set(['booking-1']));
    component.cancelDialogBooking.set(booking);
    component.cancelReason.set('Customer requested cancellation');

    await component.submitCancelDialog();

    expect(storeMock.cancelBooking).toHaveBeenCalledWith(
      'booking-1',
      'Customer requested cancellation'
    );
    expect(component.cancelDialogBooking()).toBeNull();
    expect(component.selectedBookingIds().has('booking-1')).toBe(false);
    expect(component.toast()?.tone).toBe('success');
  });

  it('shows an error when cancellation fails', async () => {
    const booking = createBooking({ id: 'booking-1' });
    storeMock.cancelBooking.mockResolvedValueOnce(false);
    const { component } = setupComponent([booking]);

    component.cancelDialogBooking.set(booking);
    component.cancelReason.set('Customer request');

    await component.submitCancelDialog();

    expect(component.cancelError()).toBe(
      'Cancellation failed. Please try again.'
    );
    expect(component.toast()?.tone).toBe('error');
  });

  it('blocks bulk cancel when reason is too short', async () => {
    const booking = createBooking({ id: 'booking-1' });
    const { component } = setupComponent([booking]);

    component.selectedBookingIds.set(new Set(['booking-1']));
    component.bulkCancelReason.set('no');

    await component.submitBulkCancel();

    expect(storeMock.cancelBooking).not.toHaveBeenCalled();
    expect(component.bulkCancelError()).toBe(
      'Cancellation reason is required.'
    );
  });

  it('opens bulk cancel dialog only when selection exists', () => {
    const booking = createBooking({ id: 'booking-1' });
    const { component } = setupComponent([booking]);

    component.openBulkCancelDialog();
    expect(component.bulkCancelOpen()).toBe(false);

    component.selectedBookingIds.set(new Set(['booking-1']));
    component.openBulkCancelDialog();
    expect(component.bulkCancelOpen()).toBe(true);
  });

  it('shows an error when bulk cancellation fails', async () => {
    const bookings = [
      createBooking({ id: 'booking-1' }),
      createBooking({ id: 'booking-2' }),
    ];
    storeMock.cancelBooking
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const { component } = setupComponent(bookings);

    component.selectedBookingIds.set(new Set(['booking-1', 'booking-2']));
    component.bulkCancelReason.set('Customer request');

    await component.submitBulkCancel();

    expect(component.bulkCancelError()).toContain('1 of 2');
    expect(component.toast()?.tone).toBe('error');
  });

  it('shows facility error and retries loading facilities', () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    apiMock.getFacilities.mockReturnValueOnce(
      throwError(() => new Error('Facilities failed'))
    );

    const { fixture } = setupComponent([]);

    const errorMessage = fixture.nativeElement.querySelector('.filter-error');
    expect(errorMessage?.textContent).toContain('Facilities failed');

    apiMock.getFacilities.mockClear();
    const retryButton = errorMessage?.querySelector('button');
    retryButton?.click();

    expect(apiMock.getFacilities).toHaveBeenCalled();
  });

  it('shows date range validation error and disables export', () => {
    const { fixture, component } = setupComponent([createBooking()]);

    component.startDateFilter.set('2025-03-10');
    component.endDateFilter.set('2025-03-05');
    fixture.detectChanges();

    const rangeError = fixture.nativeElement.querySelector('#date-range-error');
    expect(rangeError?.textContent).toContain(
      'Start date must be before end date.'
    );

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button')
    ) as HTMLButtonElement[];
    const exportButton = buttons.find((button) =>
      button.textContent?.includes('Export CSV')
    );
    expect(exportButton?.disabled).toBe(true);
  });

  it('shows a create booking call-to-action when there are no bookings', () => {
    const { fixture } = setupComponent([]);

    const emptyState = fixture.nativeElement.querySelector('.table-empty');
    const link = emptyState?.querySelector('a');

    expect(emptyState?.textContent).toContain('No bookings yet');
    expect(link?.getAttribute('href')).toBe('/new');
  });

  it('renders error banner and retries loading bookings', () => {
    storeMock.error.set(new Error('Load failed'));
    const { fixture, component } = setupComponent([]);

    storeMock.loadBookings.mockClear();
    component.selectedFacilityId.set('facility-1');

    const retryButton = fixture.nativeElement.querySelector(
      '.error-message button'
    ) as HTMLButtonElement | null;
    retryButton?.click();

    expect(fixture.nativeElement.textContent).toContain('Load failed');
    expect(storeMock.loadBookings).toHaveBeenCalledWith('facility-1');
  });

  it('renders empty state when filtered results are empty', () => {
    const { fixture } = setupComponent([]);

    fixture.detectChanges();
    const emptyState = fixture.nativeElement.querySelector('.table-empty');
    expect(emptyState).toBeTruthy();
  });

  it('resets current page when filters change', () => {
    const bookings = [
      createBooking({ id: 'booking-1' }),
      createBooking({ id: 'booking-2' }),
      createBooking({ id: 'booking-3' }),
    ];
    const { component } = setupComponent(bookings);

    component.currentPage.set(3);
    component.onFiltersChange();

    expect(component.currentPage()).toBe(1);
  });

  it('debounces search input before applying search term', () => {
    jest.useFakeTimers();
    const { component } = setupComponent([createBooking({ id: 'booking-1' })]);

    component.searchTerm.set('');
    component.onSearchChange('Layla');

    expect(component.searchTerm()).toBe('');
    jest.advanceTimersByTime(300);
    expect(component.searchTerm()).toBe('Layla');
  });

  it('moves focused row with arrow keys', () => {
    const bookings = [
      createBooking({ id: 'booking-1' }),
      createBooking({ id: 'booking-2' }),
    ];
    const { component, fixture } = setupComponent(bookings);
    fixture.detectChanges();

    component.focusedRowIndex.set(0);
    const preventDefault = jest.fn();

    component.onRowKeydown(
      { key: 'ArrowDown', preventDefault } as unknown as KeyboardEvent,
      0
    );

    expect(component.focusedRowIndex()).toBe(1);
    expect(preventDefault).toHaveBeenCalled();
  });
});
