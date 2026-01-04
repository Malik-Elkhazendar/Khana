import {
  ChangeDetectionStrategy,
  Component,
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
import { BookingStore } from '../../state/bookings/booking.store';
import {
  BookingListItemDto,
  BookingStatus,
  PaymentStatus,
} from '@khana/shared-dtos';
import { HoldTimerComponent } from './hold-timer.component';
import { ConfirmationDialogComponent } from '../../shared/components/confirmation-dialog.component';
import { CancellationFormComponent } from '../../shared/components/cancellation-form.component';

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

const CANCEL_REASON_MIN_LENGTH = 5;
const ACTION_TOASTS: Record<ActionDialogType, string> = {
  confirm: 'Booking confirmed',
  pay: 'Payment marked as paid',
  cancel: 'Booking cancelled',
};
const ACTION_FAILURE_MESSAGE = 'Action failed. Please try again.';
const AUTO_RETRY_MAX_ATTEMPTS = 3;
const AUTO_RETRY_BASE_DELAY_MS = 800;
const AUTO_RETRY_MAX_DELAY_MS = 8000;
const NAVIGATION_THROTTLE_MS = 200;
const ERROR_DESCRIPTION_ID = 'calendar-error';
const DIALOG_COPY: Record<ActionDialogType, DialogCopy> = {
  confirm: {
    title: 'Confirm booking',
    message: 'This will confirm the booking and notify the customer.',
    confirmLabel: 'Confirm booking',
    confirmTone: 'primary',
  },
  pay: {
    title: 'Mark as paid',
    message: 'This will mark the booking as paid.',
    confirmLabel: 'Mark paid',
    confirmTone: 'secondary',
  },
  cancel: {
    title: 'Cancel booking',
    message: 'This action is permanent and cannot be undone.',
    confirmLabel: 'Cancel booking',
    confirmTone: 'danger',
  },
};

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

const ERROR_RECOVERY_OPTIONS: Record<ErrorCategory, ErrorRecoveryOption[]> = {
  network: [
    {
      action: 'retry',
      label: 'Retry now',
      description: 'Reconnect and try loading bookings again.',
    },
    {
      action: 'dismiss',
      label: 'Dismiss',
      description: 'Keep the last loaded calendar data.',
    },
  ],
  server: [
    {
      action: 'retry',
      label: 'Retry now',
      description: 'Attempt to reload when the server responds.',
    },
    {
      action: 'refresh',
      label: 'Refresh data',
      description: 'Fetch the latest bookings once available.',
    },
  ],
  validation: [
    {
      action: 'dismiss',
      label: 'Dismiss',
      description: 'Review the inputs and try again.',
    },
  ],
  conflict: [
    {
      action: 'refresh',
      label: 'Refresh bookings',
      description: 'Reload to resolve conflicting updates.',
    },
    {
      action: 'dismiss',
      label: 'Dismiss',
      description: 'Keep the last loaded calendar data.',
    },
  ],
  auth: [
    {
      action: 'refresh',
      label: 'Refresh session',
      description: 'Refresh data after signing in again.',
    },
    {
      action: 'dismiss',
      label: 'Dismiss',
      description: 'Return to the last loaded calendar data.',
    },
  ],
  not_found: [
    {
      action: 'refresh',
      label: 'Refresh bookings',
      description: 'Reload to find an updated booking list.',
    },
  ],
  unknown: [
    {
      action: 'retry',
      label: 'Retry now',
      description: 'Try loading bookings again.',
    },
    {
      action: 'dismiss',
      label: 'Dismiss',
      description: 'Keep the last loaded calendar data.',
    },
  ],
};

const ERROR_CATEGORY_LABELS: Record<ErrorCategory, string> = {
  network: 'Network issue',
  server: 'Server error',
  validation: 'Validation issue',
  conflict: 'Conflict detected',
  auth: 'Authorization issue',
  not_found: 'Booking not found',
  unknown: 'Unexpected error',
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
    HoldTimerComponent,
    ConfirmationDialogComponent,
    CancellationFormComponent,
  ],
  templateUrl: './booking-calendar.component.html',
  styleUrl: './booking-calendar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingCalendarComponent implements OnInit, OnDestroy {
  readonly store = inject(BookingStore);
  readonly BookingStatus = BookingStatus;
  readonly PaymentStatus = PaymentStatus;

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
  readonly cancelReasonMinLength = CANCEL_REASON_MIN_LENGTH;
  readonly lastSuccessfulBookings = signal<BookingListItemDto[]>([]);
  readonly lastSuccessfulAt = signal<number | null>(null);
  readonly retryAttempt = signal<number>(0);
  readonly retryScheduledAt = signal<number | null>(null);
  readonly navigationLocked = signal<boolean>(false);
  readonly focusedSlot = signal<SlotFocus>({ dayIndex: 0, hourIndex: 0 });
  readonly errorDescriptionId = ERROR_DESCRIPTION_ID;

  @ViewChild('actionPanel') actionPanel?: ElementRef<HTMLElement>;
  @ViewChild('closeButton') closeButton?: ElementRef<HTMLButtonElement>;
  @ViewChildren('slotCell') slotCells?: QueryList<ElementRef<HTMLElement>>;

  private lastFocusedElement: HTMLElement | null = null;
  private toastTimer: number | null = null;
  private navigationTimer: number | null = null;
  private retryTimer: number | null = null;
  private focusTimer: number | null = null;
  private panelCloseTimer: number | null = null;

  private readonly weekRangeFormatter = new Intl.DateTimeFormat('en-SA', {
    month: 'short',
    day: 'numeric',
  });
  private readonly dateFormatter = new Intl.DateTimeFormat('en-SA', {
    weekday: 'short',
    month: 'short',
    day: '2-digit',
  });
  private readonly timeFormatter = new Intl.DateTimeFormat('en-SA', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  // Operating hours (00:00 - 23:00)
  readonly hours: string[] = Array.from(
    { length: 24 },
    (_, i) => `${i.toString().padStart(2, '0')}:00`
  );

  // Day names for header
  readonly dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
    return DIALOG_COPY[dialog.type];
  });

  readonly cancelReasonValid = computed(() => {
    return this.cancelReason().trim().length >= this.cancelReasonMinLength;
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
      return this.error() ? ERROR_RECOVERY_OPTIONS.unknown : [];
    }
    return ERROR_RECOVERY_OPTIONS[category];
  });

  readonly errorCategoryLabel = computed(() => {
    const category = this.errorCategory();
    if (category) return ERROR_CATEGORY_LABELS[category];
    return this.error() ? ERROR_CATEGORY_LABELS.unknown : '';
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
  readonly dialogAvailable = computed(
    () => this.actionDialog() === null && !this.actionInProgress()
  );

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

  private readonly defaultLayout: BookingLayout = { column: 0, columns: 1 };

  // Computed: 7 days of the current week (starting Sunday)
  readonly weekDays = computed(() => {
    const current = this.currentDate();
    const dayOfWeek = current.getDay(); // 0 = Sunday
    const sunday = new Date(current);
    sunday.setDate(current.getDate() - dayOfWeek);
    sunday.setHours(0, 0, 0, 0);

    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
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
    return `${this.weekRangeFormatter.format(
      start
    )} - ${this.weekRangeFormatter.format(end)}, ${end.getFullYear()}`;
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

  constructor() {
    this.registerEffects();
  }

  ngOnInit(): void {
    this.setInitialSlotFocus();
    this.loadBookings(true);
  }

  ngOnDestroy(): void {
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
        nextDay = Math.min(this.dayNames.length - 1, dayIndex + 1);
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
    await this.runAction(async () => {
      const booking = this.selectedBookingLive();
      if (!booking) return false;
      return await this.store.confirmBooking(booking.id);
    }, 'Booking confirmed');
  }

  /**
   * Mark the selected booking as paid.
   */
  async markPaid(): Promise<void> {
    await this.runAction(async () => {
      const booking = this.selectedBookingLive();
      if (!booking) return false;
      return await this.store.markBookingPaid(booking.id);
    }, 'Payment marked as paid');
  }

  /**
   * Cancel the selected booking with a reason.
   */
  async cancelBooking(): Promise<void> {
    await this.runAction(async () => {
      const booking = this.selectedBookingLive();
      if (!booking) return false;
      return await this.store.cancelBooking(
        booking.id,
        this.cancelReason().trim()
      );
    }, 'Booking cancelled');
  }

  /**
   * Open the confirm dialog for the selected booking.
   */
  openConfirmDialog(): void {
    if (!this.dialogAvailable()) return;
    const booking = this.selectedBookingLive();
    if (!booking) return;
    this.actionDialog.set({ type: 'confirm', bookingId: booking.id });
  }

  /**
   * Open the mark-paid dialog for the selected booking.
   */
  openPayDialog(): void {
    if (!this.dialogAvailable()) return;
    const booking = this.selectedBookingLive();
    if (!booking) return;
    this.actionDialog.set({ type: 'pay', bookingId: booking.id });
  }

  /**
   * Open the cancel dialog and reset the reason input.
   */
  openCancelDialog(): void {
    if (!this.dialogAvailable()) return;
    const booking = this.selectedBookingLive();
    if (!booking) return;
    this.cancelReason.set('');
    this.actionDialog.set({ type: 'cancel', bookingId: booking.id });
  }

  /**
   * Close the active dialog and reset dialog state.
   */
  closeDialog(): void {
    this.actionDialog.set(null);
    this.cancelReason.set('');
  }

  /**
   * Submit the action configured by the dialog.
   */
  async submitDialogAction(): Promise<void> {
    const dialog = this.actionDialog();
    if (!dialog) return;

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
          return await this.store.cancelBooking(
            booking.id,
            this.cancelReason().trim()
          );
        default:
          return false;
      }
    };

    await this.runAction(action, ACTION_TOASTS[dialog.type], () => {
      this.closeDialog();
    });
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
    } catch (error) {
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
      this.showToast(ACTION_FAILURE_MESSAGE, 'error');
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
  }

  private setInitialSlotFocus(): void {
    const now = new Date();
    this.focusedSlot.set({
      dayIndex: now.getDay(),
      hourIndex: now.getHours(),
    });
  }

  private focusSlot(dayIndex: number, hourIndex: number): void {
    const maxDay = this.dayNames.length - 1;
    const maxHour = this.hours.length - 1;
    const nextDay = Math.min(Math.max(dayIndex, 0), maxDay);
    const nextHour = Math.min(Math.max(hourIndex, 0), maxHour);
    this.focusedSlot.set({ dayIndex: nextDay, hourIndex: nextHour });

    const index = nextHour * this.dayNames.length + nextDay;
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
      this.store.loadBookings(null);
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
    this.store.loadBookings(null);
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
    this.lockNavigation();
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
        return 'Confirmed';
      case BookingStatus.PENDING:
        return 'Pending';
      case BookingStatus.CANCELLED:
        return 'Cancelled';
      case BookingStatus.COMPLETED:
        return 'Completed';
      case BookingStatus.NO_SHOW:
        return 'No Show';
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
        return 'Paid';
      case PaymentStatus.PARTIALLY_PAID:
        return 'Partial';
      case PaymentStatus.REFUNDED:
        return 'Refunded';
      case PaymentStatus.PENDING:
        return 'Unpaid';
      default:
        return status;
    }
  }

  /**
   * Format day number for display.
   * @param day Day to format.
   */
  formatDayNumber(day: Date): string {
    return day.getDate().toString();
  }

  /**
   * Format time for display (12-hour).
   * @param hour Hour string in HH:mm.
   */
  formatHour(hour: string): string {
    const [h] = hour.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12} ${period}`;
  }

  /**
   * Build an aria-label for a calendar slot.
   * @param day Day for the slot.
   * @param hour Hour for the slot.
   * @param bookingCount Count of bookings in the slot.
   */
  slotAriaLabel(day: Date, hour: string, bookingCount: number): string {
    const dayLabel = `${this.dayNames[day.getDay()]} ${this.formatDayNumber(
      day
    )}`;
    const timeLabel = this.formatHour(hour);
    if (bookingCount === 0) {
      return `${dayLabel} at ${timeLabel}. No bookings.`;
    }
    const plural = bookingCount === 1 ? 'booking' : 'bookings';
    return `${dayLabel} at ${timeLabel}. ${bookingCount} ${plural}.`;
  }

  /**
   * Format an ISO date string for display.
   * @param isoString ISO timestamp to format.
   */
  formatDate(isoString: string): string {
    return this.dateFormatter.format(new Date(isoString));
  }

  /**
   * Format an ISO time string for display.
   * @param isoString ISO timestamp to format.
   */
  formatTime(isoString: string | null | undefined): string {
    if (!isoString) return '';
    return this.timeFormatter.format(new Date(isoString));
  }

  /**
   * Format a timestamp for last-updated messaging.
   * @param timestamp Epoch millis to format.
   */
  formatLastUpdated(timestamp: number | null): string {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleString('en-SA', {
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
