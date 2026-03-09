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
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import {
  BookingCancellationScope,
  BookingListItemDto,
  UserRole,
  parseCancellationReason,
} from '@khana/shared-dtos';
import { BookingStore } from '../../../state/bookings/booking.store';
import { FacilityContextStore } from '../../../shared/state';
import { AuthStore } from '../../../shared/state/auth.store';
import { LanguageService } from '../../../shared/services/language.service';
import { LocaleFormatService } from '../../../shared/services/locale-format.service';
import {
  formatDateForInput,
  getDayKey,
  getTodayDate,
  getWeekDays,
} from './booking-calendar.date';
import {
  buildBookingSegments,
  buildBookingsMap,
  buildLayoutMetrics,
} from './booking-calendar.layout';
import {
  ActionDialogState,
  BookingCardPresentation,
  BookingCardTypographyMetrics,
  BookingLayout,
  BookingSegment,
  DEFAULT_BOOKING_LAYOUT,
  DialogCopy,
  ERROR_DESCRIPTION_ID,
  ErrorCategory,
  ErrorRecoveryOption,
  LayoutMetrics,
  SlotFocus,
  ToastNotice,
  AUTO_RETRY_MAX_ATTEMPTS,
} from './booking-calendar.models';
import {
  buildBookingPresentation,
  readRootCssVarPx,
} from './booking-calendar.presentation';

@Directive()
export abstract class BookingCalendarRouteStateBase {
  readonly store = inject(BookingStore);
  protected readonly facilityContext = inject(FacilityContextStore);
  protected readonly authStore = inject(AuthStore);
  protected readonly languageService = inject(LanguageService, {
    optional: true,
  });
  protected readonly destroyRef = inject(DestroyRef);
  protected readonly localeFormat = inject(LocaleFormatService);
  protected readonly router = inject(Router);
  protected readonly translateService = inject(TranslateService, {
    optional: true,
  });

  protected abstract getDialogCopy(
    type: 'confirm' | 'pay' | 'cancel'
  ): DialogCopy;
  protected abstract getErrorRecoveryOptions(
    category: ErrorCategory
  ): ErrorRecoveryOption[];
  protected abstract getErrorCategoryLabel(category: ErrorCategory): string;
  protected abstract dayName(day: Date): string;
  protected abstract formatDayNumber(day: Date): string;
  protected abstract now(): number;

  readonly currentUser = this.authStore.user;
  readonly currentUserRole = computed(() => this.currentUser()?.role ?? null);

  readonly bookings = this.store.bookings;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly errorCode = this.store.errorCode;

  readonly currentDate = signal<Date>(new Date());
  readonly selectedBooking = signal<BookingListItemDto | null>(null);
  readonly selectedBookingId = signal<string | null>(null);
  readonly actionInProgress = signal<boolean>(false);
  readonly toast = signal<ToastNotice | null>(null);
  readonly actionDialog = signal<ActionDialogState | null>(null);
  readonly cancelReason = signal<string>('');
  readonly cancelScope = signal<BookingCancellationScope>(
    BookingCancellationScope.SINGLE
  );
  readonly lastSuccessfulBookings = signal<BookingListItemDto[]>([]);
  readonly lastSuccessfulAt = signal<number | null>(null);
  readonly retryAttempt = signal<number>(0);
  readonly retryScheduledAt = signal<number | null>(null);
  readonly navigationLocked = signal<boolean>(false);
  readonly focusedSlot = signal<SlotFocus>({ dayIndex: 0, hourIndex: 0 });
  readonly selectedDay = signal<Date>(new Date());
  readonly errorDescriptionId = ERROR_DESCRIPTION_ID;

  @ViewChildren('slotCell') slotCells?: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('gridBookingCard')
  gridBookingCards?: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('timelineCard')
  timelineCards?: QueryList<ElementRef<HTMLElement>>;

  protected lastFocusedElement: HTMLElement | null = null;
  protected toastTimer: number | null = null;
  protected navigationTimer: number | null = null;
  protected retryTimer: number | null = null;
  protected panelCloseTimer: number | null = null;
  protected lastLoadedFacilityId: string | null | undefined = undefined;
  protected resizeObserver: ResizeObserver | null = null;

