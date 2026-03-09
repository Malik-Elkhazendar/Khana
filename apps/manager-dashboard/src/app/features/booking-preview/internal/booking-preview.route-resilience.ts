import { Directive, effect } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TimeoutError, catchError, throwError, timeout } from 'rxjs';
import {
  AUTO_RETRY_BASE_DELAY_MS,
  AUTO_RETRY_JITTER_MS,
  AUTO_RETRY_MAX_ATTEMPTS,
  AUTO_RETRY_MAX_DELAY_MS,
  ErrorRecoveryAction,
  ErrorRecoveryOption,
  PreviewAction,
  PreviewError,
  PreviewErrorCategory,
  PreviewRequestPayload,
  REQUEST_TIMEOUT_MS,
} from './booking-preview.models';
import {
  buildWaitlistStatusQuery,
  isWaitlistSlotInFuture,
} from './booking-preview.waitlist';
import { BookingPreviewRoutePresentationBase } from './booking-preview.route-presentation';

@Directive()
export abstract class BookingPreviewRouteResilienceBase extends BookingPreviewRoutePresentationBase {
  protected abstract loadFacilities(): void;
  protected abstract executePreviewRequest(
    payload: PreviewRequestPayload,
    options: { ignoreCache: boolean }
  ): void;
  protected abstract showToast(message: string, tone: 'success' | 'info'): void;
  protected abstract extractApiMessage(err: unknown): string | null;
  protected abstract getPreviewErrorMessage(action: PreviewAction): string;
  abstract onSubmit(): void;
  abstract openConfirmDialog(): void;
  protected getErrorRecoveryOptions(
    category: PreviewErrorCategory
  ): ErrorRecoveryOption[] {
    switch (category) {
      case 'network':
        return [
          {
            action: 'retry',
            label: this.t('BOOKING_PREVIEW.RECOVERY.RETRY_NOW'),
            description: this.t(
              'BOOKING_PREVIEW.RECOVERY.NETWORK_RETRY_DESCRIPTION'
            ),
          },
          {
            action: 'dismiss',
            label: this.t('BOOKING_PREVIEW.RECOVERY.DISMISS'),
            description: this.t('BOOKING_PREVIEW.RECOVERY.KEEP_LAST_DATA'),
          },
        ];
      case 'server':
        return [
          {
            action: 'retry',
            label: this.t('BOOKING_PREVIEW.RECOVERY.RETRY_NOW'),
            description: this.t(
              'BOOKING_PREVIEW.RECOVERY.SERVER_RETRY_DESCRIPTION'
            ),
          },
          {
            action: 'refresh',
            label: this.t('BOOKING_PREVIEW.RECOVERY.REFRESH_DATA'),
            description: this.t(
              'BOOKING_PREVIEW.RECOVERY.SERVER_REFRESH_DESCRIPTION'
            ),
          },
        ];
      case 'validation':
        return [
          {
            action: 'dismiss',
            label: this.t('BOOKING_PREVIEW.RECOVERY.DISMISS'),
            description: this.t(
              'BOOKING_PREVIEW.RECOVERY.VALIDATION_DISMISS_DESCRIPTION'
            ),
          },
        ];
      case 'unknown':
      default:
        return [
          {
            action: 'retry',
            label: this.t('BOOKING_PREVIEW.RECOVERY.RETRY_NOW'),
            description: this.t(
              'BOOKING_PREVIEW.RECOVERY.UNKNOWN_RETRY_DESCRIPTION'
            ),
          },
          {
            action: 'dismiss',
            label: this.t('BOOKING_PREVIEW.RECOVERY.DISMISS'),
            description: this.t('BOOKING_PREVIEW.RECOVERY.KEEP_LAST_DATA'),
          },
        ];
    }
  }

  protected registerEffects(): void {
    effect(() => {
      const snapshot = this.stateSnapshot();
      this.recordStateSnapshot(snapshot);
      this.enforceStateConsistency(snapshot);
    });
    effect(() => {
      if (this.bookingSubmissionMode() !== 'HOLD') {
        return;
      }
      if (this.loading()) {
        return;
      }
      const result = this.previewResult();
      if (!result) {
        return;
      }
      if (!result.canBook || this.previewStale() || this.isPreviewStale()) {
        this.bookingSubmissionMode.set('CONFIRMED');
      }
    });
    effect((onCleanup) => {
      const scheduledAt = this.retryScheduledAt();
      if (!scheduledAt) {
        return;
      }
      this.nowTick.set(Date.now());
      const timer = window.setInterval(() => {
        this.nowTick.set(Date.now());
      }, 1000);
      onCleanup(() => window.clearInterval(timer));
    });
  }

