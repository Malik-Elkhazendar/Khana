import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  computed,
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

const CANCEL_REASON_MIN_LENGTH = 5;
const ACTION_TOASTS: Record<ActionDialogType, string> = {
  confirm: 'Booking confirmed',
  pay: 'Payment marked as paid',
  cancel: 'Booking cancelled',
};
const ACTION_FAILURE_MESSAGE = 'Action failed. Please try again.';
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
export class BookingCalendarComponent implements OnInit {
  readonly store = inject(BookingStore);
  readonly BookingStatus = BookingStatus;

  // State from store
  readonly bookings = this.store.bookings;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  // Local signals
  readonly currentDate = signal<Date>(new Date());
  readonly selectedBooking = signal<BookingListItemDto | null>(null);
  readonly actionInProgress = signal(false);
  readonly toast = signal<ToastNotice | null>(null);
  readonly actionDialog = signal<ActionDialogState | null>(null);
  readonly cancelReason = signal('');
  readonly cancelReasonMinLength = CANCEL_REASON_MIN_LENGTH;

  @ViewChild('actionPanel') actionPanel?: ElementRef<HTMLElement>;
  @ViewChild('closeButton') closeButton?: ElementRef<HTMLButtonElement>;

  private lastFocusedElement: HTMLElement | null = null;
  private toastTimer: number | null = null;

