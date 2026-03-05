import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import {
  ActivatedRoute,
  Params,
  convertToParamMap,
  provideRouter,
} from '@angular/router';
import { BookingListComponent } from './booking-list.component';
import { ApiService } from '../../shared/services/api.service';
import { FacilityContextStore } from '../../shared/state';
import { BookingStore } from '../../state/bookings/booking.store';
import { AuthStore } from '../../shared/state/auth.store';
import {
  BookingCancellationScope,
  BookingListItemDto,
  BookingStatus,
  FacilityListItemDto,
  PaymentStatus,
  UserRole,
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
  cancelBookingWithScope: jest.fn(() => Promise.resolve(true)),
  markBookingPaid: jest.fn(() => Promise.resolve(true)),
});

describe('BookingListComponent', () => {
  let storeMock: ReturnType<typeof createStoreMock>;
  const apiMock = {
    getTenantTags: jest.fn(() => of(['VIP', 'Corporate'])),
  };
  let queryParams: Params;
  const authStoreMock = {
    user: signal({
      id: 'manager-1',
      tenantId: 'tenant-1',
      email: 'manager@example.com',
      name: 'Manager User',
      role: UserRole.MANAGER,
      isActive: true,
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    }),
  };
  const facilityContextMock = {
    facilities: signal<FacilityListItemDto[]>([createFacility()]),
    selectedFacilityId: signal<string | null>(null),
    loading: signal(false),
    error: signal<Error | null>(null),
    initialized: signal(true),
    initialize: jest.fn(),
    refreshFacilities: jest.fn(),
    selectFacility: jest.fn((id: string | null) => {
      facilityContextMock.selectedFacilityId.set(id);
    }),
    clearError: jest.fn(),
  };

  const setupComponent = (bookings: BookingListItemDto[] = []) => {
    storeMock.bookings.set(bookings);
    const fixture = TestBed.createComponent(BookingListComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  };

  beforeEach(async () => {
    queryParams = {};
    storeMock = createStoreMock();
    authStoreMock.user.set({
      id: 'manager-1',
      tenantId: 'tenant-1',
      email: 'manager@example.com',
      name: 'Manager User',
      role: UserRole.MANAGER,
      isActive: true,
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    });
    facilityContextMock.facilities.set([createFacility()]);
    facilityContextMock.selectedFacilityId.set(null);
    facilityContextMock.loading.set(false);
    facilityContextMock.error.set(null);
    facilityContextMock.initialized.set(true);
    facilityContextMock.initialize.mockReset();
    facilityContextMock.refreshFacilities.mockReset();
    facilityContextMock.selectFacility.mockClear();
    facilityContextMock.clearError.mockReset();
    apiMock.getTenantTags.mockClear();

    await TestBed.configureTestingModule({
      imports: [BookingListComponent],
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
        { provide: BookingStore, useValue: storeMock },
        { provide: ApiService, useValue: apiMock },
        { provide: FacilityContextStore, useValue: facilityContextMock },
        { provide: AuthStore, useValue: authStoreMock },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('loads facilities and bookings on init', () => {
    const { component } = setupComponent();

    expect(facilityContextMock.initialize).toHaveBeenCalled();
    expect(storeMock.loadBookings).toHaveBeenCalledWith(null);
    expect(component.facilities().length).toBe(1);
  });

  it('hydrates status and payment filters from query params', () => {
    queryParams = {
      status: BookingStatus.NO_SHOW,
      paymentStatus: PaymentStatus.PENDING,
    };

    const { component } = setupComponent();

    expect(component.filterStatus()).toBe(BookingStatus.NO_SHOW);
    expect(component.filterPaymentStatus()).toBe(PaymentStatus.PENDING);
  });

  it('hydrates ON_HOLD status filter from query params', () => {
    queryParams = {
      status: 'ON_HOLD',
    };

    const { component } = setupComponent();

    expect(component.filterStatus()).toBe('ON_HOLD');
  });

  it('marks selected status chip with aria-pressed and active class', () => {
    const { fixture, component } = setupComponent([createBooking()]);

    const chips = Array.from(
      fixture.nativeElement.querySelectorAll(
        '.booking-list__status-filter-chip'
      )
    ) as HTMLButtonElement[];
    const confirmedIndex = component.statusFilterOptions.findIndex(
      (option) => option.value === BookingStatus.CONFIRMED
    );
    const allIndex = component.statusFilterOptions.findIndex(
      (option) => option.value === 'ALL'
    );
    expect(confirmedIndex).toBeGreaterThan(-1);
    expect(allIndex).toBeGreaterThan(-1);

    chips[confirmedIndex]?.click();
    fixture.detectChanges();

    const updatedChips = Array.from(
      fixture.nativeElement.querySelectorAll(
        '.booking-list__status-filter-chip'
      )
    ) as HTMLButtonElement[];
    const activeConfirmedChip = updatedChips[confirmedIndex];
    const allChip = updatedChips[allIndex];

    expect(component.filterStatus()).toBe(BookingStatus.CONFIRMED);
    expect(activeConfirmedChip?.getAttribute('aria-pressed')).toBe('true');
    expect(
      activeConfirmedChip?.classList.contains(
        'booking-list__status-filter-chip--active'
      )
    ).toBe(true);
    expect(allChip?.getAttribute('aria-pressed')).toBe('false');
  });

  it('ignores unsupported query param values', () => {
    queryParams = {
      status: 'INVALID_STATUS',
      paymentStatus: 'INVALID_PAYMENT',
    };

    const { component } = setupComponent();

    expect(component.filterStatus()).toBe('ALL');
    expect(component.filterPaymentStatus()).toBe('ALL');
  });

  it('hides cancel and mark-paid actions for viewer role', () => {
    authStoreMock.user.update((user) => ({ ...user, role: UserRole.VIEWER }));
    const booking = createBooking({ id: 'booking-viewer' });
    const { fixture } = setupComponent([booking]);

    const cancelButton = fixture.nativeElement.querySelector(
      'button[aria-label*="Cancel booking for"]'
    ) as HTMLButtonElement | null;
    const markPaidButton = fixture.nativeElement.querySelector(
      'button[aria-label*="Mark booking as paid"]'
    ) as HTMLButtonElement | null;

    expect(cancelButton).toBeNull();
    expect(markPaidButton).toBeNull();
  });

  it('hides mark-paid actions for staff role', () => {
    authStoreMock.user.update((user) => ({ ...user, role: UserRole.STAFF }));
    const booking = createBooking({
      id: 'booking-staff',
      paymentStatus: PaymentStatus.PENDING,
    });
    const { fixture } = setupComponent([booking]);

    const markPaidButton = fixture.nativeElement.querySelector(
      'button[aria-label*="Mark booking as paid"]'
    ) as HTMLButtonElement | null;
    expect(markPaidButton).toBeNull();
  });

  it('shows mark-paid actions for manager role', () => {
    authStoreMock.user.update((user) => ({ ...user, role: UserRole.MANAGER }));
    const booking = createBooking({
      id: 'booking-manager',
      paymentStatus: PaymentStatus.PENDING,
    });
    const { fixture } = setupComponent([booking]);

    const markPaidButton = fixture.nativeElement.querySelector(
      'button[aria-label*="Mark booking as paid"]'
    ) as HTMLButtonElement | null;
    expect(markPaidButton).not.toBeNull();
  });

  it('shows bulk mark-paid button for manager when payable selection exists', () => {
    authStoreMock.user.update((user) => ({ ...user, role: UserRole.MANAGER }));
    const booking = createBooking({
      id: 'booking-manager-bulk',
      paymentStatus: PaymentStatus.PENDING,
      status: BookingStatus.CONFIRMED,
    });
    const { fixture, component } = setupComponent([booking]);

    component.selectedBookingIds.set(new Set([booking.id]));
    fixture.detectChanges();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button')
    ) as HTMLButtonElement[];
    const bulkMarkPaidButton = buttons.find((button) =>
      button.textContent?.includes('Mark selected as paid')
    );
    expect(bulkMarkPaidButton).toBeTruthy();
  });

  it('hides bulk mark-paid button for staff even with selection', () => {
    authStoreMock.user.update((user) => ({ ...user, role: UserRole.STAFF }));
    const booking = createBooking({
      id: 'booking-staff-bulk',
      paymentStatus: PaymentStatus.PENDING,
      status: BookingStatus.CONFIRMED,
    });
    const { fixture, component } = setupComponent([booking]);

    component.selectedBookingIds.set(new Set([booking.id]));
    fixture.detectChanges();

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button')
    ) as HTMLButtonElement[];
    const bulkMarkPaidButton = buttons.find((button) =>
      button.textContent?.includes('Mark selected as paid')
    );
    expect(bulkMarkPaidButton).toBeUndefined();
  });

  it('reloads bookings and clears selection when facility changes', () => {
    const booking = createBooking({ id: 'booking-1' });
    const { component } = setupComponent([booking]);

    facilityContextMock.selectedFacilityId.set('facility-1');
    component.selectedBookingIds.set(new Set(['booking-1']));
    component.currentPage.set(3);
    storeMock.loadBookings.mockClear();

    component.onFacilityChange('facility-1');

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

  it('filters bookings by selected customer tags using AND semantics', () => {
    const bookings = [
      createBooking({ id: 'booking-1', customerTags: ['VIP'] }),
      createBooking({ id: 'booking-2', customerTags: ['Corporate'] }),
      createBooking({ id: 'booking-3', customerTags: ['VIP', 'Corporate'] }),
    ];
    const { component } = setupComponent(bookings);

    component.toggleTagFilter('VIP');
    let filtered = component.filteredBookings();
    expect(filtered.map((item) => item.id).sort()).toEqual([
      'booking-1',
      'booking-3',
    ]);

    component.toggleTagFilter('Corporate');
    filtered = component.filteredBookings();
    expect(filtered.map((item) => item.id)).toEqual(['booking-3']);
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

  it('filters ON_HOLD as pending bookings with non-null holdUntil', () => {
    const bookings = [
      createBooking({
        id: 'booking-hold',
        status: BookingStatus.PENDING,
        holdUntil: '2025-03-01T11:00:00.000Z',
      }),
      createBooking({
        id: 'booking-pending-no-hold',
        status: BookingStatus.PENDING,
        holdUntil: null,
      }),
      createBooking({
        id: 'booking-confirmed',
        status: BookingStatus.CONFIRMED,
        holdUntil: '2025-03-01T11:00:00.000Z',
      }),
    ];
    const { component } = setupComponent(bookings);

    component.filterStatus.set('ON_HOLD');

    const filtered = component.filteredBookings();
    expect(filtered.map((item) => item.id)).toEqual(['booking-hold']);
  });

  it('computes onHoldCount after non-status filters', () => {
    const bookings = [
      createBooking({
        id: 'booking-hold-unpaid',
        status: BookingStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        holdUntil: '2025-03-01T11:00:00.000Z',
      }),
      createBooking({
        id: 'booking-hold-paid',
        status: BookingStatus.PENDING,
        paymentStatus: PaymentStatus.PAID,
        holdUntil: '2025-03-01T11:00:00.000Z',
      }),
    ];
    const { component } = setupComponent(bookings);

    expect(component.onHoldCount()).toBe(2);

    component.filterPaymentStatus.set(PaymentStatus.PENDING);
    expect(component.onHoldCount()).toBe(1);
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

    expect(storeMock.cancelBookingWithScope).not.toHaveBeenCalled();
    expect(component.cancelError()).toBeNull();
  });

  it('submits cancel dialog and clears selection on success', async () => {
    const booking = createBooking({ id: 'booking-1' });
    const { component } = setupComponent([booking]);

    component.selectedBookingIds.set(new Set(['booking-1']));
    component.cancelDialogBooking.set(booking);
    component.cancelReason.set('customer_request');

    await component.submitCancelDialog();

    expect(storeMock.cancelBookingWithScope).toHaveBeenCalledWith(
      'booking-1',
      'customer_request',
      BookingCancellationScope.SINGLE
    );
    expect(component.cancelDialogBooking()).toBeNull();
    expect(component.selectedBookingIds().has('booking-1')).toBe(false);
    expect(component.toast()?.tone).toBe('success');
  });

  it('shows an error when cancellation fails', async () => {
    const booking = createBooking({ id: 'booking-1' });
    storeMock.cancelBookingWithScope.mockResolvedValueOnce(false);
    const { component } = setupComponent([booking]);

    component.cancelDialogBooking.set(booking);
    component.cancelReason.set('customer_request');

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

  it('opens bulk mark-paid dialog only when payable selection exists', () => {
    const pendingBooking = createBooking({
      id: 'booking-pending',
      paymentStatus: PaymentStatus.PENDING,
      status: BookingStatus.CONFIRMED,
    });
    const paidBooking = createBooking({
      id: 'booking-paid',
      paymentStatus: PaymentStatus.PAID,
      status: BookingStatus.CONFIRMED,
    });
    const { component } = setupComponent([pendingBooking, paidBooking]);

    component.openBulkMarkPaidDialog();
    expect(component.bulkMarkPaidOpen()).toBe(false);

    component.selectedBookingIds.set(new Set([paidBooking.id]));
    component.openBulkMarkPaidDialog();
    expect(component.bulkMarkPaidOpen()).toBe(false);

    component.selectedBookingIds.set(new Set([pendingBooking.id]));
    component.openBulkMarkPaidDialog();
    expect(component.bulkMarkPaidOpen()).toBe(true);
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
    component.bulkCancelReason.set('customer_request');

    await component.submitBulkCancel();

    expect(component.bulkCancelError()).toContain('1 of 2');
    expect(component.toast()?.tone).toBe('error');
  });

  it('submits bulk mark-paid and clears processed selection on success', async () => {
    const bookings = [
      createBooking({
        id: 'booking-1',
        paymentStatus: PaymentStatus.PENDING,
        status: BookingStatus.CONFIRMED,
      }),
      createBooking({
        id: 'booking-2',
        paymentStatus: PaymentStatus.PENDING,
        status: BookingStatus.COMPLETED,
      }),
    ];
    const { component } = setupComponent(bookings);

    component.selectedBookingIds.set(new Set(['booking-1', 'booking-2']));
    component.openBulkMarkPaidDialog();
    storeMock.loadBookings.mockClear();

    await component.submitBulkMarkPaid();

    expect(storeMock.markBookingPaid).toHaveBeenCalledTimes(2);
    expect(storeMock.markBookingPaid).toHaveBeenCalledWith('booking-1');
    expect(storeMock.markBookingPaid).toHaveBeenCalledWith('booking-2');
    expect(storeMock.loadBookings).toHaveBeenCalledWith(null);
    expect(component.selectedBookingIds().size).toBe(0);
    expect(component.bulkMarkPaidOpen()).toBe(false);
    expect(component.toast()).toEqual({
      message: '2 bookings marked as paid.',
      tone: 'success',
    });
  });

  it('handles partial bulk mark-paid failure with mixed feedback and retained failed selection', async () => {
    const bookings = [
      createBooking({
        id: 'booking-1',
        paymentStatus: PaymentStatus.PENDING,
        status: BookingStatus.CONFIRMED,
      }),
      createBooking({
        id: 'booking-2',
        paymentStatus: PaymentStatus.PENDING,
        status: BookingStatus.CONFIRMED,
      }),
    ];
    storeMock.markBookingPaid
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const { component } = setupComponent(bookings);
    const showToastSpy = jest.spyOn(
      component as unknown as {
        showToast: (message: string, tone: string) => void;
      },
      'showToast'
    );

    component.selectedBookingIds.set(new Set(['booking-1', 'booking-2']));
    component.openBulkMarkPaidDialog();
    storeMock.loadBookings.mockClear();

    await component.submitBulkMarkPaid();

    expect(component.bulkMarkPaidError()).toContain('1 of 2');
    expect(component.selectedBookingIds()).toEqual(new Set(['booking-2']));
    expect(storeMock.loadBookings).toHaveBeenCalledWith(null);
    expect(showToastSpy).toHaveBeenCalledWith(
      '1 bookings marked as paid.',
      'success'
    );
    expect(showToastSpy).toHaveBeenCalledWith(
      'Some mark-as-paid updates failed. Please retry.',
      'error'
    );
  });

  it('keeps selection and sets error when bulk mark-paid throws', async () => {
    const booking = createBooking({
      id: 'booking-error',
      paymentStatus: PaymentStatus.PENDING,
      status: BookingStatus.CONFIRMED,
    });
    storeMock.markBookingPaid.mockRejectedValueOnce(new Error('Network error'));
    const { component } = setupComponent([booking]);

    component.selectedBookingIds.set(new Set([booking.id]));
    component.openBulkMarkPaidDialog();
    storeMock.loadBookings.mockClear();

    await component.submitBulkMarkPaid();

    expect(component.bulkMarkPaidError()).toBe(
      'Bulk mark as paid failed. Please try again.'
    );
    expect(component.selectedBookingIds()).toEqual(new Set([booking.id]));
    expect(component.toast()).toEqual({
      message: 'Bulk mark as paid failed. Please try again.',
      tone: 'error',
    });
    expect(storeMock.loadBookings).toHaveBeenCalledWith(null);
  });

  it('shows facility error and retries loading facilities', () => {
    facilityContextMock.error.set(new Error('Facilities failed'));

    const { fixture } = setupComponent([]);

    const errorMessage = fixture.nativeElement.querySelector('.filter-error');
    expect(errorMessage?.textContent).toContain('Facilities failed');

    facilityContextMock.refreshFacilities.mockClear();
    const retryButton = errorMessage?.querySelector('button');
    retryButton?.click();

    expect(facilityContextMock.refreshFacilities).toHaveBeenCalled();
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
    expect(link?.getAttribute('href')).toBe('/dashboard/new');
  });

  it('renders error banner and retries loading bookings', () => {
    storeMock.error.set(new Error('Load failed'));
    const { fixture } = setupComponent([]);

    storeMock.loadBookings.mockClear();
    facilityContextMock.selectedFacilityId.set('facility-1');

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