  protected setupConnectivityListeners(): void {
    this.lastOnlineStatus = this.isOnline();
    const handler = () => {
      const online = this.resolveOnlineStatus();
      if (online === this.isOnline()) {
        return;
      }
      this.isOnline.set(online);
      if (online && !this.lastOnlineStatus) {
        this.flushOfflineQueue();
      }
      this.lastOnlineStatus = online;
    };

    this.connectivityHandler = handler;
    window.addEventListener('online', handler);
    window.addEventListener('offline', handler);

    this.destroyRef.onDestroy(() => {
      if (this.connectivityHandler) {
        window.removeEventListener('online', this.connectivityHandler);
        window.removeEventListener('offline', this.connectivityHandler);
      }
    });
  }

  protected startHeartbeat(): void {
    if (this.heartbeatTimer) {
      return;
    }
    this.heartbeatTimer = window.setInterval(() => {
      this.nowTick.set(Date.now());
    }, 30_000);
  }

  protected cleanup(): void {
    if (this.retryTimer) {
      window.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    if (this.heartbeatTimer) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.toastTimer) {
      window.clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
    if (this.phoneLookupTimer) {
      window.clearTimeout(this.phoneLookupTimer);
      this.phoneLookupTimer = null;
    }
    this.pendingActions.set([]);
    this.bookingQueue = [];
    this.bookingQueueRunning = false;
    this.clearTransientState();
  }

  protected clearTransientState(): void {
    this.previewResult.set(null);
    this.waitlistStatus.set(null);
    this.waitlistLoading.set(false);
    this.joinWaitlistInProgress.set(false);
    this.waitlistError.set(null);
    this.error.set(null);
    this.loading.set(false);
    this.facilitiesLoading.set(false);
    this.bookingInProgress.set(false);
    this.bookingSuccess.set(false);
    this.bookingReference.set(null);
    this.recurrenceGroupId.set(null);
    this.recurringCreatedCount.set(null);
    this.lastSuccessfulBookingMode.set(null);
    this.confirmDialogOpen.set(false);
    this.resetBookingDraftState();
    this.alternativesExpanded.set(false);
    this.alternativesScrollTop.set(0);
  }

  protected resetBookingDraftState(): void {
    this.customerName.set('');
    this.customerPhone.set('');
    this.matchedCustomer.set(null);
    this.lookupLoading.set(false);
    this.tagEditMode.set(false);
    this.availableTags.set([]);
    this.tenantTagsLoaded = false;
    this.bookingSubmissionMode.set('CONFIRMED');
  }

  protected enforceStateConsistency(snapshot: {
    loading: boolean;
    bookingInProgress: boolean;
    bookingSuccess: boolean;
    hasError: boolean;
    confirmDialogOpen: boolean;
  }): void {
    if (snapshot.loading && snapshot.bookingSuccess) {
      this.bookingSuccess.set(false);
    }
    if (snapshot.hasError && snapshot.loading) {
      this.loading.set(false);
    }
    if (snapshot.hasError && snapshot.bookingInProgress) {
      this.bookingInProgress.set(false);
    }
    if (snapshot.bookingSuccess && snapshot.confirmDialogOpen) {
      this.confirmDialogOpen.set(false);
    }
  }

  protected recordStateSnapshot(snapshot: {
    loading: boolean;
    facilitiesLoading: boolean;
    bookingInProgress: boolean;
    bookingSuccess: boolean;
    hasError: boolean;
    hasPreview: boolean;
    confirmDialogOpen: boolean;
  }): void {
    this.stateHistory.update((history) => {
      const next = [...history, snapshot];
      return next.length > 12 ? next.slice(next.length - 12) : next;
    });
  }

  protected resolveOnlineStatus(): boolean {
    if (typeof navigator === 'undefined') {
      return true;
    }

    return navigator.onLine ?? true;
  }

  protected queueOfflineAction(
    action: 'facilities' | 'preview',
    payload?: PreviewRequestPayload
  ): void {
    const queued = {
      action,
      payload,
      queuedAt: Date.now(),
    };

    // Keep only the latest action of each kind so reconnect replay reflects
    // the current form state, not every transient edit.
    this.pendingActions.update((actions) => {
      const remaining = actions.filter((item) => item.action !== action);
      return [...remaining, queued];
    });
  }

  protected flushOfflineQueue(): void {
    if (!this.isOnline()) {
      return;
    }

    const queued = this.pendingActions();
    this.pendingActions.set([]);
    for (const item of queued) {
      if (item.action === 'facilities') {
        this.loadFacilities();
      }
      if (item.action === 'preview' && item.payload) {
        this.executePreviewRequest(item.payload, { ignoreCache: true });
      }
    }

    if (this.lastAction() === 'booking') {
      this.showToast(
        this.t('BOOKING_PREVIEW.CONNECTION.BACK_ONLINE_CONFIRM'),
        'info'
      );
    }
  }

  protected handleRequestError(
    action: PreviewAction,
    error: PreviewError
  ): void {
    this.applyError(error);
    this.lastAction.set(action);
    if (action === 'booking') {
      this.bookingSuccess.set(false);
    }

    if (action === 'preview' && this.lastSuccessfulPreview()) {
      this.previewResult.set(this.lastSuccessfulPreview());
      this.previewStale.set(true);
    }

    if (this.shouldAutoRetry(action, error)) {
      this.scheduleAutoRetry(action);
    }
  }

  public handleErrorRecovery(action: ErrorRecoveryAction): void {
    const lastAction = this.lastAction() ?? this.error()?.action ?? null;
    if (!lastAction) {
      this.error.set(null);
      return;
    }
    if (action === 'dismiss') {
      this.error.set(null);
      this.clearRetry();
      return;
    }
    this.error.set(null);
    this.lastSubmitAt = 0;
    if (lastAction === 'facilities') {
      this.loadFacilities();
      return;
    }
    if (lastAction === 'preview') {
      const payload = this.lastPreviewRequest();
      if (payload) {
        this.executePreviewRequest(payload, { ignoreCache: true });
      } else {
        this.onSubmit();
      }
      return;
    }
    if (lastAction === 'booking') {
      this.openConfirmDialog();
    }
  }

  protected shouldAutoRetry(
    action: PreviewAction,
    error: PreviewError
  ): boolean {
    if (!this.isOnline()) {
      return false;
    }
    if (action === 'booking') {
      return false;
    }
    if (error.category !== 'network' && error.category !== 'server') {
      return false;
    }
    return this.retryAttempt() < AUTO_RETRY_MAX_ATTEMPTS;
  }

  protected scheduleAutoRetry(action: PreviewAction): void {
    if (this.retryTimer) {
      return;
    }
    const attempt = this.retryAttempt();
    if (attempt >= AUTO_RETRY_MAX_ATTEMPTS) {
      return;
    }
    const delay = this.getBackoffDelayMs(attempt);
    this.retryScheduledAt.set(Date.now() + delay);
    this.retryAction.set(action);
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = null;
      this.retryScheduledAt.set(null);
      this.retryAction.set(null);
      this.retryAttempt.set(attempt + 1);
      // Backoff applies only to preview and facility reads; booking submission
      // stays explicit to avoid duplicate reservations.
      if (!this.isOnline()) {
        if (action === 'preview') {
          const payload = this.lastPreviewRequest();
          if (payload) {
            this.queueOfflineAction('preview', payload);
          }
        } else {
          this.queueOfflineAction('facilities');
        }
        return;
      }

      if (action === 'facilities') {
        this.loadFacilities();
        return;
      }

      if (action === 'preview') {
        const payload = this.lastPreviewRequest();
        if (payload) {
          this.executePreviewRequest(payload, { ignoreCache: true });
        }
      }
    }, delay);
  }

  protected resetRetryState(): void {
    this.retryAttempt.set(0);
    this.clearRetry();
  }

  protected clearRetry(): void {
    if (this.retryTimer) {
      window.clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }

    this.retryScheduledAt.set(null);
    this.retryAction.set(null);
  }

  protected getBackoffDelayMs(attempt: number): number {
    const baseDelay = AUTO_RETRY_BASE_DELAY_MS * 2 ** attempt;
    const jitter = Math.floor(Math.random() * AUTO_RETRY_JITTER_MS);
    return Math.min(baseDelay + jitter, AUTO_RETRY_MAX_DELAY_MS);
  }

  protected buildOfflineError(action: PreviewAction): PreviewError {
    const baseMessage =
      action === 'booking'
        ? this.t('BOOKING_PREVIEW.ERRORS.OFFLINE_BOOKING')
        : this.t('BOOKING_PREVIEW.ERRORS.OFFLINE_RETRY');
    return {
      action,
      category: 'network',
      message: baseMessage,
      status: 0,
    };
  }

  protected resolveError(action: PreviewAction, err: unknown): PreviewError {
    const isTimeout =
      err instanceof TimeoutError ||
      (typeof err === 'object' &&
        err !== null &&
        (err as { name?: string }).name === 'TimeoutError');
    const status = this.extractStatus(err);
    const category = isTimeout ? 'network' : this.resolveCategory(status);

    let message = this.getPreviewErrorMessage(action);
    if (isTimeout) {
      message = this.t('BOOKING_PREVIEW.ERRORS.REQUEST_TIMEOUT');
    }
    if (action === 'preview' && status === 404) {
      message = this.t('BOOKING_PREVIEW.ERRORS.FACILITY_NOT_FOUND');
    }
    if (action === 'booking') {
      const apiMessage = this.extractApiMessage(err);
      if (apiMessage) {
        message = apiMessage;
      }
    }

    return {
      action,
      category,
      message,
      status,
    };
  }

  protected applyError(error: PreviewError): void {
    this.error.set(error);
  }

  protected resolveCategory(status?: number): PreviewErrorCategory {
    if (status === 0) {
      return 'network';
    }
    if (typeof status === 'number' && status >= 500) {
      return 'server';
    }
    if (typeof status === 'number' && status >= 400) {
      return 'validation';
    }
    return 'unknown';
  }

  protected extractStatus(err: unknown): number | undefined {
    if (!err || typeof err !== 'object') {
      return undefined;
    }

    const status = Number((err as { status?: number }).status);
    return Number.isFinite(status) ? status : undefined;
  }

  protected handleSlotSelectionChanged(): void {
    this.waitlistError.set(null);
    this.waitlistStatus.set(null);
    this.waitlistLoading.set(false);

    if (!this.inputsValid() || !this.selectedSlotIsInFuture()) {
      return;
    }

    this.refreshWaitlistStatus();
  }

  protected isSelectedSlotInFuture(): boolean {
    return isWaitlistSlotInFuture(this.buildWaitlistStatusQuery());
  }

  protected buildWaitlistStatusQuery(): {
    facilityId: string;
    startTime: string;
    endTime: string;
  } | null {
    return buildWaitlistStatusQuery({
      facilityId: this.selectedFacilityId(),
      selectedDate: this.selectedDate(),
      startTime: this.startTime(),
      endTime: this.endTime(),
      inputsValid: this.inputsValid(),
    });
  }

  protected refreshWaitlistStatus(): void {
    const query = this.buildWaitlistStatusQuery();
    if (!query || !this.selectedSlotIsInFuture()) {
      this.waitlistStatus.set(null);
      this.waitlistLoading.set(false);
      return;
    }

    this.waitlistLoading.set(true);
    this.waitlistError.set(null);
    const requestId = ++this.waitlistStatusRequestId;

    this.api
      .getBookingWaitlistStatus(query)
      .pipe(
        timeout(REQUEST_TIMEOUT_MS),
        takeUntilDestroyed(this.destroyRef),
        catchError((err) => throwError(() => this.resolveError('preview', err)))
      )
      .subscribe({
        next: (status) => {
          if (requestId !== this.waitlistStatusRequestId) {
            return;
          }

          this.waitlistStatus.set(status);
          this.waitlistLoading.set(false);
        },
        error: () => {
          if (requestId !== this.waitlistStatusRequestId) {
            return;
          }

          this.waitlistLoading.set(false);
          this.waitlistError.set(
            this.t('CLIENT_ERRORS.WAITLIST.STATUS_FAILED')
          );
        },
      });
  }

  protected getValidPromoCodeForBooking(): string | undefined {
    const promoValidation = this.previewResult()?.promoValidation;
    if (!promoValidation?.isValid || !promoValidation.code) {
      return undefined;
    }

    return promoValidation.code.trim().toUpperCase();
  }
}
