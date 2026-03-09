import {
  BookingCancellationScope,
  BookingListItemDto,
} from '@khana/shared-dtos';
import { BookingSegment, ErrorRecoveryAction } from './booking-calendar.models';
import { BookingCalendarRoutePresentationBase } from './booking-calendar.route-presentation';

export abstract class BookingCalendarRouteActionsBase extends BookingCalendarRoutePresentationBase {
  protected abstract loadBookings(resetRetry: boolean): void;

  openBooking(booking: BookingListItemDto, event?: Event): void {
    if (this.actionDialog()) {
      this.closeDialog();
    }
    this.actionInProgress.set(false);
    this.cancelReason.set('');
    this.store.clearBookingDetailError(booking.id);
    this.lastFocusedElement =
      (event?.currentTarget as HTMLElement) ??
      (document.activeElement as HTMLElement);
    this.selectedBooking.set(booking);
    this.selectedBookingId.set(booking.id);
    void this.store.loadBookingById(booking.id);
  }

  closePanel(): void {
    this.selectedBooking.set(null);
    this.selectedBookingId.set(null);
    this.actionInProgress.set(false);
    this.actionDialog.set(null);
    this.cancelReason.set('');
    if (this.lastFocusedElement) {
      this.lastFocusedElement.focus();
      this.lastFocusedElement = null;
    }
  }

  onSlotFocus(dayIndex: number, hourIndex: number): void {
    this.focusedSlot.set({ dayIndex, hourIndex });
  }

  slotTabIndex(dayIndex: number, hourIndex: number): number {
    const focused = this.focusedSlot();
    if (!focused) {
      return dayIndex === 0 && hourIndex === 0 ? 0 : -1;
    }

    return focused.dayIndex === dayIndex && focused.hourIndex === hourIndex
      ? 0
      : -1;
  }

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

    if (nextDay === dayIndex && nextHour === hourIndex) {
      return;
    }
    event.preventDefault();
    this.focusSlot(nextDay, nextHour);
  }

  retryLoad(): void {
    this.loadBookings(true);
  }

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

  async confirmBooking(): Promise<void> {
    if (!this.canConfirm()) {
      return;
    }

    await this.runAction(async () => {
      const booking = this.selectedBookingLive();
      if (!booking) {
        return false;
      }

      return await this.store.confirmBooking(booking.id);
    }, this.getActionSuccessMessage('confirm'));
  }

  async markPaid(): Promise<void> {
    if (!this.canMarkPaid()) {
      return;
    }

    await this.runAction(async () => {
      const booking = this.selectedBookingLive();
      if (!booking) {
        return false;
      }

      return await this.store.markBookingPaid(booking.id);
    }, this.getActionSuccessMessage('pay'));
  }

  async cancelBooking(): Promise<void> {
    if (!this.canCancel()) {
      return;
    }

    await this.runAction(async () => {
      const booking = this.selectedBookingLive();
      if (!booking) {
        return false;
      }

      return await this.store.cancelBookingWithScope(
        booking.id,
        this.cancelReason().trim(),
        this.cancelScope()
      );
    }, this.getActionSuccessMessage('cancel'));
  }

  openConfirmDialog(): void {
    if (!this.canConfirm() || !this.dialogAvailable()) {
      return;
    }

    const booking = this.selectedBookingLive();
    if (!booking) {
      return;
    }

    this.actionDialog.set({ type: 'confirm', bookingId: booking.id });
  }

  openPayDialog(): void {
    if (!this.canMarkPaid() || !this.dialogAvailable()) {
      return;
    }

    const booking = this.selectedBookingLive();
    if (!booking) {
      return;
    }

    this.actionDialog.set({ type: 'pay', bookingId: booking.id });
  }

  openCancelDialog(): void {
    if (!this.canCancel() || !this.dialogAvailable()) {
      return;
    }

    const booking = this.selectedBookingLive();
    if (!booking) {
      return;
    }

    this.cancelReason.set('');
    this.cancelScope.set(BookingCancellationScope.SINGLE);
    this.actionDialog.set({ type: 'cancel', bookingId: booking.id });
  }

  viewFullDetails(): void {
    const booking = this.selectedBookingLive();
    if (!booking) {
      return;
    }

    void this.router.navigate(['/dashboard/bookings', booking.id]);
  }

  closeDialog(): void {
    this.actionDialog.set(null);
    this.cancelReason.set('');
    this.cancelScope.set(BookingCancellationScope.SINGLE);
  }

  async submitDialogAction(): Promise<void> {
    const dialog = this.actionDialog();
    if (!dialog) {
      return;
    }

    if (dialog.type === 'confirm' && !this.canConfirm()) {
      return;
    }
    if (dialog.type === 'pay' && !this.canMarkPaid()) {
      return;
    }
    if (dialog.type === 'cancel' && !this.canCancel()) {
      return;
    }
    if (dialog.type === 'cancel' && !this.cancelReasonValid()) {
      return;
    }

    const booking = this.selectedBookingLive();
    if (!booking) {
      return;
    }

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

  protected async runAction(
    action: () => Promise<boolean>,
    successMessage: string,
    onSuccess?: () => void
  ): Promise<void> {
    if (this.actionInProgress()) {
      return;
    }

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
      return;
    }

    this.showToast(
      this.t(
        'BOOKING_CALENDAR.ERRORS.ACTION_FAILED',
        'Action failed. Please try again.'
      ),
      'error'
    );
  }

  protected showToast(message: string, tone: 'success' | 'error'): void {
    this.toast.set({ message, tone });
    if (this.toastTimer) {
      window.clearTimeout(this.toastTimer);
    }
    this.toastTimer = window.setTimeout(() => {
      this.toast.set(null);
      this.toastTimer = null;
    }, 2000);
  }

  protected abstract focusSlot(dayIndex: number, hourIndex: number): void;
}
