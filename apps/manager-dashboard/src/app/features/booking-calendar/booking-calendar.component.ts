import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  OnDestroy,
  QueryList,
  ViewChild,
  ViewChildren,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { BookingStore } from '../../state/bookings/booking.store';
import { FacilityContextStore } from '../../shared/state';
import { AuthStore } from '../../shared/state/auth.store';
import { LanguageService } from '../../shared/services/language.service';
import { LocaleFormatService } from '../../shared/services/locale-format.service';
import {
  BookingCancellationScope,
  BookingListItemDto,
  BookingStatus,
  PaymentStatus,
  UserRole,
  parseCancellationReason,
} from '@khana/shared-dtos';
import { HoldTimerComponent } from './hold-timer.component';
import { ConfirmationDialogComponent } from '../../shared/components/confirmation-dialog.component';
import { CancellationFormComponent } from '../../shared/components/cancellation-form.component';
import {
  resolveTagColorClass,
  TagChipComponent,
  UiStatusBadgeComponent,
  UiToastComponent,
} from '../../shared/components';

type ToastNotice = { message: string; tone: 'success' | 'error' };

type ActionDialogType = 'confirm' | 'cancel' | 'pay';
type ActionDialogState = { type: ActionDialogType; bookingId: string };
type DialogCopy = {
  title: string;
  message: string;
  confirmLabel: string;
  confirmTone: 'primary' | 'secondary' | 'danger';
};

type BookingErrorCode =
  | 'NETWORK'
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

type ErrorCategory =
  | 'network'
  | 'server'
  | 'validation'
  | 'conflict'
  | 'auth'
  | 'not_found'
  | 'unknown';

type ErrorRecoveryAction = 'retry' | 'refresh' | 'dismiss';
type ErrorRecoveryOption = {
  action: ErrorRecoveryAction;
  label: string;
  description: string;
};

type BookingLayout = { column: number; columns: number };
type BookingLayoutMap = Map<string, BookingLayout>;
type LayoutMetrics = { layout: BookingLayoutMap; durationMs: number };
type BookingCardDensity = 'compact' | 'standard' | 'expanded';
type BookingCardPresentation = {
  density: BookingCardDensity;
  showTagChip: boolean;
  showTagDot: boolean;
  showFacility: boolean;
};
type BookingCardTypographyMetrics = {
  paddingBlockPx: number;
  rowGapPx: number;
  nameLineHeightPx: number;
  metaLineHeightPx: number;
};
type BookingPresentationMetrics = {
  availableBlockPx: number;
  availableInlinePx: number;
  hasOverlap: boolean;
  hasTags: boolean;
  typography: BookingCardTypographyMetrics | null;
};

type BookingCardStyle = {
  top: string;
  height: string;
  width: string;
  left: string;
  zIndex: string;
};

type BookingSegment = {
  id: string;
  booking: BookingListItemDto;
  startMs: number;
  endMs: number;
  startHour: number;
  startMinutes: number;
  durationMs: number;
  dayKey: string;
};

type SlotFocus = { dayIndex: number; hourIndex: number };

const AUTO_RETRY_MAX_ATTEMPTS = 3;
const AUTO_RETRY_BASE_DELAY_MS = 800;
const AUTO_RETRY_MAX_DELAY_MS = 8000;
const NAVIGATION_THROTTLE_MS = 200;
const ERROR_DESCRIPTION_ID = 'calendar-error';
const DAYS_IN_WEEK = 7;

const ERROR_CATEGORY_BY_CODE: Record<BookingErrorCode, ErrorCategory> = {
  NETWORK: 'network',
  SERVER_ERROR: 'server',
  VALIDATION: 'validation',
  CONFLICT: 'conflict',
  UNAUTHORIZED: 'auth',
  FORBIDDEN: 'auth',
  NOT_FOUND: 'not_found',
  UNKNOWN: 'unknown',
};

/**
 * Weekly Calendar View Component
 *
 * Displays bookings in a 7-day grid view with hourly time slots.
 * Optimized with O(1) lookups and precise positioning.
 */