  readonly slotBlockSizePx = signal(0);
  readonly calendarCellInlineSizePx = signal(0);
  readonly timelineCardBlockSizePx = signal(0);
  readonly timelineCardInlineSizePx = signal(0);

  protected readonly gridTypographyMetrics =
    signal<BookingCardTypographyMetrics | null>(null);
  protected readonly timelineTypographyMetrics =
    signal<BookingCardTypographyMetrics | null>(null);
  protected readonly defaultLayout: BookingLayout = DEFAULT_BOOKING_LAYOUT;

  readonly hours: string[] = Array.from(
    { length: 24 },
    (_, i) => `${i.toString().padStart(2, '0')}:00`
  );

  readonly selectedBookingLive = computed(() => {
    const fallbackSelected = this.selectedBooking();
    const selectedId = this.selectedBookingId() ?? fallbackSelected?.id ?? null;
    if (!selectedId) {
      return null;
    }

    const detail = this.store.getBookingDetail(selectedId);
    const live = this.bookings().find((booking) => booking.id === selectedId);
    if (!detail && !live) {
      return fallbackSelected;
    }
    if (!detail) {
      return live ?? null;
    }
    if (!live) {
      return detail;
    }

    return {
      ...detail,
      ...live,
      facility: live.facility ?? detail.facility,
    };
  });

  readonly selectedBookingLoading = computed(() => {
    const selectedId = this.selectedBookingId();
    if (!selectedId) {
      return false;
    }

    return Boolean(this.store.detailLoadingById()[selectedId]);
  });

  readonly selectedBookingError = computed(() => {
    const selectedId = this.selectedBookingId();
    if (!selectedId) {
      return null;
    }

    return this.store.detailErrorsById()[selectedId] ?? null;
  });

  readonly dialogCopy = computed<DialogCopy | null>(() => {
    const dialog = this.actionDialog();
    if (!dialog) {
      return null;
    }

    return this.getDialogCopy(dialog.type);
  });

  readonly cancelReasonValid = computed(() => {
    return parseCancellationReason(this.cancelReason()).isValid;
  });

  readonly errorCategory = computed<ErrorCategory | null>(() => {
    const errorCode = this.errorCode();
    if (!errorCode) {
      return null;
    }

    switch (errorCode) {
      case 'NETWORK':
        return 'network';
      case 'SERVER_ERROR':
        return 'server';
      case 'VALIDATION':
      case 'CONFLICT':
      case 'FORBIDDEN':
      case 'UNAUTHORIZED':
      case 'NOT_FOUND':
        return 'validation';
      case 'UNKNOWN':
      default:
        return 'unknown';
    }
  });

  readonly errorRecoveryOptions = computed<ErrorRecoveryOption[]>(() => {
    const category = this.errorCategory();
    if (!category) {
      return this.error() ? this.getErrorRecoveryOptions('unknown') : [];
    }

    return this.getErrorRecoveryOptions(category);
  });

  readonly errorCategoryLabel = computed(() => {
    const category = this.errorCategory();
    if (category) {
      return this.getErrorCategoryLabel(category);
    }

    return this.error() ? this.getErrorCategoryLabel('unknown') : '';
  });

  readonly autoRetryEligible = computed(() => {
    const category = this.errorCategory();
    if (category !== 'network' && category !== 'server') {
      return false;
    }

    return this.retryAttempt() < AUTO_RETRY_MAX_ATTEMPTS;
  });

  readonly canNavigate = computed(
    () => !this.loading() && !this.navigationLocked()
  );
  readonly jumpDateValue = computed(() =>
    formatDateForInput(this.currentDate())
  );
  readonly dialogAvailable = computed(
    () => this.actionDialog() === null && !this.actionInProgress()
  );
  readonly canCancel = computed(() => {
    const role = this.currentUserRole();
    return role === UserRole.OWNER || role === UserRole.MANAGER;
  });
  readonly canConfirm = computed(() => {
    const role = this.currentUserRole();
    return role === UserRole.OWNER || role === UserRole.MANAGER;
  });
  readonly canMarkPaid = computed(() => {
    const role = this.currentUserRole();
    return role === UserRole.OWNER || role === UserRole.MANAGER;
  });
  readonly cancellationScopes = BookingCancellationScope;
  readonly showRecurringCancellationScope = computed(() => {
    const booking = this.selectedBookingLive();
    return Boolean(booking?.recurrenceGroupId);
  });

