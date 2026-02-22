import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  QueryList,
  ViewChildren,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { ApiService } from '../../shared/services/api.service';
import { LanguageService } from '../../shared/services/language.service';
import { LocaleFormatService } from '../../shared/services/locale-format.service';
import { BookingStore } from '../../state/bookings/booking.store';
import { ConfirmationDialogComponent } from '../../shared/components/confirmation-dialog.component';
import { CancellationFormComponent } from '../../shared/components/cancellation-form.component';
import {
  UiStatusBadgeComponent,
  UiToastComponent,
} from '../../shared/components';
import {
  BookingStatus,
  PaymentStatus,
  BookingListItemDto,
  FacilityListItemDto,
} from '@khana/shared-dtos';

type BookingStatusTone = 'success' | 'warning' | 'danger' | 'default';
const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE_OPTIONS = [25, 50, 100];

@Component({
  selector: 'app-booking-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    ConfirmationDialogComponent,
    CancellationFormComponent,
    UiStatusBadgeComponent,
    UiToastComponent,
  ],
  templateUrl: './booking-list.component.html',
  styleUrl: './booking-list.component.scss',
})
export class BookingListComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly languageService = inject(LanguageService, {
    optional: true,
  });
  private readonly localeFormat = inject(LocaleFormatService);
  private readonly translateService = inject(TranslateService, {
    optional: true,
  });
  readonly store = inject(BookingStore);

  @ViewChildren('bookingRow') bookingRows?: QueryList<
    ElementRef<HTMLTableRowElement>
  >;

  facilities = signal<FacilityListItemDto[]>([]);
  selectedFacilityId = signal<string>('');
  focusedRowIndex = signal(0);
  facilityError = signal<Error | null>(null);

  bookings = this.store.bookings;
  loading = this.store.loading;
  error = this.store.error;
  actionLoadingById = this.store.actionLoadingById;

  searchInput = signal('');
  searchTerm = signal('');
  filterStatus = signal<BookingStatus | 'ALL'>('ALL');
  filterPaymentStatus = signal<PaymentStatus | 'ALL'>('ALL');
  startDateFilter = signal('');
  endDateFilter = signal('');
  sortKey = signal<'date' | 'customer' | 'status' | 'price'>('date');
  sortDirection = signal<'asc' | 'desc'>('desc');
  pageSize = signal(PAGE_SIZE_OPTIONS[0]);
  currentPage = signal(1);

  selectedBookingIds = signal<Set<string>>(new Set());

  readonly cancelDialogBooking = signal<BookingListItemDto | null>(null);
  readonly cancelReason = signal('');
  readonly cancelReasonMinLength = 5;
  readonly cancelError = signal<string | null>(null);
  readonly cancelReasonValid = computed(
    () => this.cancelReason().trim().length >= this.cancelReasonMinLength
  );
  readonly actionInProgress = signal(false);
  readonly bulkCancelOpen = signal(false);
  readonly bulkCancelReason = signal('');
  readonly bulkCancelError = signal<string | null>(null);
  readonly bulkActionInProgress = signal(false);
  readonly toast = signal<{
    message: string;
    tone: 'success' | 'error';
  } | null>(null);

  selectedFacility = computed(
    () =>
      this.facilities().find((f) => f.id === this.selectedFacilityId()) ?? null
  );
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;

  get cancelDialogCopy(): {
    title: string;
    message: string;
    confirmLabel: string;
  } {
    return {
      title: this.t('BOOKING_LIST.DIALOG.CANCEL_TITLE', 'Cancel booking'),
      message: this.t(
        'BOOKING_LIST.DIALOG.CANCEL_MESSAGE',
        'This action is permanent and cannot be undone.'
      ),
      confirmLabel: this.t(
        'BOOKING_LIST.DIALOG.CANCEL_CONFIRM',
        'Cancel booking'
      ),
    };
  }

  get bulkCancelDialogCopy(): {
    title: string;
    message: string;
    confirmLabel: string;
  } {
    return {
      title: this.t(
        'BOOKING_LIST.DIALOG.BULK_CANCEL_TITLE',
        'Cancel selected bookings'
      ),
      message: this.t(
        'BOOKING_LIST.DIALOG.BULK_CANCEL_MESSAGE',
        'This action will cancel all selected bookings and cannot be undone.'
      ),
      confirmLabel: this.t(
        'BOOKING_LIST.DIALOG.BULK_CANCEL_CONFIRM',
        'Cancel bookings'
      ),
    };
  }

  get statusFilterOptions(): Array<{
    value: BookingStatus | 'ALL';
    label: string;
  }> {
    return [
      { value: 'ALL', label: this.t('BOOKING_LIST.STATUS.ALL', 'All') },
      {
        value: BookingStatus.PENDING,
        label: this.t('BOOKING_LIST.STATUS.PENDING', 'Pending'),
      },
      {
        value: BookingStatus.CONFIRMED,
        label: this.t('BOOKING_LIST.STATUS.CONFIRMED', 'Confirmed'),
      },
      {
        value: BookingStatus.COMPLETED,
        label: this.t('BOOKING_LIST.STATUS.COMPLETED', 'Completed'),
      },
      {
        value: BookingStatus.CANCELLED,
        label: this.t('BOOKING_LIST.STATUS.CANCELLED', 'Cancelled'),
      },
      {
        value: BookingStatus.NO_SHOW,
        label: this.t('BOOKING_LIST.STATUS.NO_SHOW', 'No show'),
      },
    ];
  }

  get paymentFilterOptions(): Array<{
    value: PaymentStatus | 'ALL';
    label: string;
  }> {
    return [
      { value: 'ALL', label: this.t('BOOKING_LIST.PAYMENT.ALL', 'All') },
      {
        value: PaymentStatus.PENDING,
        label: this.t('BOOKING_LIST.PAYMENT.UNPAID', 'Unpaid'),
      },
      {
        value: PaymentStatus.PARTIALLY_PAID,
        label: this.t('BOOKING_LIST.PAYMENT.PARTIAL', 'Partial'),
      },
      {
        value: PaymentStatus.PAID,
        label: this.t('BOOKING_LIST.PAYMENT.PAID', 'Paid'),
      },
      {
        value: PaymentStatus.REFUNDED,
        label: this.t('BOOKING_LIST.PAYMENT.REFUNDED', 'Refunded'),
      },
    ];
  }

  readonly filteredBookings = computed(() => {
    const raw = [...this.bookings()];
    const term = this.searchTerm().trim().toLowerCase();
    const statusFilter = this.filterStatus();
    const paymentFilter = this.filterPaymentStatus();
    const startDate = this.startDateFilter();
    const endDate = this.endDateFilter();
    const dateRangeError = this.dateRangeError();

    let result = raw;

    if (statusFilter !== 'ALL') {
      result = result.filter((booking) => booking.status === statusFilter);
    }
    if (paymentFilter !== 'ALL') {
      result = result.filter(
        (booking) => booking.paymentStatus === paymentFilter
      );
    }
    if (term) {
      result = result.filter((booking) => {
        const haystack = [
          booking.customerName,
          booking.customerPhone,
          booking.bookingReference,
          booking.facility?.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(term);
      });
    }

    if (!dateRangeError && startDate) {
      const start = new Date(`${startDate}T00:00:00`);
      result = result.filter(
        (booking) => new Date(booking.startTime).getTime() >= start.getTime()
      );
    }
    if (!dateRangeError && endDate) {
      const end = new Date(`${endDate}T23:59:59`);
      result = result.filter(
        (booking) => new Date(booking.startTime).getTime() <= end.getTime()
      );
    }

    const key = this.sortKey();
    const direction = this.sortDirection() === 'asc' ? 1 : -1;

    result.sort((a, b) => {
      const valueA = this.getSortValue(a, key);
      const valueB = this.getSortValue(b, key);
      if (valueA < valueB) return -1 * direction;
      if (valueA > valueB) return 1 * direction;
      return 0;
    });

    return result;
  });

  readonly totalFilteredCount = computed(() => this.filteredBookings().length);

  readonly totalPages = computed(() => {
    const total = this.totalFilteredCount();
    const size = this.pageSize();
    return Math.max(1, Math.ceil(total / size));
  });

  readonly currentPageSafe = computed(() => {
    return Math.min(this.currentPage(), this.totalPages());
  });

  readonly hasPreviousPage = computed(() => this.currentPageSafe() > 1);
  readonly hasNextPage = computed(
    () => this.currentPageSafe() < this.totalPages()
  );

  readonly pagedBookings = computed(() => {
    const page = this.currentPageSafe();
    const size = this.pageSize();
    const start = (page - 1) * size;
    return this.filteredBookings().slice(start, start + size);
  });

  readonly pageRangeLabel = computed(() => {
    const total = this.totalFilteredCount();
    if (total === 0) {
      return this.t('BOOKING_LIST.PAGINATION.SHOWING_ZERO', 'Showing 0');
    }
    const page = this.currentPageSafe();
    const size = this.pageSize();
    const start = (page - 1) * size + 1;
    const end = Math.min(page * size, total);
    return this.t(
      'BOOKING_LIST.PAGINATION.SHOWING_RANGE',
      `Showing ${start} to ${end} of ${total}`,
      { start, end, total }
    );
  });

  readonly inputLang = computed(() =>
    this.localeFormat.getCurrentLocale() === 'ar-SA' ? 'ar' : 'en'
  );

  readonly selectionCount = computed(() => this.selectedBookingIds().size);
  readonly dateRangeError = computed(() => {
    const start = this.startDateFilter().trim();
    const end = this.endDateFilter().trim();
    if (!start || !end) return null;
    return start > end
      ? this.t(
          'BOOKING_LIST.FILTERS.DATE_RANGE_ERROR',
          'Start date must be before end date.'
        )
      : null;
  });
  readonly filtersValid = computed(() => this.dateRangeError() === null);
  readonly selectedCancellableBookings = computed(() => {
    const selected = this.selectedBookingIds();
    return this.bookings().filter(
      (booking) => selected.has(booking.id) && this.isCancellable(booking)
    );
  });
  readonly allPageSelected = computed(() => {
    const pageBookings = this.pagedBookings().filter((booking) =>
      this.isCancellable(booking)
    );
    if (pageBookings.length === 0) return false;
    const selected = this.selectedBookingIds();
    return pageBookings.every((booking) => selected.has(booking.id));
  });

  private searchDebounceId: number | null = null;
  private toastTimer: number | null = null;

  /**
   * Initialize facility data and load bookings.
   */
  ngOnInit(): void {
    this.loadFacilities();
    this.store.loadBookings(this.getFacilityFilter());
  }

  /**
   * Clear timers on destroy.
   */
  ngOnDestroy(): void {
    if (this.searchDebounceId) {
      window.clearTimeout(this.searchDebounceId);
      this.searchDebounceId = null;
    }
    if (this.toastTimer) {
      window.clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
  }

  /**
   * Reload bookings when facility selection changes.
   */
  onFacilityChange(): void {
    this.store.loadBookings(this.getFacilityFilter());
    this.currentPage.set(1);
    this.clearSelection();
  }

  private loadFacilities(): void {
    this.facilityError.set(null);
    this.api.getFacilities().subscribe({
      next: (facilities) => {
        this.facilities.set(facilities);
        this.facilityError.set(null);
      },
      error: (err) => {
        const resolved =
          err instanceof Error
            ? err
            : new Error(
                this.t(
                  'BOOKING_LIST.ERRORS.LOAD_FACILITIES',
                  'Failed to load facilities. Please try again.'
                )
              );
        this.facilityError.set(resolved);
        console.error('Error loading facilities:', err);
      },
    });
  }

  /**
   * Retry loading bookings using the current facility filter.
   */
  retryLoad(): void {
    this.store.loadBookings(this.getFacilityFilter());
    this.clearSelection();
  }

  /**
   * Retry loading facilities list.
   */
  retryFacilities(): void {
    this.loadFacilities();
  }

  private getFacilityFilter(): string | null {
    const facilityId = this.selectedFacilityId().trim();
    return facilityId.length > 0 ? facilityId : null;
  }

  /**
   * Format an ISO date string for display.
   */
  formatDate(isoString: string): string {
    return this.localeFormat.formatDate(isoString, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  }

  /**
   * Format an ISO time string for display.
   */
  formatTime(isoString: string | null | undefined): string {
    if (!isoString) return '';
    return this.localeFormat.formatDate(isoString, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  /**
   * Format a time range for display.
   */
  formatTimeRange(startIso: string, endIso: string): string {
    return `${this.formatTime(startIso)} - ${this.formatTime(endIso)}`;
  }

  /**
   * Map booking status to a visual tone.
   */
  statusTone(status: string): BookingStatusTone {
    switch (status) {
      case 'CONFIRMED':
        return 'success';
      case 'PENDING':
        return 'warning';
      case 'CANCELLED':
      case 'NO_SHOW':
        return 'danger';
      default:
        return 'default';
    }
  }

  /**
   * Map booking status to a display label.
   */
  statusLabel(status: string): string {
    switch (status) {
      case 'CONFIRMED':
        return this.t('BOOKING_LIST.STATUS.CONFIRMED', 'Confirmed');
      case 'PENDING':
        return this.t('BOOKING_LIST.STATUS.PENDING', 'Pending');
      case 'CANCELLED':
        return this.t('BOOKING_LIST.STATUS.CANCELLED', 'Cancelled');
      case 'NO_SHOW':
        return this.t('BOOKING_LIST.STATUS.NO_SHOW', 'No show');
      default:
        return status;
    }
  }

  /**
   * Determine whether a pending booking hold is still active.
   */
  isHoldActive(booking: BookingListItemDto): boolean {
    if (booking.status !== BookingStatus.PENDING || !booking.holdUntil) {
      return false;
    }
    return new Date(booking.holdUntil).getTime() > Date.now();
  }

  /**
   * Resolve booking price using total amount or facility hourly rate.
   */
  bookingPrice(booking: BookingListItemDto): {
    amount: number;
    currency: string;
  } {
    const currency = booking.currency || 'SAR';
    const totalAmount = booking.totalAmount;
    if (typeof totalAmount === 'number' && !Number.isNaN(totalAmount)) {
      return { amount: totalAmount, currency };
    }
    if (typeof totalAmount === 'string' && totalAmount.trim().length > 0) {
      const parsed = Number(totalAmount);
      if (!Number.isNaN(parsed)) {
        return { amount: parsed, currency };
      }
    }

    const pricePerHour = booking.facility?.config?.pricePerHour ?? 0;
    const start = new Date(booking.startTime).getTime();
    const end = new Date(booking.endTime).getTime();
    const hours = Math.max(0, (end - start) / (60 * 60 * 1000));
    const amount = Math.round(pricePerHour * hours);
    return { amount, currency };
  }

  /**
   * Format a numeric amount as currency.
   */
  formatPrice(amount: number, currency: string): string {
    return this.localeFormat.formatCurrency(amount, currency);
  }

  /**
   * Debounce search input and reset pagination.
   */
  onSearchChange(value: string): void {
    this.searchInput.set(value);
    if (this.searchDebounceId) {
      window.clearTimeout(this.searchDebounceId);
    }
    this.searchDebounceId = window.setTimeout(() => {
      this.searchTerm.set(this.searchInput());
      this.currentPage.set(1);
      this.searchDebounceId = null;
    }, SEARCH_DEBOUNCE_MS);
  }

  /**
   * Reset pagination after filter changes.
   */
  onFiltersChange(): void {
    this.currentPage.set(1);
    this.focusedRowIndex.set(0);
  }

  /**
   * Update status filter and reset pagination.
   */
  onStatusFilterChange(value: string): void {
    this.filterStatus.set(value as BookingStatus | 'ALL');
    this.onFiltersChange();
  }

  /**
   * Update payment filter and reset pagination.
   */
  onPaymentFilterChange(value: string): void {
    this.filterPaymentStatus.set(value as PaymentStatus | 'ALL');
    this.onFiltersChange();
  }

  /**
   * Update page size and reset pagination.
   */
  onPageSizeChange(value: string): void {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      this.pageSize.set(parsed);
      this.currentPage.set(1);
      this.focusedRowIndex.set(0);
    }
  }

  /**
   * Update sort key or toggle sort direction.
   */
  setSort(key: 'date' | 'customer' | 'status' | 'price'): void {
    if (this.sortKey() === key) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
      this.currentPage.set(1);
      this.focusedRowIndex.set(0);
      return;
    }
    this.sortKey.set(key);
    this.sortDirection.set('asc');
    this.currentPage.set(1);
    this.focusedRowIndex.set(0);
  }

  /**
   * Return ARIA sort state for column headers.
   */
  getAriaSort(
    key: 'date' | 'customer' | 'status' | 'price'
  ): 'none' | 'ascending' | 'descending' {
    if (this.sortKey() !== key) return 'none';
    return this.sortDirection() === 'asc' ? 'ascending' : 'descending';
  }

  /**
   * Navigate to a specific page.
   */
  goToPage(page: number): void {
    const total = this.totalPages();
    const next = Math.min(Math.max(page, 1), total);
    this.currentPage.set(next);
    this.focusedRowIndex.set(0);
  }

  /**
   * Navigate to the next page.
   */
  nextPage(): void {
    this.goToPage(this.currentPage() + 1);
  }

  /**
   * Navigate to the previous page.
   */
  previousPage(): void {
    this.goToPage(this.currentPage() - 1);
  }

  /**
   * Determine whether a booking can be cancelled.
   */
  isCancellable(booking: BookingListItemDto): boolean {
    if (booking.status === BookingStatus.CANCELLED) return false;
    return (
      booking.paymentStatus !== PaymentStatus.PAID &&
      booking.paymentStatus !== PaymentStatus.PARTIALLY_PAID
    );
  }

  /**
   * Toggle selection for a single booking.
   */
  toggleBookingSelection(booking: BookingListItemDto, checked: boolean): void {
    if (!this.isCancellable(booking)) return;
    const next = new Set(this.selectedBookingIds());
    if (checked) {
      next.add(booking.id);
    } else {
      next.delete(booking.id);
    }
    this.selectedBookingIds.set(next);
  }

  /**
   * Toggle selection for all cancellable bookings on the current page.
   */
  toggleSelectAllOnPage(checked: boolean): void {
    const next = new Set(this.selectedBookingIds());
    for (const booking of this.pagedBookings()) {
      if (!this.isCancellable(booking)) continue;
      if (checked) {
        next.add(booking.id);
      } else {
        next.delete(booking.id);
      }
    }
    this.selectedBookingIds.set(next);
  }

  /**
   * Clear all selected bookings.
   */
  clearSelection(): void {
    this.selectedBookingIds.set(new Set());
  }

  /**
   * Open the bulk cancel dialog if there are selections.
   */
  openBulkCancelDialog(): void {
    if (this.selectedCancellableBookings().length === 0) {
      return;
    }
    this.bulkCancelReason.set('');
    this.bulkCancelError.set(null);
    this.bulkCancelOpen.set(true);
  }

  /**
   * Close the bulk cancel dialog and reset inputs.
   */
  closeBulkCancelDialog(): void {
    this.bulkCancelOpen.set(false);
    this.bulkCancelReason.set('');
    this.bulkCancelError.set(null);
    this.bulkActionInProgress.set(false);
  }

  /**
   * Submit a bulk cancel request for selected bookings.
   */
  async submitBulkCancel(): Promise<void> {
    if (this.bulkActionInProgress()) return;
    const reason = this.bulkCancelReason().trim();
    if (reason.length < this.cancelReasonMinLength) {
      this.bulkCancelError.set(
        this.t(
          'BOOKING_LIST.ERRORS.CANCELLATION_REASON_REQUIRED',
          'Cancellation reason is required.'
        )
      );
      return;
    }

    const targets = this.selectedCancellableBookings();
    if (targets.length === 0) {
      this.bulkCancelError.set(
        this.t(
          'BOOKING_LIST.ERRORS.NO_CANCELLABLE_SELECTED',
          'No cancellable bookings selected.'
        )
      );
      return;
    }

    this.bulkActionInProgress.set(true);
    try {
      const results = await Promise.all(
        targets.map((booking) => this.store.cancelBooking(booking.id, reason))
      );
      const failures = results.filter((success) => !success).length;

      if (failures > 0) {
        this.bulkCancelError.set(
          this.t(
            'BOOKING_LIST.ERRORS.BULK_CANCELLATIONS_FAILED_COUNT',
            `${failures} of ${targets.length} cancellations failed.`,
            { failures, total: targets.length }
          )
        );
        this.showToast(
          this.t(
            'BOOKING_LIST.ERRORS.SOME_CANCELLATIONS_FAILED',
            'Some cancellations failed. Please retry.'
          ),
          'error'
        );
        return;
      }

      this.showToast(
        this.t(
          'BOOKING_LIST.TOAST.SELECTED_BOOKINGS_CANCELLED',
          'Selected bookings cancelled.'
        ),
        'success'
      );
      this.closeBulkCancelDialog();
      this.clearSelection();
    } catch (error) {
      this.bulkCancelError.set(
        this.t(
          'BOOKING_LIST.ERRORS.BULK_CANCELLATION_FAILED',
          'Bulk cancellation failed. Please try again.'
        )
      );
      this.showToast(
        this.t(
          'BOOKING_LIST.ERRORS.BULK_CANCELLATION_FAILED',
          'Bulk cancellation failed. Please try again.'
        ),
        'error'
      );
    } finally {
      this.bulkActionInProgress.set(false);
    }
  }

  /**
   * Export filtered bookings to CSV.
   */
  exportCsv(): void {
    const rows = this.filteredBookings();
    if (rows.length === 0) return;

    const headers = [
      this.t('BOOKING_LIST.CSV.HEADERS.BOOKING_REFERENCE', 'Booking Reference'),
      this.t('BOOKING_LIST.CSV.HEADERS.CUSTOMER_NAME', 'Customer Name'),
      this.t('BOOKING_LIST.CSV.HEADERS.CUSTOMER_PHONE', 'Customer Phone'),
      this.t('BOOKING_LIST.CSV.HEADERS.FACILITY', 'Facility'),
      this.t('BOOKING_LIST.CSV.HEADERS.STATUS', 'Status'),
      this.t('BOOKING_LIST.CSV.HEADERS.PAYMENT_STATUS', 'Payment Status'),
      this.t('BOOKING_LIST.CSV.HEADERS.START_TIME', 'Start Time'),
      this.t('BOOKING_LIST.CSV.HEADERS.END_TIME', 'End Time'),
      this.t('BOOKING_LIST.CSV.HEADERS.PRICE', 'Price'),
      this.t('BOOKING_LIST.CSV.HEADERS.CURRENCY', 'Currency'),
    ];

    const csvRows = [
      headers.join(','),
      ...rows.map((booking) => {
        const price = this.bookingPrice(booking);
        const values = [
          booking.bookingReference ?? '',
          booking.customerName,
          booking.customerPhone,
          booking.facility?.name ?? '',
          booking.status,
          booking.paymentStatus,
          booking.startTime,
          booking.endTime,
          price.amount.toString(),
          price.currency,
        ];
        return values.map((value) => this.escapeCsvValue(value)).join(',');
      }),
    ];

    const blob = new Blob([csvRows.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bookings-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private escapeCsvValue(value: string): string {
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  /**
   * Track the focused row index for keyboard navigation.
   */
  onRowFocus(index: number): void {
    this.focusedRowIndex.set(index);
  }

  /**
   * Resolve the tabindex for a row based on focus position.
   */
  rowTabIndex(index: number): number {
    const total = this.pagedBookings().length;
    const safeIndex = Math.min(
      Math.max(this.focusedRowIndex(), 0),
      Math.max(0, total - 1)
    );
    return safeIndex === index ? 0 : -1;
  }

  /**
   * Handle keyboard navigation within the bookings table.
   */
  onRowKeydown(event: KeyboardEvent, index: number): void {
    const rows = this.bookingRows?.toArray() ?? [];
    if (rows.length === 0) return;

    let nextIndex = index;
    if (event.key === 'ArrowDown') {
      nextIndex = Math.min(rows.length - 1, index + 1);
    } else if (event.key === 'ArrowUp') {
      nextIndex = Math.max(0, index - 1);
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = rows.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    this.focusedRowIndex.set(nextIndex);
    rows[nextIndex]?.nativeElement.focus();
  }

  private getSortValue(
    booking: BookingListItemDto,
    key: 'date' | 'customer' | 'status' | 'price'
  ): string | number {
    switch (key) {
      case 'customer':
        return booking.customerName.toLowerCase();
      case 'status':
        return booking.status;
      case 'price':
        return this.bookingPrice(booking).amount;
      case 'date':
      default:
        return new Date(booking.startTime).getTime();
    }
  }

  private showToast(message: string, tone: 'success' | 'error'): void {
    this.toast.set({ message, tone });
    if (this.toastTimer) {
      window.clearTimeout(this.toastTimer);
    }
    this.toastTimer = window.setTimeout(() => {
      this.toast.set(null);
      this.toastTimer = null;
    }, 2500);
  }

  /**
   * Open the cancel dialog for a booking.
   */
  openCancelDialog(booking: BookingListItemDto): void {
    if (booking.status === BookingStatus.CANCELLED) return;
    this.cancelDialogBooking.set(booking);
    this.cancelReason.set('');
    this.cancelError.set(null);
  }

  /**
   * Close the cancel dialog and reset inputs.
   */
  closeCancelDialog(): void {
    this.cancelDialogBooking.set(null);
    this.cancelReason.set('');
    this.cancelError.set(null);
    this.actionInProgress.set(false);
  }

  /**
   * Submit cancellation for the selected booking.
   */
  async submitCancelDialog(): Promise<void> {
    if (this.actionInProgress()) return;
    const booking = this.cancelDialogBooking();
    if (!booking) return;
    if (!this.cancelReasonValid()) return;

    this.actionInProgress.set(true);
    try {
      const success = await this.store.cancelBooking(
        booking.id,
        this.cancelReason().trim()
      );

      if (success) {
        this.closeCancelDialog();
        this.showToast(
          this.t('BOOKING_LIST.TOAST.BOOKING_CANCELLED', 'Booking cancelled.'),
          'success'
        );
        this.selectedBookingIds.update((current) => {
          const next = new Set(current);
          next.delete(booking.id);
          return next;
        });
      } else {
        const failureMessage = this.t(
          'BOOKING_LIST.ERRORS.CANCELLATION_FAILED',
          'Cancellation failed. Please try again.'
        );
        this.cancelError.set(failureMessage);
        this.showToast(failureMessage, 'error');
      }
    } catch (error) {
      const failureMessage = this.t(
        'BOOKING_LIST.ERRORS.CANCELLATION_FAILED',
        'Cancellation failed. Please try again.'
      );
      this.cancelError.set(failureMessage);
      this.showToast(failureMessage, 'error');
    } finally {
      this.actionInProgress.set(false);
    }
  }

  /**
   * Mark a booking as paid.
   */
  async markAsPaid(booking: BookingListItemDto): Promise<void> {
    if (booking.paymentStatus === PaymentStatus.PAID) return;
    if (this.actionLoadingById()[booking.id]) return;
    try {
      const success = await this.store.markBookingPaid(booking.id);
      if (success) {
        this.showToast(
          this.t(
            'BOOKING_LIST.TOAST.BOOKING_MARKED_PAID',
            'Booking marked as paid.'
          ),
          'success'
        );
      } else {
        this.showToast(
          this.t(
            'BOOKING_LIST.ERRORS.MARK_PAID_FAILED',
            'Failed to mark booking as paid.'
          ),
          'error'
        );
      }
    } catch (error) {
      this.showToast(
        this.t(
          'BOOKING_LIST.ERRORS.MARK_PAID_FAILED',
          'Failed to mark booking as paid.'
        ),
        'error'
      );
    }
  }

  text(
    key: string,
    fallback: string,
    params?: Record<string, string | number>
  ): string {
    return this.t(key, fallback, params);
  }

  private t(
    key: string,
    fallback: string,
    params?: Record<string, string | number>
  ): string {
    this.languageService?.languageVersion();
    const translated = this.translateService?.instant(key, params);
    return translated && translated !== key ? translated : fallback;
  }

  readonly BookingStatus = BookingStatus;
  readonly PaymentStatus = PaymentStatus;
}