@Component({
  selector: 'app-booking-calendar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HoldTimerComponent,
    ConfirmationDialogComponent,
    CancellationFormComponent,
    TagChipComponent,
    UiStatusBadgeComponent,
    UiToastComponent,
  ],
  templateUrl: './booking-calendar.component.html',
  styleUrl: './booking-calendar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingCalendarComponent
  implements OnInit, AfterViewInit, OnDestroy
{
  readonly store = inject(BookingStore);
  private readonly facilityContext = inject(FacilityContextStore);
  private readonly authStore = inject(AuthStore);
  private readonly languageService = inject(LanguageService, {
    optional: true,
  });
  private readonly destroyRef = inject(DestroyRef);
  private readonly localeFormat = inject(LocaleFormatService);
  private readonly translateService = inject(TranslateService, {
    optional: true,
  });
  readonly BookingStatus = BookingStatus;
  readonly PaymentStatus = PaymentStatus;
  readonly currentUser = this.authStore.user;
  readonly currentUserRole = computed(() => this.currentUser()?.role ?? null);

  // State from store
  readonly bookings = this.store.bookings;
  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly errorCode = this.store.errorCode;

  // Local signals
  readonly currentDate = signal<Date>(new Date());
  readonly selectedBooking = signal<BookingListItemDto | null>(null);
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

  @ViewChild('actionPanel') actionPanel?: ElementRef<HTMLElement>;
  @ViewChild('closeButton') closeButton?: ElementRef<HTMLButtonElement>;
  @ViewChildren('slotCell') slotCells?: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('gridBookingCard')
  gridBookingCards?: QueryList<ElementRef<HTMLElement>>;
  @ViewChildren('timelineCard')
  timelineCards?: QueryList<ElementRef<HTMLElement>>;

  private lastFocusedElement: HTMLElement | null = null;
  private toastTimer: number | null = null;
  private navigationTimer: number | null = null;
  private retryTimer: number | null = null;
  private focusTimer: number | null = null;
  private panelCloseTimer: number | null = null;
  private lastLoadedFacilityId: string | null | undefined = undefined;
  private resizeObserver: ResizeObserver | null = null;

  readonly slotBlockSizePx = signal(0);
  readonly calendarCellInlineSizePx = signal(0);
  readonly timelineCardBlockSizePx = signal(0);
  readonly timelineCardInlineSizePx = signal(0);

  private readonly gridTypographyMetrics =
    signal<BookingCardTypographyMetrics | null>(null);
  private readonly timelineTypographyMetrics =
    signal<BookingCardTypographyMetrics | null>(null);

  // Operating hours (00:00 - 23:00)
  readonly hours: string[] = Array.from(
    { length: 24 },
    (_, i) => `${i.toString().padStart(2, '0')}:00`
  );

  readonly selectedBookingLive = computed(() => {
    const selected = this.selectedBooking();
    if (!selected) return null;
    const live = this.bookings().find((b) => b.id === selected.id);
    if (!live) return selected;
    return {
      ...selected,
      ...live,
      facility: live.facility ?? selected.facility,
    };
  });

  readonly dialogCopy = computed<DialogCopy | null>(() => {
    const dialog = this.actionDialog();
    if (!dialog) return null;
    return this.getDialogCopy(dialog.type);
  });

  readonly cancelReasonValid = computed(() => {
    return parseCancellationReason(this.cancelReason()).isValid;
  });

  readonly errorCategory = computed<ErrorCategory | null>(() => {
    const code = this.errorCode();
    if (!code) return null;
    const normalized = code.toUpperCase() as BookingErrorCode;
    return ERROR_CATEGORY_BY_CODE[normalized] ?? 'unknown';
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
    if (category) return this.getErrorCategoryLabel(category);
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
    this.formatDateForInput(this.currentDate())
  );
  readonly dialogAvailable = computed(
    () => this.actionDialog() === null && !this.actionInProgress()
  );
  readonly canCancel = computed(() => {
    const role = this.currentUserRole();
    return (
      role === UserRole.OWNER ||
      role === UserRole.MANAGER ||
      role === UserRole.STAFF
    );
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
    const dayKey = this.getDayKey(day);
    return this.bookingSegments()
      .filter((segment) => segment.dayKey === dayKey)
      .sort((a, b) => a.startMs - b.startMs);
  });

  readonly selectedDayLabel = computed(() => {
    const day = this.selectedDay();
    return `${this.dayName(day)} ${this.formatDayNumber(day)}`;
  });

  private readonly defaultLayout: BookingLayout = { column: 0, columns: 1 };

  // Computed: 7 days of the current week (starting Sunday)
  readonly weekDays = computed(() => {
    const current = this.currentDate();
    const dayOfWeek = current.getDay(); // 0 = Sunday
    const sunday = new Date(current);
    sunday.setDate(current.getDate() - dayOfWeek);
    sunday.setHours(0, 0, 0, 0);

    const days: Date[] = [];
    for (let i = 0; i < DAYS_IN_WEEK; i++) {
      const day = new Date(sunday);
      day.setDate(sunday.getDate() + i);
      days.push(day);
    }
    return days;
  });

  // Computed: Check if a day is today
  readonly today = computed(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });

  // Computed: Week range for header display
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

  /**
   * Optimized Booking Index (O(N) -> O(1) Lookup)
   * Map Key: "YYYY-M-D-H" (e.g., "2023-10-27-14")
   */
  readonly bookingSegments = computed<BookingSegment[]>(() => {
    return this.buildBookingSegments(this.displayBookings());
  });

  readonly bookingsMap = computed(() => {
    const map = new Map<string, BookingSegment[]>();
    for (const segment of this.bookingSegments()) {
      const key = `${segment.dayKey}-${segment.startHour}`;
      const slotSegments = map.get(key);
      if (slotSegments) {
        slotSegments.push(segment);
      } else {
        map.set(key, [segment]);
      }
    }
    return map;
  });

  readonly layoutMetrics = computed<LayoutMetrics>(() => {
    const start = this.now();
    const layout: BookingLayoutMap = new Map();
    const bookingsByDay = new Map<string, BookingSegment[]>();

    for (const segment of this.bookingSegments()) {
      const list = bookingsByDay.get(segment.dayKey);
      if (list) {
        list.push(segment);
      } else {
        bookingsByDay.set(segment.dayKey, [segment]);
      }
    }

    for (const dayBookings of bookingsByDay.values()) {
      const sorted = [...dayBookings].sort((a, b) => a.startMs - b.startMs);

      let cluster: BookingSegment[] = [];
      let clusterEnd = 0;

      for (const segment of sorted) {
        if (cluster.length === 0 || segment.startMs < clusterEnd) {
          cluster.push(segment);
          clusterEnd = Math.max(clusterEnd, segment.endMs);
        } else {
          this.assignClusterLayout(cluster, layout);
          cluster = [segment];
          clusterEnd = segment.endMs;
        }
      }

      if (cluster.length > 0) {
        this.assignClusterLayout(cluster, layout);
      }
    }

    return { layout, durationMs: this.now() - start };
  });

  readonly bookingLayout = computed(() => this.layoutMetrics().layout);
  readonly layoutDurationMs = computed(() => this.layoutMetrics().durationMs);

  readonly gridCardPresentations = computed(() => {
    const layoutMap = this.bookingLayout();
    const slotBlockSizePx = this.slotBlockSizePx();
    const cellInlineSizePx = this.calendarCellInlineSizePx();
    const verticalGapPx = this.readRootCssVarPx('--space-1');
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
        this.buildBookingPresentation({
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
        this.buildBookingPresentation({
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

  constructor() {
    effect(() => {
      if (!this.facilityContext.initialized()) return;
      const selectedFacilityId = this.facilityContext.selectedFacilityId();
      if (selectedFacilityId === this.lastLoadedFacilityId) return;
      this.loadBookings(true);
    });
    this.registerEffects();
  }

  ngOnInit(): void {
    this.facilityContext.initialize();
    this.setInitialSlotFocus();
    this.loadBookings(true);
  }

  ngAfterViewInit(): void {
    this.setupResizeObserver();

    this.slotCells?.changes
      ?.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.observeMeasurementTargets());
    this.gridBookingCards?.changes
      ?.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.observeMeasurementTargets());
    this.timelineCards?.changes
      ?.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.observeMeasurementTargets());

    queueMicrotask(() => this.observeMeasurementTargets());
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.clearTimers();
  }

  /**
   * Open the action panel for a booking.
   * @param booking Booking to display.
   * @param event Optional event used to restore focus.
   */
  openBooking(booking: BookingListItemDto, event?: Event): void {
    if (this.actionDialog()) {
      this.closeDialog();
    }
    this.actionInProgress.set(false);
    this.cancelReason.set('');
    this.lastFocusedElement =
      (event?.currentTarget as HTMLElement) ??
      (document.activeElement as HTMLElement);
    this.selectedBooking.set(booking);

    if (this.focusTimer) {
      window.clearTimeout(this.focusTimer);
    }
    this.focusTimer = window.setTimeout(() => {
      if (this.closeButton?.nativeElement) {
        this.closeButton.nativeElement.focus();
      } else {
        this.actionPanel?.nativeElement?.focus();
      }
      this.focusTimer = null;
    }, 0);
  }

  /**
   * Close the action panel and restore focus.
   */
  closePanel(): void {
    this.selectedBooking.set(null);
    this.actionInProgress.set(false);
    this.actionDialog.set(null);
    this.cancelReason.set('');
    if (this.lastFocusedElement) {
      this.lastFocusedElement.focus();
      this.lastFocusedElement = null;
    }
  }

  /**
   * Trap focus inside the panel and support ESC close.
   * @param event Keyboard event for focus management.
   */
  onPanelKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.closePanel();
      return;
    }

    if (event.key !== 'Tab') return;

    const panel = this.actionPanel?.nativeElement;
    if (!panel) return;
    const focusable = this.getFocusableElements(panel);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement as HTMLElement | null;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /**
   * Track focused slot for keyboard navigation.
   * @param dayIndex Day index in the week view.
   * @param hourIndex Hour index in the day.
   */
  onSlotFocus(dayIndex: number, hourIndex: number): void {
    this.focusedSlot.set({ dayIndex, hourIndex });
  }

  /**
   * Provide tabindex for the current slot focus target.
   * @param dayIndex Day index in the week view.
   * @param hourIndex Hour index in the day.
   */
  slotTabIndex(dayIndex: number, hourIndex: number): number {
    const focused = this.focusedSlot();
    if (!focused) return dayIndex === 0 && hourIndex === 0 ? 0 : -1;
    return focused.dayIndex === dayIndex && focused.hourIndex === hourIndex
      ? 0
      : -1;
  }

  /**
   * Handle keyboard navigation within the calendar grid.
   * @param event Keyboard event to interpret.
   * @param dayIndex Day index in the week view.
   * @param hourIndex Hour index in the day.
   * @param slotBookings Bookings for the active slot.
   */
  onSlotKeydown(
    event: KeyboardEvent,
    dayIndex: number,
    hourIndex: number,
    slotBookings: BookingSegment[]
  ): void {
    if (event.key === 'Enter' || event.key === ' ') {
      if (slotBookings.length > 0) {
        event.preventDefault();
        this.openBooking(slotBookings[0].booking, event);
      }
      return;
    }

    let nextDay = dayIndex;
    let nextHour = hourIndex;

    switch (event.key) {
      case 'ArrowRight':
        nextDay = Math.min(this.weekDays().length - 1, dayIndex + 1);
        break;
      case 'ArrowLeft':
        nextDay = Math.max(0, dayIndex - 1);
        break;
      case 'ArrowDown':
        nextHour = Math.min(this.hours.length - 1, hourIndex + 1);
        break;
      case 'ArrowUp':
        nextHour = Math.max(0, hourIndex - 1);
        break;
      default:
        return;
    }

    if (nextDay === dayIndex && nextHour === hourIndex) return;
    event.preventDefault();
    this.focusSlot(nextDay, nextHour);
  }

  /**
   * Retry loading bookings and reset retry state.
   */
  retryLoad(): void {
    this.loadBookings(true);
  }

  /**
   * Handle error recovery action selection.
   * @param action Recovery action chosen by the user.
   */
  handleErrorRecovery(action: ErrorRecoveryAction): void {
    switch (action) {
      case 'retry':
      case 'refresh':
        this.loadBookings(true);
        break;
      case 'dismiss':
        this.store.clearError();
        break;
      default:
        break;
    }
  }

  /**
   * Confirm the selected booking.
   */
  async confirmBooking(): Promise<void> {
    if (!this.canConfirm()) return;
    await this.runAction(async () => {
      const booking = this.selectedBookingLive();
      if (!booking) return false;
      return await this.store.confirmBooking(booking.id);
    }, this.getActionSuccessMessage('confirm'));
  }

  /**
   * Mark the selected booking as paid.
   */
  async markPaid(): Promise<void> {
    if (!this.canMarkPaid()) return;
    await this.runAction(async () => {
      const booking = this.selectedBookingLive();
      if (!booking) return false;
      return await this.store.markBookingPaid(booking.id);
    }, this.getActionSuccessMessage('pay'));
  }

  /**
   * Cancel the selected booking with a reason.
   */
  async cancelBooking(): Promise<void> {
    if (!this.canCancel()) return;
    await this.runAction(async () => {
      const booking = this.selectedBookingLive();
      if (!booking) return false;
      return await this.store.cancelBookingWithScope(
        booking.id,
        this.cancelReason().trim(),
        this.cancelScope()
      );
    }, this.getActionSuccessMessage('cancel'));
  }

  /**
   * Open the confirm dialog for the selected booking.
   */
  openConfirmDialog(): void {
    if (!this.canConfirm()) return;
    if (!this.dialogAvailable()) return;
    const booking = this.selectedBookingLive();
    if (!booking) return;
    this.actionDialog.set({ type: 'confirm', bookingId: booking.id });
  }

  /**
   * Open the mark-paid dialog for the selected booking.
   */
  openPayDialog(): void {
    if (!this.canMarkPaid()) return;
    if (!this.dialogAvailable()) return;
    const booking = this.selectedBookingLive();
    if (!booking) return;
    this.actionDialog.set({ type: 'pay', bookingId: booking.id });
  }

  /**
   * Open the cancel dialog and reset the reason input.
   */
  openCancelDialog(): void {
    if (!this.canCancel()) return;
    if (!this.dialogAvailable()) return;
    const booking = this.selectedBookingLive();
    if (!booking) return;
    this.cancelReason.set('');
    this.cancelScope.set(BookingCancellationScope.SINGLE);
    this.actionDialog.set({ type: 'cancel', bookingId: booking.id });
  }

  /**
   * Close the active dialog and reset dialog state.
   */
  closeDialog(): void {
    this.actionDialog.set(null);
    this.cancelReason.set('');
    this.cancelScope.set(BookingCancellationScope.SINGLE);
  }

  /**
   * Submit the action configured by the dialog.
   */
  async submitDialogAction(): Promise<void> {
    const dialog = this.actionDialog();
    if (!dialog) return;

    if (dialog.type === 'confirm' && !this.canConfirm()) return;
    if (dialog.type === 'pay' && !this.canMarkPaid()) return;
    if (dialog.type === 'cancel' && !this.canCancel()) return;

    if (dialog.type === 'cancel' && !this.cancelReasonValid()) {
      return;
    }

    const booking = this.selectedBookingLive();
    if (!booking) return;

    const action = async (): Promise<boolean> => {
      switch (dialog.type) {
        case 'confirm':
          return await this.store.confirmBooking(booking.id);
        case 'pay':
          return await this.store.markBookingPaid(booking.id);
        case 'cancel':
          return await this.store.cancelBookingWithScope(
            booking.id,
            this.cancelReason().trim(),
            this.cancelScope()
          );
        default:
          return false;
      }
    };

    await this.runAction(
      action,
      this.getActionSuccessMessage(dialog.type),
      () => {
        this.closeDialog();
      }
    );
  }

  private getDialogCopy(type: ActionDialogType): DialogCopy {
    switch (type) {
      case 'confirm':
        return {
          title: this.t(
            'BOOKING_CALENDAR.DIALOG.CONFIRM_TITLE',
            'Confirm booking'
          ),
          message: this.t(
            'BOOKING_CALENDAR.DIALOG.CONFIRM_MESSAGE',
            'This will confirm the booking and notify the customer.'
          ),
          confirmLabel: this.t(
            'BOOKING_CALENDAR.DIALOG.CONFIRM_LABEL',
            'Confirm booking'
          ),
          confirmTone: 'primary',
        };
      case 'pay':
        return {
          title: this.t('BOOKING_CALENDAR.DIALOG.PAY_TITLE', 'Mark as paid'),
          message: this.t(
            'BOOKING_CALENDAR.DIALOG.PAY_MESSAGE',
            'This will mark the booking as paid.'
          ),
          confirmLabel: this.t(
            'BOOKING_CALENDAR.DIALOG.PAY_LABEL',
            'Mark paid'
          ),
          confirmTone: 'secondary',
        };
      case 'cancel':
      default:
        return {
          title: this.t(
            'BOOKING_CALENDAR.DIALOG.CANCEL_TITLE',
            'Cancel booking'
          ),
          message: this.t(
            'BOOKING_CALENDAR.DIALOG.CANCEL_MESSAGE',
            'This action is permanent and cannot be undone.'
          ),
          confirmLabel: this.t(
            'BOOKING_CALENDAR.DIALOG.CANCEL_LABEL',
            'Cancel booking'
          ),
          confirmTone: 'danger',
        };
    }
  }

  private getActionSuccessMessage(type: ActionDialogType): string {
    switch (type) {
      case 'confirm':
        return this.t(
          'BOOKING_CALENDAR.TOAST.BOOKING_CONFIRMED',
          'Booking confirmed'
        );
      case 'pay':
        return this.t(
          'BOOKING_CALENDAR.TOAST.PAYMENT_MARKED_PAID',
          'Payment marked as paid'
        );
      case 'cancel':
      default:
        return this.t(
          'BOOKING_CALENDAR.TOAST.BOOKING_CANCELLED',
          'Booking cancelled'
        );
    }
  }

  private getErrorRecoveryOptions(
    category: ErrorCategory
  ): ErrorRecoveryOption[] {
    switch (category) {
      case 'network':
        return [
          {
            action: 'retry',
            label: this.t(
              'BOOKING_CALENDAR.ERROR_RECOVERY.RETRY_NOW',
              'Retry now'
            ),
            description: this.t(
              'BOOKING_CALENDAR.ERROR_RECOVERY.NETWORK_RETRY_DESCRIPTION',
              'Reconnect and try loading bookings again.'
            ),
          },
          {
            action: 'dismiss',
            label: this.t('BOOKING_CALENDAR.ERROR_RECOVERY.DISMISS', 'Dismiss'),
            description: this.t(
              'BOOKING_CALENDAR.ERROR_RECOVERY.KEEP_LAST_DATA',
              'Keep the last loaded calendar data.'
            ),
          },
        ];
      case 'server':
        return [
          {
            action: 'retry',
            label: this.t(
              'BOOKING_CALENDAR.ERROR_RECOVERY.RETRY_NOW',
              'Retry now'
            ),
            description: this.t(
              'BOOKING_CALENDAR.ERROR_RECOVERY.SERVER_RETRY_DESCRIPTION',
              'Attempt to reload when the server responds.'
            ),
          },
          {
            action: 'refresh',
            label: this.t(
              'BOOKING_CALENDAR.ERROR_RECOVERY.REFRESH_DATA',
              'Refresh data'
            ),
            description: this.t(
              'BOOKING_CALENDAR.ERROR_RECOVERY.SERVER_REFRESH_DESCRIPTION',
              'Fetch the latest bookings once available.'
            ),
          },
        ];
      case 'validation':
        return [
          {
            action: 'dismiss',
            label: this.t('BOOKING_CALENDAR.ERROR_RECOVERY.DISMISS', 'Dismiss'),
            description: this.t(
              'BOOKING_CALENDAR.ERROR_RECOVERY.VALIDATION_DISMISS_DESCRIPTION',
              'Review the inputs and try again.'
            ),
          },
        ];
      case 'conflict':
        return [
          {
            action: 'refresh',
            label: this.t(
              'BOOKING_CALENDAR.ERROR_RECOVERY.REFRESH_BOOKINGS',
              'Refresh bookings'
            ),
            description: this.t(
              'BOOKING_CALENDAR.ERROR_RECOVERY.CONFLICT_REFRESH_DESCRIPTION',
              'Reload to resolve conflicting updates.'
            ),
          },
          {
            action: 'dismiss',
            label: this.t('BOOKING_CALENDAR.ERROR_RECOVERY.DISMISS', 'Dismiss'),
            description: this.t(
              'BOOKING_CALENDAR.ERROR_RECOVERY.KEEP_LAST_DATA',
              'Keep the last loaded calendar data.'
            ),
          },
        ];
      case 'auth':
        return [
          {
            action: 'refresh',
            label: this.t(
              'BOOKING_CALENDAR.ERROR_RECOVERY.REFRESH_SESSION',
              'Refresh session'
            ),
            description: this.t(
              'BOOKING_CALENDAR.ERROR_RECOVERY.AUTH_REFRESH_DESCRIPTION',
              'Refresh data after signing in again.'
            ),
          },
          {
            action: 'dismiss',
            label: this.t('BOOKING_CALENDAR.ERROR_RECOVERY.DISMISS', 'Dismiss'),
            description: this.t(
              'BOOKING_CALENDAR.ERROR_RECOVERY.AUTH_DISMISS_DESCRIPTION',
              'Return to the last loaded calendar data.'
            ),
          },
        ];
      case 'not_found':
        return [
          {
            action: 'refresh',
            label: this.t(
              'BOOKING_CALENDAR.ERROR_RECOVERY.REFRESH_BOOKINGS',
              'Refresh bookings'
            ),
            description: this.t(
              'BOOKING_CALENDAR.ERROR_RECOVERY.NOT_FOUND_REFRESH_DESCRIPTION',
              'Reload to find an updated booking list.'
            ),
          },
        ];
      case 'unknown':
      default:
        return [
          {
            action: 'retry',
            label: this.t(
              'BOOKING_CALENDAR.ERROR_RECOVERY.RETRY_NOW',
              'Retry now'
            ),
            description: this.t(
              'BOOKING_CALENDAR.ERROR_RECOVERY.UNKNOWN_RETRY_DESCRIPTION',
              'Try loading bookings again.'
            ),
          },
          {
            action: 'dismiss',
            label: this.t('BOOKING_CALENDAR.ERROR_RECOVERY.DISMISS', 'Dismiss'),
            description: this.t(
              'BOOKING_CALENDAR.ERROR_RECOVERY.KEEP_LAST_DATA',
              'Keep the last loaded calendar data.'
            ),
          },
        ];
    }
  }

  private getErrorCategoryLabel(category: ErrorCategory): string {
    switch (category) {
      case 'network':
        return this.t(
          'BOOKING_CALENDAR.ERROR_CATEGORY.NETWORK',
          'Network issue'
        );
      case 'server':
        return this.t('BOOKING_CALENDAR.ERROR_CATEGORY.SERVER', 'Server error');
      case 'validation':
        return this.t(
          'BOOKING_CALENDAR.ERROR_CATEGORY.VALIDATION',
          'Validation issue'
        );
      case 'conflict':
        return this.t(
          'BOOKING_CALENDAR.ERROR_CATEGORY.CONFLICT',
          'Conflict detected'
        );
      case 'auth':
        return this.t(
          'BOOKING_CALENDAR.ERROR_CATEGORY.AUTH',
          'Authorization issue'
        );
      case 'not_found':
        return this.t(
          'BOOKING_CALENDAR.ERROR_CATEGORY.NOT_FOUND',
          'Booking not found'
        );
      case 'unknown':
      default:
        return this.t(
          'BOOKING_CALENDAR.ERROR_CATEGORY.UNKNOWN',
          'Unexpected error'
        );
    }
  }

  private async runAction(
    action: () => Promise<boolean>,
    successMessage: string,
    onSuccess?: () => void
  ): Promise<void> {
    if (this.actionInProgress()) return;
    this.actionInProgress.set(true);

    let success = false;
    try {
      success = await action();
    } catch {
      success = false;
    } finally {
      this.actionInProgress.set(false);
    }

    if (success) {
      if (onSuccess) {
        onSuccess();
      }
      this.showToast(successMessage, 'success');
      if (this.panelCloseTimer) {
        window.clearTimeout(this.panelCloseTimer);
      }
      this.panelCloseTimer = window.setTimeout(() => {
        this.closePanel();
        this.panelCloseTimer = null;
      }, 650);
    } else {
      this.showToast(
        this.t(
          'BOOKING_CALENDAR.ERRORS.ACTION_FAILED',
          'Action failed. Please try again.'
        ),
        'error'
      );
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
    }, 2000);
  }

  text(
    key: string,
    fallback: string,
    params?: Record<string, string | number>
  ): string {
    return this.t(key, fallback, params);
  }

  timelineBookingAriaLabel(
    segment: BookingSegment,
    presentation: BookingCardPresentation
  ): string {
    const booking = segment.booking;
    return this.t(
      'BOOKING_CALENDAR.ARIA.TIMELINE_BOOKING_DETAILED',
      'Booking: {{name}}, {{start}} to {{end}}, {{status}}, {{facility}}{{tagsSuffix}}',
      {
        name: booking.customerName,
        start: this.formatTime(booking.startTime),
        end: this.formatTime(booking.endTime),
        status: this.statusLabel(booking.status),
        facility: booking.facility.name,
        tagsSuffix: this.tagsSuffixForAria(booking, presentation),
      }
    );
  }

  gridBookingAriaLabel(
    segment: BookingSegment,
    presentation: BookingCardPresentation
  ): string {
    const booking = segment.booking;
    return this.t(
      'BOOKING_CALENDAR.ARIA.GRID_BOOKING_DETAILED',
      'Booking: {{name}}, {{status}}, {{facility}}{{tagsSuffix}}',
      {
        name: booking.customerName,
        status: this.statusLabel(booking.status),
        facility: booking.facility.name,
        tagsSuffix: this.tagsSuffixForAria(booking, presentation),
      }
    );
  }

  holdUntilTitle(holdUntil: string | null | undefined): string | null {
    if (!holdUntil) return null;
    return this.t(
      'BOOKING_CALENDAR.ACTION_SHEET.HOLD_UNTIL',
      'Reserved until {{time}}',
      {
        time: this.formatTime(holdUntil),
      }
    );
  }

  private tagsSuffixForAria(
    booking: BookingListItemDto,
    presentation: BookingCardPresentation
  ): string {
    if (presentation.showTagChip) {
      return '';
    }

    const tags = booking.customerTags?.map((tag) => tag.trim()).filter(Boolean);
    if (!tags || tags.length === 0) {
      return '';
    }

    return this.t('BOOKING_CALENDAR.ARIA.TAGS_SUFFIX', ', tags: {{tags}}', {
      tags: tags.join(', '),
    });
  }

  private t(
    key: string,
    fallback: string,
    params?: Record<string, string | number>
  ): string {
    this.languageService?.languageVersion();
    const translated = this.translateService?.instant(key, params);
    if (translated && translated !== key) {
      return translated;
    }
    return this.interpolateFallback(fallback, params);
  }

  private interpolateFallback(
    fallback: string,
    params?: Record<string, string | number>
  ): string {
    if (!params) return fallback;
    return fallback.replace(
      /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g,
      (_match, token: string) => {
        const value = params[token];
        return value === undefined || value === null ? '' : String(value);
      }
    );
  }

  private getFocusableElements(container: HTMLElement): HTMLElement[] {
    const selectors = [
      'button:not([disabled])',
      'a[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ];
    return Array.from(
      container.querySelectorAll<HTMLElement>(selectors.join(','))
    );
  }

  private registerEffects(): void {
    effect(() => {
      const loading = this.loading();
      const error = this.error();
      const bookings = this.bookings();
      if (!loading && !error) {
        this.lastSuccessfulBookings.set(bookings);
        this.lastSuccessfulAt.set(Date.now());
        this.resetRetryState();
      }
    });

    effect(() => {
      const error = this.error();
      const loading = this.loading();
      const autoRetryEligible = this.autoRetryEligible();
      if (!error || loading || !autoRetryEligible) {
        if (!error || !autoRetryEligible) {
          this.clearRetry();
        }
        return;
      }
      this.scheduleAutoRetry();
    });

    // Clamp selectedDay to the new week when navigating
    effect(() => {
      const days = this.weekDays();
      const selected = this.selectedDay();
      const selectedDow = selected.getDay();
      const matchingDay = days.find((d) => d.getDay() === selectedDow);
      if (matchingDay && matchingDay.getTime() !== selected.getTime()) {
        this.selectedDay.set(matchingDay);
      } else if (!matchingDay && days.length > 0) {
        this.selectedDay.set(days[0]);
      }
    });
  }

  private setInitialSlotFocus(): void {
    const now = new Date();
    this.focusedSlot.set({
      dayIndex: now.getDay(),
      hourIndex: now.getHours(),
    });
  }

  private focusSlot(dayIndex: number, hourIndex: number): void {
    const maxDay = this.weekDays().length - 1;
    const maxHour = this.hours.length - 1;
    const nextDay = Math.min(Math.max(dayIndex, 0), maxDay);
    const nextHour = Math.min(Math.max(hourIndex, 0), maxHour);
    this.focusedSlot.set({ dayIndex: nextDay, hourIndex: nextHour });

    const index = nextHour * this.weekDays().length + nextDay;
    const slots = this.slotCells?.toArray();
    if (!slots || index < 0 || index >= slots.length) return;

    queueMicrotask(() => {
      slots[index]?.nativeElement.focus();
    });
  }

  private lockNavigation(): void {
    if (this.navigationTimer) {
      window.clearTimeout(this.navigationTimer);
    }
    this.navigationLocked.set(true);
    this.navigationTimer = window.setTimeout(() => {
      this.navigationLocked.set(false);
      this.navigationTimer = null;
    }, NAVIGATION_THROTTLE_MS);
  }

  private scheduleAutoRetry(): void {
    if (this.retryTimer) return;
    const attempt = this.retryAttempt();
    if (attempt >= AUTO_RETRY_MAX_ATTEMPTS) return;
    const delay = Math.min(
      AUTO_RETRY_BASE_DELAY_MS * 2 ** attempt,
      AUTO_RETRY_MAX_DELAY_MS
    );

    this.retryScheduledAt.set(Date.now() + delay);
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = null;
      this.retryScheduledAt.set(null);
      this.loadBookings(false);
      this.retryAttempt.set(attempt + 1);
    }, delay);
  }

  private resetRetryState(): void {
    this.retryAttempt.set(0);
    this.clearRetry();
  }

  private clearRetry(): void {
    if (this.retryTimer) {
      window.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    this.retryScheduledAt.set(null);
  }

  private loadBookings(resetRetry: boolean): void {
    if (resetRetry) {
      this.resetRetryState();
    }
    const selectedFacilityId = this.facilityContext.selectedFacilityId();
    this.lastLoadedFacilityId = selectedFacilityId;
    this.store.loadBookings(selectedFacilityId);
  }

  private setupResizeObserver(): void {
    if (typeof ResizeObserver === 'undefined') {
      this.observeMeasurementTargets();
      return;
    }

    this.resizeObserver = new ResizeObserver(() => {
      this.observeMeasurementTargets();
    });
  }

  private observeMeasurementTargets(): void {
    const slot = this.slotCells?.first?.nativeElement ?? null;
    const gridCard = this.gridBookingCards?.first?.nativeElement ?? null;
    const timelineCard = this.timelineCards?.first?.nativeElement ?? null;

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      if (slot) this.resizeObserver.observe(slot);
      if (gridCard) this.resizeObserver.observe(gridCard);
      if (timelineCard) this.resizeObserver.observe(timelineCard);
    }

    if (slot) {
      const slotRect = slot.getBoundingClientRect();
      this.slotBlockSizePx.set(slotRect.height);
      this.calendarCellInlineSizePx.set(slotRect.width);
    } else {
      this.slotBlockSizePx.set(0);
      this.calendarCellInlineSizePx.set(0);
    }

    if (timelineCard) {
      const timelineRect = timelineCard.getBoundingClientRect();
      this.timelineCardBlockSizePx.set(timelineRect.height);
      this.timelineCardInlineSizePx.set(timelineRect.width);
    } else {
      this.timelineCardBlockSizePx.set(0);
      this.timelineCardInlineSizePx.set(0);
    }

    this.gridTypographyMetrics.set(this.extractCardTypographyMetrics(gridCard));
    this.timelineTypographyMetrics.set(
      this.extractCardTypographyMetrics(timelineCard)
    );
  }

  private extractCardTypographyMetrics(
    card: HTMLElement | null
  ): BookingCardTypographyMetrics | null {
    if (!card) return null;

    const cardStyle = getComputedStyle(card);
    const nameEl = card.querySelector<HTMLElement>(
      '.calendar__booking-name, .calendar__timeline-name'
    );
    const metaEl = card.querySelector<HTMLElement>(
      '.calendar__booking-facility, .calendar__timeline-meta'
    );

    const nameStyle = nameEl ? getComputedStyle(nameEl) : null;
    const metaStyle = metaEl ? getComputedStyle(metaEl) : null;
    const nameLineHeightPx = this.readLineHeightPx(nameStyle);
    const metaLineHeightPx = this.readLineHeightPx(metaStyle);

    if (nameLineHeightPx <= 0 || metaLineHeightPx <= 0) {
      return null;
    }

    return {
      paddingBlockPx: Math.max(
        this.parsePxValue(cardStyle.paddingBlockStart),
        this.parsePxValue(cardStyle.paddingBlockEnd)
      ),
      rowGapPx: this.parsePxValue(cardStyle.rowGap || cardStyle.gap),
      nameLineHeightPx,
      metaLineHeightPx,
    };
  }

  private readLineHeightPx(style: CSSStyleDeclaration | null): number {
    if (!style) return 0;
    const explicit = this.parsePxValue(style.lineHeight);
    if (explicit > 0) return explicit;
    const fontSize = this.parsePxValue(style.fontSize);
    return fontSize > 0 ? fontSize * 1.2 : 0;
  }

  private parsePxValue(value: string | null | undefined): number {
    if (!value) return 0;
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private readRootCssVarPx(cssVarName: string): number {
    if (typeof document === 'undefined') return 0;
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(cssVarName)
      .trim();
    return this.parsePxValue(value);
  }

  private clearTimers(): void {
    if (this.toastTimer) {
      window.clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    if (this.navigationTimer) {
      window.clearTimeout(this.navigationTimer);
      this.navigationTimer = null;
    }
    if (this.retryTimer) {
      window.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.focusTimer) {
      window.clearTimeout(this.focusTimer);
      this.focusTimer = null;
    }
    if (this.panelCloseTimer) {
      window.clearTimeout(this.panelCloseTimer);
      this.panelCloseTimer = null;
    }
  }

  private now(): number {
    if (typeof performance !== 'undefined' && performance.now) {
      return performance.now();
    }
    return Date.now();
  }

  private getDayKey(day: Date): string {
    return `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
  }

  private parseDateInput(value: string): Date | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const parsed = new Date(year, month - 1, day);

    if (
      parsed.getFullYear() !== year ||
      parsed.getMonth() !== month - 1 ||
      parsed.getDate() !== day
    ) {
      return null;
    }

    parsed.setHours(0, 0, 0, 0);
    return parsed;
  }

  private buildBookingSegments(
    bookings: BookingListItemDto[]
  ): BookingSegment[] {
    const segments: BookingSegment[] = [];
    for (const booking of bookings) {
      const startMs = new Date(booking.startTime).getTime();
      const endMs = new Date(booking.endTime).getTime();
      if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
        continue;
      }
      if (endMs <= startMs) {
        continue;
      }

      const startDay = new Date(startMs);
      startDay.setHours(0, 0, 0, 0);
      const endDay = new Date(endMs);
      endDay.setHours(0, 0, 0, 0);

      const cursor = new Date(startDay);
      while (cursor.getTime() <= endDay.getTime()) {
        const dayStart = new Date(cursor);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(dayStart);
        dayEnd.setHours(23, 59, 59, 999);

        const segmentStartMs = Math.max(startMs, dayStart.getTime());
        const segmentEndMs = Math.min(endMs, dayEnd.getTime());

        if (segmentEndMs > segmentStartMs) {
          const segmentStart = new Date(segmentStartMs);
          const startHour = segmentStart.getHours();
          const startMinutes = segmentStart.getMinutes();
          segments.push({
            id: `${booking.id}-${segmentStartMs}`,
            booking,
            startMs: segmentStartMs,
            endMs: segmentEndMs,
            startHour,
            startMinutes,
            durationMs: Math.max(0, segmentEndMs - segmentStartMs),
            dayKey: this.getDayKey(dayStart),
          });
        }

        cursor.setDate(cursor.getDate() + 1);
      }
    }
    return segments;
  }

  /**
   * Get bookings for a specific day and hour slot (O(1)).
   * @param day Day to query.
   * @param hour Hour value to query.
   */
  getBookingsForSlot(day: Date, hour: string): BookingSegment[] {
    const [hourNum] = hour.split(':').map(Number);
    const key = `${this.getDayKey(day)}-${hourNum}`;
    return this.bookingsMap().get(key) ?? [];
  }

  /**
   * Resolve layout columns for a booking segment.
   * @param segment Booking segment to position.
   */
  getBookingLayout(segment: BookingSegment): BookingLayout {
    return this.bookingLayout().get(segment.id) ?? this.defaultLayout;
  }

  /**
   * Calculate precise styling for a booking card
   * Handles:
   * - Minute-level vertical positioning (top)
   * - Duration-based height
   * - Horizontal splitting for overlapping bookings in the same start slot
   * @param segment Booking segment to style.
   * @param columnIndex Column index for the segment.
   * @param columnCount Total columns in the overlap cluster.
   */
  getBookingStyle(
    segment: BookingSegment,
    columnIndex: number,
    columnCount: number
  ): BookingCardStyle {
    const topPercent = (segment.startMinutes / 60) * 100;
    const durationHours = segment.durationMs / (1000 * 60 * 60);
    // Subtract a small buffer for borders to prevent visual bleed
    const heightCalc = `calc(${durationHours * 100}% - var(--space-1))`;

    // 3. Width & Left (Simple Overlap Handling)
    // Splits the cell width equally among bookings starting at the same hour
    const widthPercent = 100 / columnCount;
    const leftPercent = columnIndex * widthPercent;

    return {
      top: `${topPercent}%`,
      height: heightCalc,
      width: `${widthPercent}%`,
      left: `${leftPercent}%`,
      // Ensure z-index puts shorter bookings on top if they start same time?
      // Or just standard stacking.
      zIndex: '10',
    };
  }

  getGridBookingPresentation(
    segment: BookingSegment,
    layout: BookingLayout
  ): BookingCardPresentation {
    return (
      this.gridCardPresentations().get(segment.id) ??
      this.buildBookingPresentation({
        availableBlockPx: 0,
        availableInlinePx: 0,
        hasOverlap: layout.columns > 1,
        hasTags: Boolean(segment.booking.customerTags?.length),
        typography: null,
      })
    );
  }

  getTimelineBookingPresentation(
    segment: BookingSegment,
    layout: BookingLayout
  ): BookingCardPresentation {
    return (
      this.timelineCardPresentations().get(segment.id) ??
      this.buildBookingPresentation({
        availableBlockPx: 0,
        availableInlinePx: 0,
        hasOverlap: layout.columns > 1,
        hasTags: Boolean(segment.booking.customerTags?.length),
        typography: null,
      })
    );
  }

  compactStatusCode(status: BookingStatus): string {
    const label = this.statusLabel(status).trim();
    return label ? label.charAt(0).toUpperCase() : '';
  }

  tagDotClass(tag: string | null | undefined): string {
    if (!tag) {
      return 'calendar__booking-tag-dot';
    }
    return `calendar__booking-tag-dot ${resolveTagColorClass(tag)}`;
  }

  private buildBookingPresentation(
    metrics: BookingPresentationMetrics
  ): BookingCardPresentation {
    if (
      !metrics.typography ||
      metrics.availableBlockPx <= 0 ||
      metrics.availableInlinePx <= 0
    ) {
      return {
        density: 'standard',
        showTagChip: false,
        showTagDot: metrics.hasTags,
        showFacility: true,
      };
    }

    const compactMinBlockPx =
      metrics.typography.paddingBlockPx * 2 +
      metrics.typography.nameLineHeightPx;
    const standardMinBlockPx =
      compactMinBlockPx +
      metrics.typography.rowGapPx +
      metrics.typography.metaLineHeightPx;
    const compactMinInlinePx = metrics.typography.nameLineHeightPx * 3.5;
    const standardMinInlinePx =
      metrics.typography.nameLineHeightPx * (metrics.hasTags ? 5 : 4.25);
    const expandedMinInlinePx =
      metrics.typography.nameLineHeightPx * (metrics.hasTags ? 7 : 5.5);

    const fitsCompact =
      metrics.availableBlockPx >= compactMinBlockPx &&
      metrics.availableInlinePx >= compactMinInlinePx;
    const fitsStandard =
      metrics.availableBlockPx >= standardMinBlockPx &&
      metrics.availableInlinePx >= standardMinInlinePx;
    const fitsExpanded =
      !metrics.hasOverlap &&
      fitsStandard &&
      metrics.availableInlinePx >= expandedMinInlinePx;

    let density: BookingCardDensity = 'compact';
    if (fitsExpanded) {
      density = 'expanded';
    } else if (fitsStandard) {
      density = 'standard';
    } else if (!fitsCompact) {
      density = 'compact';
    }

    return {
      density,
      showTagChip: metrics.hasTags && density === 'expanded',
      showTagDot: metrics.hasTags && density !== 'expanded',
      showFacility: density !== 'compact',
    };
  }

  private assignClusterLayout(
    cluster: BookingSegment[],
    layout: BookingLayoutMap
  ): void {
    const columns: BookingSegment[][] = [];
    const columnIndexById = new Map<string, number>();

    for (const segment of cluster) {
      let placed = false;
      for (let i = 0; i < columns.length; i++) {
        const last = columns[i][columns[i].length - 1];
        if (!this.bookingsOverlap(last, segment)) {
          columns[i].push(segment);
          columnIndexById.set(segment.id, i);
          placed = true;
          break;
        }
      }

      if (!placed) {
        columns.push([segment]);
        columnIndexById.set(segment.id, columns.length - 1);
      }
    }

    const columnCount = columns.length;
    for (const segment of cluster) {
      layout.set(segment.id, {
        column: columnIndexById.get(segment.id) ?? 0,
        columns: columnCount,
      });
    }
  }

  private bookingsOverlap(a: BookingSegment, b: BookingSegment): boolean {
    return a.startMs < b.endMs && a.endMs > b.startMs;
  }

  /**
   * Check if a day is today.
   * @param day Day to compare.
   */
  isToday(day: Date): boolean {
    const todayDate = this.today();
    return (
      day.getFullYear() === todayDate.getFullYear() &&
      day.getMonth() === todayDate.getMonth() &&
      day.getDate() === todayDate.getDate()
    );
  }

  /**
   * Navigate to the previous week.
   */
  previousWeek(): void {
    if (!this.canNavigate()) return;
    const current = this.currentDate();
    const prev = new Date(current);
    prev.setDate(current.getDate() - 7);
    this.currentDate.set(prev);
    this.lockNavigation();
  }

  /**
   * Navigate to the next week.
   */
  nextWeek(): void {
    if (!this.canNavigate()) return;
    const current = this.currentDate();
    const next = new Date(current);
    next.setDate(current.getDate() + 7);
    this.currentDate.set(next);
    this.lockNavigation();
  }

  /**
   * Navigate to the current week.
   */
  goToToday(): void {
    if (!this.canNavigate()) return;
    this.currentDate.set(new Date());
    this.selectedDay.set(new Date());
    this.lockNavigation();
  }

  onJumpDateChange(event: Event): void {
    if (!this.canNavigate()) return;
    const input = event.target as HTMLInputElement | null;
    const parsedDate = this.parseDateInput(input?.value ?? '');
    if (!parsedDate) return;

    this.currentDate.set(parsedDate);
    this.selectedDay.set(parsedDate);
    this.lockNavigation();
  }

  /**
   * Select a day for the mobile day view.
   * @param day Day to select.
   */
  selectDay(day: Date): void {
    this.selectedDay.set(day);
  }

  /**
   * Check if a day matches the currently selected day.
   * @param day Day to compare.
   */
  isSelectedDay(day: Date): boolean {
    const selected = this.selectedDay();
    return (
      day.getFullYear() === selected.getFullYear() &&
      day.getMonth() === selected.getMonth() &&
      day.getDate() === selected.getDate()
    );
  }

  /**
   * Get CSS class for booking status.
   * @param status Booking status to map.
   */
  getStatusClass(status: BookingStatus): string {
    switch (status) {
      case BookingStatus.CONFIRMED:
        return 'booking--confirmed';
      case BookingStatus.PENDING:
        return 'booking--pending';
      case BookingStatus.CANCELLED:
        return 'booking--cancelled';
      case BookingStatus.COMPLETED:
        return 'booking--completed';
      case BookingStatus.NO_SHOW:
        return 'booking--no-show';
      default:
        return '';
    }
  }

  /**
   * Map booking status to a tone token.
   * @param status Booking status to map.
   */
  statusTone(
    status: BookingStatus
  ): 'success' | 'warning' | 'danger' | 'neutral' {
    switch (status) {
      case BookingStatus.CONFIRMED:
      case BookingStatus.COMPLETED:
        return 'success';
      case BookingStatus.PENDING:
        return 'warning';
      case BookingStatus.CANCELLED:
      case BookingStatus.NO_SHOW:
        return 'danger';
      default:
        return 'neutral';
    }
  }

  /**
   * Map payment status to a tone token.
   * @param status Payment status to map.
   */
  paymentTone(status: PaymentStatus): 'success' | 'warning' | 'neutral' {
    switch (status) {
      case PaymentStatus.PAID:
        return 'success';
      case PaymentStatus.PARTIALLY_PAID:
        return 'warning';
      default:
        return 'neutral';
    }
  }

  /**
   * Map booking status to a label.
   * @param status Booking status to map.
   */
  statusLabel(status: BookingStatus): string {
    switch (status) {
      case BookingStatus.CONFIRMED:
        return this.t('BOOKING_CALENDAR.STATUS.CONFIRMED', 'Confirmed');
      case BookingStatus.PENDING:
        return this.t('BOOKING_CALENDAR.STATUS.PENDING', 'Pending');
      case BookingStatus.CANCELLED:
        return this.t('BOOKING_CALENDAR.STATUS.CANCELLED', 'Cancelled');
      case BookingStatus.COMPLETED:
        return this.t('BOOKING_CALENDAR.STATUS.COMPLETED', 'Completed');
      case BookingStatus.NO_SHOW:
        return this.t('BOOKING_CALENDAR.STATUS.NO_SHOW', 'No Show');
      default:
        return status;
    }
  }

  /**
   * Map payment status to a label.
   * @param status Payment status to map.
   */
  paymentLabel(status: PaymentStatus): string {
    switch (status) {
      case PaymentStatus.PAID:
        return this.t('BOOKING_CALENDAR.PAYMENT.PAID', 'Paid');
      case PaymentStatus.PARTIALLY_PAID:
        return this.t('BOOKING_CALENDAR.PAYMENT.PARTIAL', 'Partial');
      case PaymentStatus.REFUNDED:
        return this.t('BOOKING_CALENDAR.PAYMENT.REFUNDED', 'Refunded');
      case PaymentStatus.PENDING:
        return this.t('BOOKING_CALENDAR.PAYMENT.UNPAID', 'Unpaid');
      default:
        return status;
    }
  }

  /**
   * Format day number for display.
   * @param day Day to format.
   */
  formatDayNumber(day: Date): string {
    return this.localeFormat.formatDate(day, { day: 'numeric' });
  }

  /**
   * Format time for display (12-hour).
   * @param hour Hour string in HH:mm.
   */
  formatHour(hour: string): string {
    const [h] = hour.split(':').map(Number);
    return this.localeFormat.formatHourLabel(h);
  }

  dayName(day: Date): string {
    return this.localeFormat.formatDate(day, { weekday: 'short' });
  }

  formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Build an aria-label for a calendar slot.
   * @param day Day for the slot.
   * @param hour Hour for the slot.
   * @param bookingCount Count of bookings in the slot.
   */
  slotAriaLabel(day: Date, hour: string, bookingCount: number): string {
    const dayLabel = `${this.dayName(day)} ${this.formatDayNumber(day)}`;
    const timeLabel = this.formatHour(hour);
    if (bookingCount === 0) {
      return this.t(
        'BOOKING_CALENDAR.ARIA.SLOT_NO_BOOKINGS',
        `${dayLabel} at ${timeLabel}. No bookings.`,
        { day: dayLabel, time: timeLabel }
      );
    }
    return this.t(
      'BOOKING_CALENDAR.ARIA.SLOT_BOOKING_COUNT',
      `${dayLabel} at ${timeLabel}. ${bookingCount} bookings.`,
      { day: dayLabel, time: timeLabel, count: bookingCount }
    );
  }

  /**
   * Format an ISO date string for display.
   * @param isoString ISO timestamp to format.
   */
  formatDate(isoString: string): string {
    return this.localeFormat.formatDate(isoString, {
      weekday: 'short',
      month: 'short',
      day: '2-digit',
    });
  }

  /**
   * Format an ISO time string for display.
   * @param isoString ISO timestamp to format.
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
   * Format a timestamp for last-updated messaging.
   * @param timestamp Epoch millis to format.
   */
  formatLastUpdated(timestamp: number | null): string {
    if (!timestamp) return '';
    return this.localeFormat.formatDate(timestamp, {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  /**
   * Determine if the hold timer is currently active.
   * @param booking Booking to evaluate.
   */
  isHoldActive(booking: BookingListItemDto): boolean {
    if (booking.status !== BookingStatus.PENDING || !booking.holdUntil) {
      return false;
    }
    return new Date(booking.holdUntil).getTime() > Date.now();
  }

  /**
   * Track function for ngFor.
   * @param index NgFor index.
   * @param day Day being tracked.
   */
  trackByDay(index: number, day: Date): number {
    return day.getTime();
  }

  /**
   * Track function for hour rows.
   * @param index NgFor index.
   * @param hour Hour value.
   */
  trackByHour(index: number, hour: string): string {
    return hour;
  }

  /**
   * Track function for booking segments.
   * @param index NgFor index.
   * @param segment Booking segment.
   */
  trackByBooking(index: number, segment: BookingSegment): string {
    return segment.id;
  }
}