  readonly displayBookings = computed(() => {
    const current = this.bookings();
    if (this.error() && current.length === 0) {
      return this.lastSuccessfulBookings();
    }

    return current;
  });

  readonly showGrid = computed(() => {
    return !this.loading() && this.displayBookings().length > 0;
  });

  readonly showEmptyState = computed(() => {
    return (
      !this.loading() && !this.error() && this.displayBookings().length === 0
    );
  });

  readonly showContent = computed(() => {
    return (
      !this.loading() && (this.displayBookings().length > 0 || !this.error())
    );
  });

  readonly selectedDayBookings = computed<BookingSegment[]>(() => {
    const day = this.selectedDay();
    const dayKey = getDayKey(day);
    return this.bookingSegments()
      .filter((segment) => segment.dayKey === dayKey)
      .sort((a, b) => a.startMs - b.startMs);
  });

  readonly selectedDayLabel = computed(() => {
    const day = this.selectedDay();
    return `${this.dayName(day)} ${this.formatDayNumber(day)}`;
  });

  readonly weekDays = computed(() => {
    return getWeekDays(this.currentDate());
  });

  readonly today = computed(() => getTodayDate());

  readonly weekRange = computed(() => {
    const days = this.weekDays();
    const start = days[0];
    const end = days[6];
    const startLabel = this.localeFormat.formatDate(start, {
      month: 'short',
      day: 'numeric',
    });
    const endLabel = this.localeFormat.formatDate(end, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return `${startLabel} - ${endLabel}`;
  });

  readonly bookingSegments = computed<BookingSegment[]>(() => {
    return buildBookingSegments(this.displayBookings());
  });

  readonly bookingsMap = computed(() => {
    return buildBookingsMap(this.bookingSegments());
  });

  readonly layoutMetrics = computed<LayoutMetrics>(() => {
    return buildLayoutMetrics(this.bookingSegments(), () => this.now());
  });

  readonly bookingLayout = computed(() => this.layoutMetrics().layout);
  readonly layoutDurationMs = computed(() => this.layoutMetrics().durationMs);

  readonly gridCardPresentations = computed(() => {
    const layoutMap = this.bookingLayout();
    const slotBlockSizePx = this.slotBlockSizePx();
    const cellInlineSizePx = this.calendarCellInlineSizePx();
    const verticalGapPx = readRootCssVarPx('--space-1');
    const typography = this.gridTypographyMetrics();
    const map = new Map<string, BookingCardPresentation>();

    for (const segment of this.bookingSegments()) {
      const layout = layoutMap.get(segment.id) ?? this.defaultLayout;
      const hours = segment.durationMs / (1000 * 60 * 60);
      const availableBlockPx = Math.max(
        0,
        slotBlockSizePx * hours - verticalGapPx
      );
      const availableInlinePx =
        layout.columns > 0 ? cellInlineSizePx / layout.columns : 0;

      map.set(
        segment.id,
        buildBookingPresentation({
          availableBlockPx,
          availableInlinePx,
          hasOverlap: layout.columns > 1,
          hasTags: Boolean(segment.booking.customerTags?.length),
          typography,
        })
      );
    }

    return map;
  });

  readonly timelineCardPresentations = computed(() => {
    const layoutMap = this.bookingLayout();
    const availableBlockPx = this.timelineCardBlockSizePx();
    const availableInlinePx = this.timelineCardInlineSizePx();
    const typography = this.timelineTypographyMetrics();
    const map = new Map<string, BookingCardPresentation>();

    for (const segment of this.selectedDayBookings()) {
      const layout = layoutMap.get(segment.id) ?? this.defaultLayout;
      map.set(
        segment.id,
        buildBookingPresentation({
          availableBlockPx,
          availableInlinePx,
          hasOverlap: layout.columns > 1,
          hasTags: Boolean(segment.booking.customerTags?.length),
          typography,
        })
      );
    }

    return map;
  });
}