  // Operating hours (00:00 - 23:00)
  readonly hours: string[] = Array.from({ length: 24 }, (_, i) =>
    `${i.toString().padStart(2, '0')}:00`
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

  private readonly defaultLayout = { column: 0, columns: 1 };

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

    const formatter = new Intl.DateTimeFormat('en-SA', {
      month: 'short',
      day: 'numeric',
    });

    return `${formatter.format(start)} - ${formatter.format(end)}, ${end.getFullYear()}`;
  });

  /**
   * Optimized Booking Index (O(N) -> O(1) Lookup)
   * Map Key: "YYYY-M-D-H" (e.g., "2023-10-27-14")
   */
  readonly bookingsMap = computed(() => {
    const map = new Map<string, BookingListItemDto[]>();
    const allBookings = this.bookings();

    for (const booking of allBookings) {
      const start = new Date(booking.startTime);
      const key = `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}-${start.getHours()}`;

      let slotBookings = map.get(key);
      if (!slotBookings) {
        slotBookings = [];
        map.set(key, slotBookings);
      }
      slotBookings.push(booking);
    }
    return map;
  });

  readonly bookingLayout = computed(() => {
    const layout = new Map<string, { column: number; columns: number }>();
    const bookingsByDay = new Map<string, BookingListItemDto[]>();

    for (const booking of this.bookings()) {
      const start = new Date(booking.startTime);
      const dayKey = `${start.getFullYear()}-${start.getMonth()}-${start.getDate()}`;
      const list = bookingsByDay.get(dayKey);
      if (list) {
        list.push(booking);
      } else {
        bookingsByDay.set(dayKey, [booking]);
      }
    }

    for (const dayBookings of bookingsByDay.values()) {
      const sorted = [...dayBookings].sort(
        (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );

      let cluster: BookingListItemDto[] = [];
      let clusterEnd = 0;

      for (const booking of sorted) {
        const startTime = new Date(booking.startTime).getTime();
        const endTime = new Date(booking.endTime).getTime();

        if (cluster.length === 0 || startTime < clusterEnd) {
          cluster.push(booking);
          clusterEnd = Math.max(clusterEnd, endTime);
        } else {
          this.assignClusterLayout(cluster, layout);
          cluster = [booking];
          clusterEnd = endTime;
        }
      }

      if (cluster.length > 0) {
        this.assignClusterLayout(cluster, layout);
      }
    }

    return layout;
  });

  ngOnInit(): void {
    // Load bookings on init (uses current filter from store)
    this.store.loadBookings(null);
  }

  /**
   * Open action panel for a booking
   */
  openBooking(booking: BookingListItemDto, event?: Event): void {
    this.lastFocusedElement =
      (event?.currentTarget as HTMLElement) ?? (document.activeElement as HTMLElement);
    this.selectedBooking.set(booking);

    setTimeout(() => {
      if (this.closeButton?.nativeElement) {
        this.closeButton.nativeElement.focus();
      } else {
        this.actionPanel?.nativeElement?.focus();
      }
    }, 0);
  }

  /**
   * Close action panel and restore focus
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
   * Trap focus inside the panel and support ESC close
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

  async confirmBooking(): Promise<void> {
    await this.runAction(async () => {
      const booking = this.selectedBookingLive();
      if (!booking) return false;
      return await this.store.confirmBooking(booking.id);
    }, 'Booking confirmed');
  }

  async markPaid(): Promise<void> {
    await this.runAction(async () => {
      const booking = this.selectedBookingLive();
      if (!booking) return false;
      return await this.store.markBookingPaid(booking.id);
    }, 'Payment marked as paid');
  }

  async cancelBooking(): Promise<void> {
    await this.runAction(async () => {
      const booking = this.selectedBookingLive();
      if (!booking) return false;
      return await this.store.cancelBooking(booking.id, this.cancelReason().trim());
    }, 'Booking cancelled');
  }

  openConfirmDialog(): void {
    const booking = this.selectedBookingLive();
    if (!booking) return;
    this.actionDialog.set({ type: 'confirm', bookingId: booking.id });
  }

  openPayDialog(): void {
    const booking = this.selectedBookingLive();
    if (!booking) return;
    this.actionDialog.set({ type: 'pay', bookingId: booking.id });
  }

  openCancelDialog(): void {
    const booking = this.selectedBookingLive();
    if (!booking) return;
    this.cancelReason.set('');
    this.actionDialog.set({ type: 'cancel', bookingId: booking.id });
  }

  closeDialog(): void {
    this.actionDialog.set(null);
    this.cancelReason.set('');
  }

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

    const success = await action();
    this.actionInProgress.set(false);

    if (success) {
      if (onSuccess) {
        onSuccess();
      }
      this.showToast(successMessage, 'success');
      setTimeout(() => this.closePanel(), 650);
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
    return Array.from(container.querySelectorAll<HTMLElement>(selectors.join(',')));
  }

  /**
   * Get bookings for a specific day and hour slot (O(1))
   */
  getBookingsForSlot(day: Date, hour: string): BookingListItemDto[] {
    const [hourNum] = hour.split(':').map(Number);
    const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}-${hourNum}`;
    return this.bookingsMap().get(key) ?? [];
  }

  getBookingLayout(booking: BookingListItemDto): { column: number; columns: number } {
    return this.bookingLayout().get(booking.id) ?? this.defaultLayout;
  }

  /**
   * Calculate precise styling for a booking card
   * Handles:
   * - Minute-level vertical positioning (top)
   * - Duration-based height
   * - Horizontal splitting for overlapping bookings in the same start slot
   */
  getBookingStyle(
    booking: BookingListItemDto,
    columnIndex: number,
    columnCount: number
  ): Record<string, string> {
    const start = new Date(booking.startTime);
    const end = new Date(booking.endTime);

    // 1. Top Position (Minutes)
    const startMinutes = start.getMinutes();
    const topPercent = (startMinutes / 60) * 100;

    // 2. Height (Duration)
    // We assume 1 hour slot = 100% height (approx 60px visual)
    const durationMs = end.getTime() - start.getTime();
    const durationHours = durationMs / (1000 * 60 * 60);
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
    cluster: BookingListItemDto[],
    layout: Map<string, { column: number; columns: number }>
  ): void {
    const columns: BookingListItemDto[][] = [];
    const columnIndexById = new Map<string, number>();

    for (const booking of cluster) {
      let placed = false;
      for (let i = 0; i < columns.length; i++) {
        const last = columns[i][columns[i].length - 1];
        if (!this.bookingsOverlap(last, booking)) {
          columns[i].push(booking);
          columnIndexById.set(booking.id, i);
          placed = true;
          break;
        }
      }

      if (!placed) {
        columns.push([booking]);
        columnIndexById.set(booking.id, columns.length - 1);
      }
    }

    const columnCount = columns.length;
    for (const booking of cluster) {
      layout.set(booking.id, {
        column: columnIndexById.get(booking.id) ?? 0,
        columns: columnCount,
      });
    }
  }

  private bookingsOverlap(a: BookingListItemDto, b: BookingListItemDto): boolean {
    const startA = new Date(a.startTime).getTime();
    const endA = new Date(a.endTime).getTime();
    const startB = new Date(b.startTime).getTime();
    const endB = new Date(b.endTime).getTime();
    return startA < endB && endA > startB;
  }

  /**
   * Check if a day is today
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
   * Navigate to previous week
   */
  previousWeek(): void {
    const current = this.currentDate();
    const prev = new Date(current);
    prev.setDate(current.getDate() - 7);
    this.currentDate.set(prev);
  }

  /**
   * Navigate to next week
   */
  nextWeek(): void {
    const current = this.currentDate();
    const next = new Date(current);
    next.setDate(current.getDate() + 7);
    this.currentDate.set(next);
  }

  /**
   * Go to current week
   */
  goToToday(): void {
    this.currentDate.set(new Date());
  }

  /**
   * Get CSS class for booking status
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

  statusTone(status: BookingStatus): 'success' | 'warning' | 'danger' | 'neutral' {
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
   * Format day number for display
   */
  formatDayNumber(day: Date): string {
    return day.getDate().toString();
  }

  /**
   * Format time for display (12-hour)
   */
  formatHour(hour: string): string {
    const [h] = hour.split(':').map(Number);
    const period = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    return `${hour12} ${period}`;
  }

  formatDate(isoString: string): string {
    return new Date(isoString).toLocaleDateString('en-SA', {
      weekday: 'short',
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

  isHoldActive(booking: BookingListItemDto): boolean {
    if (booking.status !== BookingStatus.PENDING || !booking.holdUntil) {
      return false;
    }
    return new Date(booking.holdUntil).getTime() > Date.now();
  }

  /**
   * Track function for ngFor
   */
  trackByDay(index: number, day: Date): number {
    return day.getTime();
  }

  trackByHour(index: number, hour: string): string {
    return hour;
  }

  trackByBooking(index: number, booking: BookingListItemDto): string {
    return booking.id;
  }
}
