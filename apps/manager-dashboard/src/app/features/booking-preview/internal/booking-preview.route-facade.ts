import { Directive, effect } from '@angular/core';
import { Observable, catchError, throwError, timeout } from 'rxjs';
import {
  BookingStatus,
  RecurrenceFrequency,
  WaitlistStatus,
} from '@khana/shared-dtos';
import { PreviewError, REQUEST_TIMEOUT_MS } from './booking-preview.models';
import { getDateAfterWeeks } from './booking-preview.recurrence';
import { BookingPreviewRouteCustomerBase } from './booking-preview.route-customer';

/**
 * Route-scoped facade for the booking preview page. The component inherits this
 * class so the route file stays small while the page keeps the same template API.
 */
@Directive()
export class BookingPreviewRouteFacade extends BookingPreviewRouteCustomerBase {
  constructor() {
    super();

    effect(() => {
      const sharedSelection = this.facilityContext.selectedFacilityId();
      if (!sharedSelection) {
        return;
      }
      if (sharedSelection === this.selectedFacilityId()) {
        return;
      }
      if (
        this.facilities().some((facility) => facility.id === sharedSelection)
      ) {
        this.selectedFacilityId.set(sharedSelection);
      }
    });

    this.registerEffects();
  }

  openConfirmDialog(): void {
    if (!this.canBook() || this.confirmDialogOpen()) {
      return;
    }

    this.confirmDialogOpen.set(true);
  }

  closeConfirmDialog(): void {
    if (this.bookingInProgress()) {
      return;
    }

    this.confirmDialogOpen.set(false);
  }

  onBook(): void {
    if (!this.canBook()) {
      return;
    }
    if (!this.isOnline()) {
      this.applyError(this.buildOfflineError('booking'));
      this.lastAction.set('booking');
      this.confirmDialogOpen.set(false);
      return;
    }

    this.enqueueBookingAction(() => this.executeBooking());
  }

  retry(): void {
    this.handleErrorRecovery('retry');
  }

  joinWaitlist(): void {
    if (!this.canJoinWaitlist()) {
      return;
    }

    const slotQuery = this.buildWaitlistStatusQuery();
    if (!slotQuery) {
      return;
    }

    if (!this.isOnline()) {
      this.waitlistError.set(this.t('CLIENT_ERRORS.WAITLIST.OFFLINE'));
      return;
    }

    this.joinWaitlistInProgress.set(true);
    this.waitlistError.set(null);

    this.api
      .joinBookingWaitlist({
        facilityId: slotQuery.facilityId,
        desiredTimeSlot: {
          startTime: slotQuery.startTime,
          endTime: slotQuery.endTime,
        },
      })
      .pipe(
        timeout(REQUEST_TIMEOUT_MS),
        catchError((err) => throwError(() => this.resolveError('preview', err)))
      )
      .subscribe({
        next: (response) => {
          this.joinWaitlistInProgress.set(false);
          const queuePosition =
            Number.isFinite(response.queuePosition) &&
            response.queuePosition > 0
              ? Math.floor(response.queuePosition)
              : null;
          this.waitlistStatus.set({
            isOnWaitlist: response.status === WaitlistStatus.WAITING,
            entryId: response.entryId,
            status: response.status,
            queuePosition: queuePosition ?? undefined,
          });
          this.showToast(
            queuePosition !== null
              ? this.t('BOOKING_PREVIEW.WAITLIST.JOIN_SUCCESS', {
                  position: queuePosition,
                })
              : this.t('BOOKING_PREVIEW.WAITLIST.ALREADY_JOINED'),
            'info'
          );
        },
        error: () => {
          this.joinWaitlistInProgress.set(false);
          this.waitlistError.set(this.t('CLIENT_ERRORS.WAITLIST.JOIN_FAILED'));
        },
      });
  }

  openWaitlistOperations(): void {
    const slotQuery = this.buildWaitlistStatusQuery();
    const date = this.selectedDate();
    const status = this.waitlistStatus()?.status;

    if (
      !slotQuery ||
      !date ||
      (status !== WaitlistStatus.WAITING && status !== WaitlistStatus.NOTIFIED)
    ) {
      return;
    }

    void this.router.navigate(['/dashboard/waitlist'], {
      queryParams: {
        date,
        facilityId: slotQuery.facilityId,
        status,
        slotStart: slotQuery.startTime,
        slotEnd: slotQuery.endTime,
        source: 'booking-preview',
      },
    });
  }

  toggleAlternatives(): void {
    this.alternativesExpanded.update((value) => !value);
  }

  onAlternativesScroll(event: Event): void {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return;
    }

