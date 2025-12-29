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
import { ApiService } from '../../shared/services/api.service';
import { BookingStore } from '../../state/bookings/booking.store';
import { ConfirmationDialogComponent } from '../../shared/components/confirmation-dialog.component';
import { CancellationFormComponent } from '../../shared/components/cancellation-form.component';
import {
  BookingStatus,
  PaymentStatus,
  BookingListItemDto,
  FacilityListItemDto,
} from '@khana/shared-dtos';

type BookingStatusTone = 'success' | 'warning' | 'danger' | 'default';

const CANCEL_DIALOG_COPY = {
  title: 'Cancel booking',
  message: 'This action is permanent and cannot be undone.',
  confirmLabel: 'Cancel booking',
};
const CANCEL_FAILURE_MESSAGE = 'Cancellation failed. Please try again.';
const BULK_CANCEL_COPY = {
  title: 'Cancel selected bookings',
  message:
    'This action will cancel all selected bookings and cannot be undone.',
  confirmLabel: 'Cancel bookings',
};
const SEARCH_DEBOUNCE_MS = 300;
const PAGE_SIZE_OPTIONS = [25, 50, 100];

@Component({
  selector: 'app-booking-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ConfirmationDialogComponent,
    CancellationFormComponent,
  ],
  templateUrl: './booking-list.component.html',
  styleUrl: './booking-list.component.scss',
})
export class BookingListComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  readonly store = inject(BookingStore);

  @ViewChildren('bookingRow') bookingRows?: QueryList<
    ElementRef<HTMLTableRowElement>
  >;

  facilities = signal<FacilityListItemDto[]>([]);
  selectedFacilityId = signal<string>('');
  focusedRowIndex = signal(0);

  bookings = this.store.bookings;
  loading = this.store.loading;
  error = this.store.error;

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
  readonly cancelDialogCopy = CANCEL_DIALOG_COPY;
  readonly bulkCancelDialogCopy = BULK_CANCEL_COPY;
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
  readonly statusFilterOptions: Array<{
    value: BookingStatus | 'ALL';
    label: string;
  }> = [
    { value: 'ALL', label: 'All' },
    { value: BookingStatus.PENDING, label: 'Pending' },
    { value: BookingStatus.CONFIRMED, label: 'Confirmed' },
    { value: BookingStatus.COMPLETED, label: 'Completed' },
    { value: BookingStatus.CANCELLED, label: 'Cancelled' },
    { value: BookingStatus.NO_SHOW, label: 'No show' },
  ];
  readonly paymentFilterOptions: Array<{
    value: PaymentStatus | 'ALL';
    label: string;
  }> = [
    { value: 'ALL', label: 'All' },
    { value: PaymentStatus.PENDING, label: 'Unpaid' },
    { value: PaymentStatus.PARTIALLY_PAID, label: 'Partial' },
    { value: PaymentStatus.PAID, label: 'Paid' },
    { value: PaymentStatus.REFUNDED, label: 'Refunded' },
  ];

  readonly filteredBookings = computed(() => {
    const raw = [...this.bookings()];
    const term = this.searchTerm().trim().toLowerCase();
    const statusFilter = this.filterStatus();
    const paymentFilter = this.filterPaymentStatus();
    const startDate = this.startDateFilter();
    const endDate = this.endDateFilter();

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

    if (startDate) {
      const start = new Date(`${startDate}T00:00:00`);
      result = result.filter(
        (booking) => new Date(booking.startTime).getTime() >= start.getTime()
      );
    }
    if (endDate) {
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
    if (total === 0) return 'Showing 0';
    const page = this.currentPageSafe();
    const size = this.pageSize();
    const start = (page - 1) * size + 1;
    const end = Math.min(page * size, total);
    return `Showing ${start}-${end} of ${total}`;
  });

  readonly selectionCount = computed(() => this.selectedBookingIds().size);
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

  ngOnInit(): void {
    this.loadFacilities();
    this.store.loadBookings(this.getFacilityFilter());
  }

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

  onFacilityChange(): void {
    this.store.loadBookings(this.getFacilityFilter());
    this.currentPage.set(1);
    this.clearSelection();
  }

  private loadFacilities(): void {
    this.api.getFacilities().subscribe({
      next: (facilities) => {
        this.facilities.set(facilities);
      },
      error: (err) => {
        // We can use a local error or store error, but facilities are separate
        console.error('Error loading facilities:', err);
      },
    });
  }

  private getFacilityFilter(): string | null {
    const facilityId = this.selectedFacilityId().trim();
    return facilityId.length > 0 ? facilityId : null;
  }

  formatDate(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-SA', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  }

  formatTime(isoString: string | null | undefined): string {
    if (!isoString) return '';
    return new Date(isoString).toLocaleTimeString('en-SA', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  formatTimeRange(startIso: string, endIso: string): string {
    return `${this.formatTime(startIso)} – ${this.formatTime(endIso)}`;
  }

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

  statusLabel(status: string): string {
    switch (status) {
      case 'CONFIRMED':
        return 'Confirmed';
      case 'PENDING':
        return 'Pending';
      case 'CANCELLED':
        return 'Cancelled';
      case 'NO_SHOW':
        return 'No show';
      default:
        return status;
    }
  }

  isHoldActive(booking: BookingListItemDto): boolean {
    if (booking.status !== BookingStatus.PENDING || !booking.holdUntil) {
      return false;
    }
    return new Date(booking.holdUntil).getTime() > Date.now();
  }

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

  formatPrice(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-SA', {
      style: 'currency',
      currency,
    }).format(amount);
  }

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

  onFiltersChange(): void {
    this.currentPage.set(1);
  }

  onStatusFilterChange(value: string): void {
    this.filterStatus.set(value as BookingStatus | 'ALL');
    this.onFiltersChange();
  }

  onPaymentFilterChange(value: string): void {
    this.filterPaymentStatus.set(value as PaymentStatus | 'ALL');
    this.onFiltersChange();
  }

  onPageSizeChange(value: string): void {
    const parsed = Number(value);
    if (!Number.isNaN(parsed)) {
      this.pageSize.set(parsed);
      this.currentPage.set(1);
      this.focusedRowIndex.set(0);
    }
  }

  setSort(key: 'date' | 'customer' | 'status' | 'price'): void {
    if (this.sortKey() === key) {
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
      return;
    }
    this.sortKey.set(key);
    this.sortDirection.set('asc');
  }

  getAriaSort(
    key: 'date' | 'customer' | 'status' | 'price'
  ): 'none' | 'ascending' | 'descending' {
    if (this.sortKey() !== key) return 'none';
    return this.sortDirection() === 'asc' ? 'ascending' : 'descending';
  }

  goToPage(page: number): void {
    const total = this.totalPages();
    const next = Math.min(Math.max(page, 1), total);
    this.currentPage.set(next);
    this.focusedRowIndex.set(0);
  }

  nextPage(): void {
    this.goToPage(this.currentPage() + 1);
  }

  previousPage(): void {
    this.goToPage(this.currentPage() - 1);
  }

  isCancellable(booking: BookingListItemDto): boolean {
    if (booking.status === BookingStatus.CANCELLED) return false;
    return (
      booking.paymentStatus !== PaymentStatus.PAID &&
      booking.paymentStatus !== PaymentStatus.PARTIALLY_PAID
    );
  }

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

  clearSelection(): void {
    this.selectedBookingIds.set(new Set());
  }

  openBulkCancelDialog(): void {
    if (this.selectedCancellableBookings().length === 0) {
      return;
    }
    this.bulkCancelReason.set('');
    this.bulkCancelError.set(null);
    this.bulkCancelOpen.set(true);
  }

  closeBulkCancelDialog(): void {
    this.bulkCancelOpen.set(false);
    this.bulkCancelReason.set('');
    this.bulkCancelError.set(null);
    this.bulkActionInProgress.set(false);
  }

  async submitBulkCancel(): Promise<void> {
    if (this.bulkActionInProgress()) return;
    const reason = this.bulkCancelReason().trim();
    if (reason.length < this.cancelReasonMinLength) {
      this.bulkCancelError.set('Cancellation reason is required.');
      return;
    }

    const targets = this.selectedCancellableBookings();
    if (targets.length === 0) {
      this.bulkCancelError.set('No cancellable bookings selected.');
      return;
    }

    this.bulkActionInProgress.set(true);
    const results = await Promise.all(
      targets.map((booking) => this.store.cancelBooking(booking.id, reason))
    );
    const failures = results.filter((success) => !success).length;
    this.bulkActionInProgress.set(false);

    if (failures > 0) {
      this.bulkCancelError.set(
        `${failures} of ${targets.length} cancellations failed.`
      );
      this.showToast('Some cancellations failed. Please retry.', 'error');
      return;
    }

    this.showToast('Selected bookings cancelled.', 'success');
    this.closeBulkCancelDialog();
    this.clearSelection();
  }

  exportCsv(): void {
    const rows = this.filteredBookings();
    if (rows.length === 0) return;

    const headers = [
      'Booking Reference',
      'Customer Name',
      'Customer Phone',
      'Facility',
      'Status',
      'Payment Status',
      'Start Time',
      'End Time',
      'Price',
      'Currency',
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

  onRowFocus(index: number): void {
    this.focusedRowIndex.set(index);
  }

  rowTabIndex(index: number): number {
    const total = this.pagedBookings().length;
    const safeIndex = Math.min(
      Math.max(this.focusedRowIndex(), 0),
      Math.max(0, total - 1)
    );
    return safeIndex === index ? 0 : -1;
  }

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

  openCancelDialog(booking: BookingListItemDto): void {
    if (booking.status === BookingStatus.CANCELLED) return;
    this.cancelDialogBooking.set(booking);
    this.cancelReason.set('');
    this.cancelError.set(null);
  }

  closeCancelDialog(): void {
    this.cancelDialogBooking.set(null);
    this.cancelReason.set('');
    this.cancelError.set(null);
    this.actionInProgress.set(false);
  }

  async submitCancelDialog(): Promise<void> {
    if (this.actionInProgress()) return;
    const booking = this.cancelDialogBooking();
    if (!booking) return;
    if (!this.cancelReasonValid()) return;

    this.actionInProgress.set(true);
    const success = await this.store.cancelBooking(
      booking.id,
      this.cancelReason().trim()
    );
    this.actionInProgress.set(false);

    if (success) {
      this.closeCancelDialog();
      this.showToast('Booking cancelled.', 'success');
      this.selectedBookingIds.update((current) => {
        const next = new Set(current);
        next.delete(booking.id);
        return next;
      });
    } else {
      this.cancelError.set(CANCEL_FAILURE_MESSAGE);
      this.showToast(CANCEL_FAILURE_MESSAGE, 'error');
    }
  }

  async markAsPaid(booking: BookingListItemDto): Promise<void> {
    if (booking.paymentStatus === PaymentStatus.PAID) return;
    const success = await this.store.markBookingPaid(booking.id);
    if (success) {
      this.showToast('Booking marked as paid.', 'success');
    } else {
      this.showToast('Failed to mark booking as paid.', 'error');
    }
  }

  readonly BookingStatus = BookingStatus;
  readonly PaymentStatus = PaymentStatus;
}
