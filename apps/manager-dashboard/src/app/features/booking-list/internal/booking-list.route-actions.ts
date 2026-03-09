import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  BookingCancellationScope,
  BookingListItemDto,
  BookingStatus,
  PaymentStatus,
  parseCancellationReason,
} from '@khana/shared-dtos';
import { BookingListRoutePresentationBase } from './booking-list.route-presentation';

export abstract class BookingListRouteActionsBase extends BookingListRoutePresentationBase {
  toggleBookingSelection(booking: BookingListItemDto, checked: boolean): void {
    this.selectedBookingIds.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(booking.id);
      } else {
        next.delete(booking.id);
      }
      return next;
    });
  }

  toggleSelectAllOnPage(checked: boolean): void {
    const pageBookings = this.pagedBookings().filter((booking) =>
      this.isCancellable(booking)
    );
    this.selectedBookingIds.update((current) => {
      const next = new Set(current);
      for (const booking of pageBookings) {
        if (checked) {
          next.add(booking.id);
        } else {
          next.delete(booking.id);
        }
      }
      return next;
    });
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

  openBulkMarkPaidDialog(): void {
    if (!this.canMarkPaid() || this.selectedMarkPaidCount() === 0) {
      return;
    }
    this.bulkMarkPaidError.set(null);
    this.bulkMarkPaidOpen.set(true);
  }

  closeBulkMarkPaidDialog(): void {
    this.bulkMarkPaidOpen.set(false);
    this.bulkMarkPaidError.set(null);
    this.bulkMarkPaidInProgress.set(false);
  }

  async submitBulkCancel(): Promise<void> {
    if (this.bulkActionInProgress()) {
      return;
    }

    const reason = this.bulkCancelReason().trim();
    if (!parseCancellationReason(reason).isValid) {
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
    } catch {
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

  async submitBulkMarkPaid(): Promise<void> {
    if (this.bulkMarkPaidInProgress()) {
      return;
    }

    const targets = this.selectedMarkPaidBookings();
    if (!this.canMarkPaid() || targets.length === 0) {
      this.bulkMarkPaidError.set(
        this.t(
          'BOOKING_LIST.ERRORS.NO_PAYABLE_SELECTED',
          'No payable bookings selected.'
        )
      );
      return;
    }

    this.bulkMarkPaidInProgress.set(true);
    let shouldRefresh = false;
    try {
      shouldRefresh = true;
      const results = await Promise.all(
        targets.map(async (booking) => ({
          id: booking.id,
          success: await this.store.markBookingPaid(booking.id),
        }))
      );

      const successfulIds = results
        .filter((result) => result.success)
        .map((result) => result.id);
      const successCount = successfulIds.length;
      const failureCount = results.length - successCount;

      if (successfulIds.length > 0) {
        this.selectedBookingIds.update((current) => {
          const next = new Set(current);
          for (const id of successfulIds) {
            next.delete(id);
          }
          return next;
        });
      }

      if (failureCount > 0) {
        this.bulkMarkPaidError.set(
          this.t(
            'BOOKING_LIST.ERRORS.BULK_MARK_PAID_FAILED_COUNT',
            `${failureCount} of ${targets.length} mark-as-paid updates failed.`,
            { failures: failureCount, total: targets.length }
          )
        );

        if (successCount > 0) {
          this.showToast(
            this.t(
              'BOOKING_LIST.TOAST.SELECTED_BOOKINGS_MARKED_PAID',
              `${successCount} bookings marked as paid.`,
              { count: successCount }
            ),
            'success'
          );
        }

        this.showToast(
          this.t(
            'BOOKING_LIST.ERRORS.SOME_MARK_PAID_FAILED',
            'Some mark-as-paid updates failed. Please retry.'
          ),
          'error'
        );
        return;
      }

      this.showToast(
        this.t(
          'BOOKING_LIST.TOAST.SELECTED_BOOKINGS_MARKED_PAID',
          `${successCount} bookings marked as paid.`,
          { count: successCount }
        ),
        'success'
      );
      this.closeBulkMarkPaidDialog();
    } catch {
      this.bulkMarkPaidError.set(
        this.t(
          'BOOKING_LIST.ERRORS.BULK_MARK_PAID_FAILED',
          'Bulk mark as paid failed. Please try again.'
        )
      );
      this.showToast(
        this.t(
          'BOOKING_LIST.ERRORS.BULK_MARK_PAID_FAILED',
          'Bulk mark as paid failed. Please try again.'
        ),
        'error'
      );
    } finally {
      if (shouldRefresh) {
        this.store.loadBookings(this.getFacilityFilter());
      }
      this.bulkMarkPaidInProgress.set(false);
    }
  }

  exportCsv(): void {
    const rows = this.filteredBookings();
    if (rows.length === 0) {
      return;
    }

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

  protected escapeCsvValue(value: string): string {
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
    if (rows.length === 0) {
      return;
    }

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

  openCancelDialog(booking: BookingListItemDto): void {
    if (!this.canCancel()) {
      return;
    }
    if (booking.status === BookingStatus.CANCELLED) {
      return;
    }

    this.cancelDialogBooking.set(booking);
    this.cancelScope.set(BookingCancellationScope.SINGLE);
    this.cancelReason.set('');
    this.cancelError.set(null);
  }

  closeCancelDialog(): void {
    this.cancelDialogBooking.set(null);
    this.cancelScope.set(BookingCancellationScope.SINGLE);
    this.cancelReason.set('');
    this.cancelError.set(null);
    this.actionInProgress.set(false);
  }

  async submitCancelDialog(): Promise<void> {
    if (this.actionInProgress()) {
      return;
    }

    const booking = this.cancelDialogBooking();
    if (!booking || !this.cancelReasonValid()) {
      return;
    }

    this.actionInProgress.set(true);
    try {
      const success = await this.store.cancelBookingWithScope(
        booking.id,
        this.cancelReason().trim(),
        this.cancelScope()
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
    } catch {
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

  async markAsPaid(booking: BookingListItemDto): Promise<void> {
    if (!this.canMarkPaid()) {
      return;
    }
    if (booking.paymentStatus === PaymentStatus.PAID) {
      return;
    }
    if (this.actionLoadingById()[booking.id]) {
      return;
    }

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
    } catch {
      this.showToast(
        this.t(
          'BOOKING_LIST.ERRORS.MARK_PAID_FAILED',
          'Failed to mark booking as paid.'
        ),
        'error'
      );
    }
  }

  protected showToast(message: string, tone: 'success' | 'error'): void {
    this.toast.set({ message, tone });
    if (this.toastTimer) {
      window.clearTimeout(this.toastTimer);
    }
    this.toastTimer = window.setTimeout(() => {
      this.toast.set(null);
      this.toastTimer = null;
    }, 2500);
  }

  protected loadTenantTags(): void {
    this.api
      .getTenantTags()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (tags) => {
          this.availableTags.set(tags);
        },
        error: () => {
          this.availableTags.set([]);
        },
      });
  }
}
