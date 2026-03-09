import {
  DestroyRef,
  Directive,
  ElementRef,
  QueryList,
  ViewChildren,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import {
  BookingCancellationScope,
  BookingListItemDto,
  BookingStatus,
  PaymentStatus,
  UserRole,
  parseCancellationReason,
} from '@khana/shared-dtos';
import { ApiService } from '../../../shared/services/api.service';
import { LanguageService } from '../../../shared/services/language.service';
import { LocaleFormatService } from '../../../shared/services/locale-format.service';
import { AuthStore } from '../../../shared/state/auth.store';
import { FacilityContextStore } from '../../../shared/state';
import { BookingStore } from '../../../state/bookings/booking.store';
import {
  BookingStatusFilter,
  BookingStatusTone,
  PAGE_SIZE_OPTIONS,
} from './booking-list.models';

@Directive()
export abstract class BookingListRouteStateBase {
  protected readonly destroyRef = inject(DestroyRef);
  protected readonly languageService = inject(LanguageService, {
    optional: true,
  });
  protected readonly localeFormat = inject(LocaleFormatService);
  protected readonly api = inject(ApiService);
  protected readonly facilityContext = inject(FacilityContextStore);
  protected readonly authStore = inject(AuthStore);
  protected readonly route = inject(ActivatedRoute);
  protected readonly translateService = inject(TranslateService, {
    optional: true,
  });
  readonly store = inject(BookingStore);

  @ViewChildren('bookingRow') bookingRows?: QueryList<
    ElementRef<HTMLTableRowElement>
  >;

  readonly facilities = this.facilityContext.facilities;
  readonly selectedFacilityId = computed(
    () => this.facilityContext.selectedFacilityId() ?? ''
  );
  focusedRowIndex = signal(0);
  readonly facilityError = this.facilityContext.error;

  bookings = this.store.bookings;
  loading = this.store.loading;
  error = this.store.error;
  actionLoadingById = this.store.actionLoadingById;

  searchInput = signal('');
  searchTerm = signal('');
  filterStatus = signal<BookingStatusFilter>('ALL');
  filterPaymentStatus = signal<PaymentStatus | 'ALL'>('ALL');
  tagFilter = signal<string[]>([]);
  availableTags = signal<string[]>([]);
  startDateFilter = signal('');
  endDateFilter = signal('');
  sortKey = signal<'date' | 'customer' | 'status' | 'price'>('date');
  sortDirection = signal<'asc' | 'desc'>('desc');
  pageSize = signal<number>(PAGE_SIZE_OPTIONS[0]);
  currentPage = signal(1);

  selectedBookingIds = signal<Set<string>>(new Set());

  readonly cancelDialogBooking = signal<BookingListItemDto | null>(null);
  readonly cancelScope = signal<BookingCancellationScope>(
    BookingCancellationScope.SINGLE
  );
  readonly cancelReason = signal('');
  readonly cancelError = signal<string | null>(null);
  readonly cancelReasonValid = computed(
    () => parseCancellationReason(this.cancelReason()).isValid
  );
  readonly actionInProgress = signal(false);
  readonly bulkCancelOpen = signal(false);
  readonly bulkCancelReason = signal('');
  readonly bulkCancelError = signal<string | null>(null);
  readonly bulkCancelReasonValid = computed(
    () => parseCancellationReason(this.bulkCancelReason()).isValid
  );
  readonly bulkActionInProgress = signal(false);
  readonly bulkMarkPaidOpen = signal(false);
  readonly bulkMarkPaidError = signal<string | null>(null);
  readonly bulkMarkPaidInProgress = signal(false);
  readonly toast = signal<{
    message: string;
    tone: 'success' | 'error';
  } | null>(null);

  readonly selectedFacility = computed(
    () =>
      this.facilities().find(
        (facility) => facility.id === this.selectedFacilityId()
      ) ?? null
  );
  readonly currentUser = this.authStore.user;
  readonly currentUserRole = computed(() => this.currentUser()?.role ?? null);
  readonly canCancel = computed(() => {
    const role = this.currentUserRole();
    return (
      role === UserRole.OWNER ||
      role === UserRole.MANAGER ||
      role === UserRole.STAFF
    );
  });
  readonly canMarkPaid = computed(() => {
    const role = this.currentUserRole();
    return role === UserRole.OWNER || role === UserRole.MANAGER;
  });
  readonly canCreateNew = computed(() => {
    const role = this.currentUserRole();
    return (
      role === UserRole.OWNER ||
      role === UserRole.MANAGER ||
      role === UserRole.STAFF
    );
  });
  readonly cancellationScopes = BookingCancellationScope;
  readonly pageSizeOptions = PAGE_SIZE_OPTIONS;
  readonly BookingStatus = BookingStatus;
  readonly PaymentStatus = PaymentStatus;

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

  get bulkMarkPaidDialogCopy(): {
    title: string;
    message: string;
    confirmLabel: string;
  } {
    const count = this.selectedMarkPaidCount();
    return {
      title: this.t(
        'BOOKING_LIST.DIALOG.BULK_MARK_PAID_TITLE',
        'Mark selected bookings as paid'
      ),
      message: this.t(
        'BOOKING_LIST.DIALOG.BULK_MARK_PAID_MESSAGE',
        `Mark ${count} bookings as paid?`,
        { count }
      ),
      confirmLabel: this.t(
        'BOOKING_LIST.DIALOG.BULK_MARK_PAID_CONFIRM',
        'Mark as paid'
      ),
    };
  }

  get statusFilterOptions(): Array<{
    value: BookingStatusFilter;
    label: string;
    count?: number;
  }> {
    return [
      { value: 'ALL', label: this.t('BOOKING_LIST.STATUS.ALL', 'All') },
      {
        value: 'ON_HOLD',
        label: this.t('BOOKING_LIST.STATUS.ON_HOLD', 'On Hold'),
        count: this.onHoldCount(),
      },
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
    const statusFilter = this.filterStatus();
    let result = [...this.bookingsAfterNonStatusFilters()];

    if (statusFilter === 'ON_HOLD') {
      result = result.filter((booking) => this.isOnHoldBooking(booking));
    } else if (statusFilter !== 'ALL') {
      result = result.filter((booking) => booking.status === statusFilter);
    }

    const key = this.sortKey();
    const direction = this.sortDirection() === 'asc' ? 1 : -1;
    result.sort((left, right) => {
      const valueA = this.getSortValue(left, key);
      const valueB = this.getSortValue(right, key);
      if (valueA < valueB) {
        return -1 * direction;
      }
      if (valueA > valueB) {
        return 1 * direction;
      }
      return 0;
    });

    return result;
  });

  readonly bookingsAfterNonStatusFilters = computed(() => {
    const raw = [...this.bookings()];
    const term = this.searchTerm().trim().toLowerCase();
    const paymentFilter = this.filterPaymentStatus();
    const startDate = this.startDateFilter();
    const endDate = this.endDateFilter();
    const dateRangeError = this.dateRangeError();

    let result = raw;
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

    if (this.tagFilter().length > 0) {
      const selectedTags = this.tagFilter();
      result = result.filter((booking) =>
        selectedTags.every((tag) => booking.customerTags?.includes(tag))
      );
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

    return result;
  });

  readonly onHoldCount = computed(
    () =>
      this.bookingsAfterNonStatusFilters().filter((booking) =>
        this.isOnHoldBooking(booking)
      ).length
  );
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
    if (!start || !end) {
      return null;
    }
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
  readonly selectedMarkPaidBookings = computed(() => {
    const selected = this.selectedBookingIds();
    return this.bookings().filter(
      (booking) => selected.has(booking.id) && this.isBulkMarkPayable(booking)
    );
  });
  readonly selectedMarkPaidCount = computed(
    () => this.selectedMarkPaidBookings().length
  );
  readonly allPageSelected = computed(() => {
    const pageBookings = this.pagedBookings().filter((booking) =>
      this.isCancellable(booking)
    );
    if (pageBookings.length === 0) {
      return false;
    }
    const selected = this.selectedBookingIds();
    return pageBookings.every((booking) => selected.has(booking.id));
  });

  protected searchDebounceId: number | null = null;
  protected toastTimer: number | null = null;
  protected hasFacilitySelectionInitialized = false;

  protected getFacilityFilter(): string | null {
    const facilityId = this.facilityContext.selectedFacilityId()?.trim() ?? '';
    return facilityId.length > 0 ? facilityId : null;
  }

  protected isStatusFilter(value: string): value is BookingStatusFilter {
    return (
      value === 'ALL' || value === 'ON_HOLD' || this.isBookingStatus(value)
    );
  }

  protected isBookingStatus(value: string): value is BookingStatus {
    return (Object.values(BookingStatus) as string[]).includes(value);
  }

  protected isPaymentStatus(value: string): value is PaymentStatus {
    return (Object.values(PaymentStatus) as string[]).includes(value);
  }

  protected isOnHoldBooking(booking: BookingListItemDto): boolean {
    return (
      booking.status === BookingStatus.PENDING &&
      booking.holdUntil !== null &&
      typeof booking.holdUntil !== 'undefined'
    );
  }

  protected getSortValue(
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

  protected abstract t(
    key: string,
    fallback: string,
    params?: Record<string, string | number>
  ): string;
  abstract bookingPrice(booking: BookingListItemDto): {
    amount: number;
    currency: string;
  };
  abstract isCancellable(booking: BookingListItemDto): boolean;
  abstract isBulkMarkPayable(booking: BookingListItemDto): boolean;
  abstract statusTone(status: string): BookingStatusTone;
}