    this.alternativesScrollTop.set(target.scrollTop);
  }

  resetBooking(): void {
    this.bookingSuccess.set(false);
    this.bookingReference.set(null);
    this.recurrenceGroupId.set(null);
    this.recurringCreatedCount.set(null);
    this.lastSuccessfulBookingMode.set(null);
    this.resetBookingDraftState();
    this.toast.set(null);
  }

  private enqueueBookingAction(action: () => Promise<void>): void {
    this.bookingQueue.push(action);
    if (this.bookingQueueRunning) {
      return;
    }

    this.runBookingQueue();
  }

  private async runBookingQueue(): Promise<void> {
    this.bookingQueueRunning = true;
    while (this.bookingQueue.length > 0) {
      const next = this.bookingQueue.shift();
      if (next) {
        await next();
      }
    }
    this.bookingQueueRunning = false;
  }

  private executeBooking(): Promise<void> {
    if (this.bookingInProgress()) {
      return Promise.resolve();
    }

    this.lastAction.set('booking');
    this.bookingInProgress.set(true);
    this.error.set(null);

    const startDateTime = new Date(
      `${this.selectedDate()}T${this.startTime()}`
    );
    const endDateTime = new Date(`${this.selectedDate()}T${this.endTime()}`);
    const submissionMode = this.bookingSubmissionMode();
    const status =
      submissionMode === 'HOLD' ? BookingStatus.PENDING : undefined;
    const payload: {
      facilityId: string;
      startTime: string;
      endTime: string;
      customerName: string;
      customerPhone: string;
      status?: BookingStatus;
      promoCode?: string;
    } = {
      facilityId: this.selectedFacilityId(),
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      customerName: this.customerName().trim(),
      customerPhone: this.customerPhone().trim(),
      status,
    };
    const isRecurring = this.repeatWeekly();
    if (!isRecurring) {
      const validPromoCode = this.getValidPromoCodeForBooking();
      if (validPromoCode) {
        payload.promoCode = validPromoCode;
      }
    }

    const recurringBasePayload = {
      facilityId: payload.facilityId,
      startTime: payload.startTime,
      endTime: payload.endTime,
      customerName: payload.customerName,
      customerPhone: payload.customerPhone,
      status: payload.status,
    };
    const recurringPayload = isRecurring
      ? {
          ...recurringBasePayload,
          recurrenceRule: {
            frequency: this.recurrenceFrequency(),
            intervalWeeks:
              this.recurrenceFrequency() === RecurrenceFrequency.BIWEEKLY
                ? 2
                : 1,
            // Weeks count represents a week horizon, not number of instances.
            // Convert COUNT mode to an end date so weekly/biweekly behave consistently.
            endsAtDate:
              this.recurrenceEndMode() === 'DATE'
                ? this.recurrenceEndDate().trim()
                : getDateAfterWeeks(
                    this.selectedDate(),
                    Math.max(0, Number(this.recurrenceWeeksCount()) - 1)
                  ),
          },
        }
      : null;

    return new Promise((resolve) => {
      const request$: Observable<unknown> =
        isRecurring && recurringPayload
          ? this.api.createRecurringBooking(recurringPayload)
          : this.api.createBooking(payload);

      request$
        .pipe(
          timeout(REQUEST_TIMEOUT_MS),
          catchError((err) =>
            throwError(() => this.resolveError('booking', err))
          )
        )
        .subscribe({
          next: (createdBooking: unknown) => {
            this.bookingInProgress.set(false);
            this.bookingSuccess.set(true);
            this.lastSuccessfulBookingMode.set(submissionMode);
            if (isRecurring) {
              const series = createdBooking as {
                recurrenceGroupId: string;
                createdCount: number;
                bookings: Array<{ bookingReference?: string }>;
              };
              this.bookingReference.set(
                series.bookings[0]?.bookingReference ?? null
              );
              this.recurrenceGroupId.set(series.recurrenceGroupId);
              this.recurringCreatedCount.set(series.createdCount);
            } else {
              const booking = createdBooking as { bookingReference?: string };
              this.bookingReference.set(booking.bookingReference ?? null);
              this.recurrenceGroupId.set(null);
              this.recurringCreatedCount.set(null);
            }
            this.confirmDialogOpen.set(false);
            this.showToast(
              submissionMode === 'HOLD'
                ? this.t(
                    isRecurring
                      ? 'BOOKING_PREVIEW.TOAST.RECURRING_BOOKING_ON_HOLD'
                      : 'BOOKING_PREVIEW.TOAST.BOOKING_ON_HOLD'
                  )
                : this.t(
                    isRecurring
                      ? 'BOOKING_PREVIEW.TOAST.RECURRING_BOOKING_CONFIRMED'
                      : 'BOOKING_PREVIEW.TOAST.BOOKING_CONFIRMED'
                  ),
              'success'
            );
            this.resetBookingDraftState();
            this.previewResult.set(null);
            this.lastAction.set(null);
            this.resetRetryState();
            resolve();
          },
          error: (err: PreviewError) => {
            this.bookingInProgress.set(false);
            this.confirmDialogOpen.set(false);
            this.handleRequestError('booking', err);
            resolve();
          },
        });
    });
  }

  protected extractApiMessage(err: unknown): string | null {
    if (!err || typeof err !== 'object') {
      return null;
    }

    const error = (err as { error?: { message?: string } }).error;
    if (typeof error?.message === 'string' && error.message.trim() !== '') {
      return error.message;
    }

    return null;
  }

  protected getPreviewErrorMessage(
    action: 'facilities' | 'preview' | 'booking'
  ): string {
    switch (action) {
      case 'facilities':
        return this.t('BOOKING_PREVIEW.ERRORS.LOAD_FACILITIES_FAILED');
      case 'preview':
        return this.t('BOOKING_PREVIEW.ERRORS.PREVIEW_FAILED');
      case 'booking':
      default:
        return this.t('BOOKING_PREVIEW.ERRORS.BOOKING_CREATE_FAILED');
    }
  }

  protected showToast(message: string, tone: 'success' | 'info'): void {
    this.toast.set({ message, tone });
    if (this.toastTimer) {
      window.clearTimeout(this.toastTimer);
    }

    this.toastTimer = window.setTimeout(() => {
      this.toast.set(null);
      this.toastTimer = null;
    }, 2500);
  }
}
