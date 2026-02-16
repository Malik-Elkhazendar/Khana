import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  Subject,
  TimeoutError,
  catchError,
  takeUntil,
  throwError,
  timeout,
} from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../../shared/services/api.service';
import {
  FacilityListItemDto,
  BookingPreviewResponseDto,
  AlternativeSlotDto,
  BookingStatus,
  ConflictType,
} from '@khana/shared-dtos';
import { ConfirmationDialogComponent } from '../../shared/components/confirmation-dialog.component';

type PreviewAction = 'facilities' | 'preview' | 'booking';
type PreviewErrorCategory = 'network' | 'validation' | 'server' | 'unknown';

type PreviewError = {
  action: PreviewAction;
  category: PreviewErrorCategory;
  message: string;
  status?: number;
};

type PreviewRequestPayload = {
  facilityId: string;
  startTime: string;
  endTime: string;
  promoCode?: string;
};

type OfflineAction = {
  action: Extract<PreviewAction, 'facilities' | 'preview'>;
  payload?: PreviewRequestPayload;
  queuedAt: number;
};

type ErrorRecoveryAction = 'retry' | 'refresh' | 'dismiss';
type ErrorRecoveryOption = {
  action: ErrorRecoveryAction;
  label: string;
  description: string;
};

type PreviewStateSnapshot = {
  loading: boolean;
  facilitiesLoading: boolean;
  bookingInProgress: boolean;
  bookingSuccess: boolean;
  hasError: boolean;
  hasPreview: boolean;
  confirmDialogOpen: boolean;
};

const PREVIEW_CACHE_TTL_MS = 2 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 15_000;
const AUTO_RETRY_MAX_ATTEMPTS = 3;
const AUTO_RETRY_BASE_DELAY_MS = 800;
const AUTO_RETRY_MAX_DELAY_MS = 8000;
const AUTO_RETRY_JITTER_MS = 200;
const SUBMIT_DEBOUNCE_MS = 300;
const STALE_PREVIEW_MS = 5 * 60 * 1000;
const ALTERNATIVES_EAGER_THRESHOLD = 6;
const ALTERNATIVES_VIRTUAL_THRESHOLD = 100;
const ALTERNATIVES_ROW_HEIGHT_PX = 72;
const ALTERNATIVES_WINDOW_SIZE = 18;
const PREVIEW_ERROR_MESSAGES: Record<PreviewAction, string> = {
  facilities: 'Failed to load facilities. Please try again.',
  preview: 'Failed to preview booking. Please try again.',
  booking: 'Failed to create booking. Please try again.',
};
const CONFIRM_COPY = {
  title: 'Confirm booking',
  message: 'Review the details before creating this booking.',
  confirmLabel: 'Confirm booking',
  cancelLabel: 'Go back',
};
const CANCELLATION_POLICY_NOTE =
  'Cancellations follow the facility policy. Please review before confirming.';

const ERROR_RECOVERY_OPTIONS: Record<
  PreviewErrorCategory,
  ErrorRecoveryOption[]
> = {
  network: [
    {
      action: 'retry',
      label: 'Retry now',
      description: 'Attempt the request again when the connection stabilizes.',
    },
    {
      action: 'dismiss',
      label: 'Dismiss',
      description: 'Keep the last available data for reference.',
    },
  ],
  server: [
    {
      action: 'retry',
      label: 'Retry now',
      description: 'Try again shortly in case the server recovered.',
    },
    {
      action: 'refresh',
      label: 'Refresh data',
      description: 'Fetch the latest information from the server.',
    },
  ],
  validation: [
    {
      action: 'dismiss',
      label: 'Dismiss',
      description: 'Review the inputs and try again.',
    },
  ],
  unknown: [
    {
      action: 'retry',
      label: 'Retry now',
      description: 'Try the request again.',
    },
    {
      action: 'dismiss',
      label: 'Dismiss',
      description: 'Keep the last available data for reference.',
    },
  ],
};

@Component({
  selector: 'app-booking-preview',
  standalone: true,
  imports: [CommonModule, FormsModule, ConfirmationDialogComponent],
  templateUrl: './booking-preview.component.html',
  styleUrl: './booking-preview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingPreviewComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly previewCache = new Map<
    string,
    { result: BookingPreviewResponseDto; expiresAt: number }
  >();
  readonly timezoneLabel = Intl.DateTimeFormat().resolvedOptions().timeZone;
  readonly confirmCopy = CONFIRM_COPY;
  readonly cancellationPolicyNote = CANCELLATION_POLICY_NOTE;

  private readonly previewAbort$ = new Subject<void>();
  private readonly facilitiesAbort$ = new Subject<void>();
  private bookingQueue: Array<() => Promise<void>> = [];
  private bookingQueueRunning = false;
  private previewRequestId = 0;
  private facilitiesRequestId = 0;
  private retryTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private lastSubmitAt = 0;
  private lastOnlineStatus = true;
  private inFlightPreviewKey: string | null = null;
  private toastTimer: number | null = null;
  private connectivityHandler?: () => void;

  // Form state
  facilities = signal<FacilityListItemDto[]>([]);
  selectedFacilityId = signal<string>('');
  selectedDate = signal<string>(this.getDefaultDate());
  startTime = signal<string>('10:00');
  endTime = signal<string>('11:00');
  promoCode = signal<string>('');

  // Result state
  previewResult = signal<BookingPreviewResponseDto | null>(null);
  loading = signal<boolean>(false);
  facilitiesLoading = signal<boolean>(false);
  error = signal<PreviewError | null>(null);
  lastAction = signal<'facilities' | 'preview' | 'booking' | null>(null);
  confirmDialogOpen = signal<boolean>(false);
  retryAttempt = signal<number>(0);
  retryScheduledAt = signal<number | null>(null);
  retryAction = signal<PreviewAction | null>(null);
  nowTick = signal<number>(Date.now());
  pendingActions = signal<OfflineAction[]>([]);
  previewStale = signal<boolean>(false);
  lastPreviewAt = signal<number | null>(null);
  lastSuccessfulPreview = signal<BookingPreviewResponseDto | null>(null);
  lastPreviewRequest = signal<PreviewRequestPayload | null>(null);
  alternativesExpanded = signal<boolean>(false);
  alternativesScrollTop = signal<number>(0);
  stateHistory = signal<PreviewStateSnapshot[]>([]);
  toast = signal<{ message: string; tone: 'success' | 'info' } | null>(null);

  // Customer details (shown when booking is available)
  customerName = signal<string>('');
  customerPhone = signal<string>('');
  holdAsPending = signal<boolean>(false);
  bookingInProgress = signal<boolean>(false);
  bookingSuccess = signal<boolean>(false);
  bookingReference = signal<string | null>(null);
  isOnline = signal<boolean>(this.resolveOnlineStatus());

  // Computed values
  selectedFacility = computed(() => {
    return this.facilities().find((f) => f.id === this.selectedFacilityId());
  });

  readonly inputsValid = computed(() => {
    return (
      this.selectedFacilityId().trim().length > 0 &&
      this.selectedDate().trim().length > 0 &&
      this.startTime().trim().length > 0 &&
      this.endTime().trim().length > 0 &&
      this.isValidTimeRange()
    );
  });

  canSubmit = computed(() => {
    return this.inputsValid() && !this.loading() && !this.facilitiesLoading();
  });

  canBook = computed(() => {
    const result = this.previewResult();
    return (
      Boolean(result?.canBook) &&
      this.customerName().trim() !== '' &&
      this.customerPhone().trim() !== '' &&
      !this.bookingInProgress() &&
      !this.loading()
    );
  });

  readonly errorRecoveryOptions = computed(() => {
    const error = this.error();
    if (!error) return [];
    return ERROR_RECOVERY_OPTIONS[error.category] ?? [];
  });

  readonly errorCategoryLabel = computed(() => {
    const error = this.error();
    if (!error) return '';
    switch (error.category) {
      case 'network':
        return 'Network issue';
      case 'server':
        return 'Server error';
      case 'validation':
        return 'Validation issue';
      default:
        return 'Unexpected error';
    }
  });

  readonly connectionMessage = computed(() => {
    if (this.isOnline()) return '';
    const queuedCount = this.pendingActions().length;
    if (queuedCount > 0) {
      return `Offline. ${queuedCount} request(s) queued for retry.`;
    }
    return 'Offline. We will retry when you are back online.';
  });

  readonly retryCountdown = computed(() => {
    const scheduledAt = this.retryScheduledAt();
    if (!scheduledAt) return null;
    const remainingMs = Math.max(0, scheduledAt - this.nowTick());
    return Math.ceil(remainingMs / 1000);
  });

  readonly retryAttemptMessage = computed(() => {
    if (!this.retryScheduledAt()) return '';
    const nextAttempt = Math.min(
      this.retryAttempt() + 1,
      AUTO_RETRY_MAX_ATTEMPTS
    );
    return `Attempt ${nextAttempt} of ${AUTO_RETRY_MAX_ATTEMPTS}`;
  });

  readonly isPreviewStale = computed(() => {
    const lastPreviewAt = this.lastPreviewAt();
    if (!lastPreviewAt) return false;
    return this.nowTick() - lastPreviewAt > STALE_PREVIEW_MS;
  });

  readonly alternatives = computed(() => {
    return this.previewResult()?.suggestedAlternatives ?? [];
  });

  readonly alternativesCount = computed(() => this.alternatives().length);

  readonly showAlternativesToggle = computed(() => {
    return this.alternativesCount() > ALTERNATIVES_EAGER_THRESHOLD;
  });

  readonly alternativesToggleLabel = computed(() => {
    return this.alternativesExpanded()
      ? 'Hide alternatives'
      : `View ${this.alternativesCount()} alternatives`;
  });

  readonly showAlternatives = computed(() => {
    if (this.alternativesCount() === 0) return false;
    if (!this.showAlternativesToggle()) return true;
    return this.alternativesExpanded();
  });

  readonly shouldVirtualizeAlternatives = computed(() => {
    return this.alternatives().length >= ALTERNATIVES_VIRTUAL_THRESHOLD;
  });

  readonly alternativesWindow = computed(() => {
    const alternatives = this.alternatives();
    if (!this.shouldVirtualizeAlternatives()) {
      return {
        items: alternatives,
        paddingTop: 0,
        paddingBottom: 0,
        totalHeight: 0,
      };
    }
    const scrollTop = this.alternativesScrollTop();
    const startIndex = Math.max(
      0,
      Math.floor(scrollTop / ALTERNATIVES_ROW_HEIGHT_PX) - 2
    );
    const endIndex = Math.min(
      alternatives.length,
      startIndex + ALTERNATIVES_WINDOW_SIZE
    );
    const paddingTop = startIndex * ALTERNATIVES_ROW_HEIGHT_PX;
    const paddingBottom =
      (alternatives.length - endIndex) * ALTERNATIVES_ROW_HEIGHT_PX;

    return {
      items: alternatives.slice(startIndex, endIndex),
      paddingTop,
      paddingBottom,
      totalHeight: alternatives.length * ALTERNATIVES_ROW_HEIGHT_PX,
    };
  });

  readonly validationErrors = computed(() => {
    const errors: string[] = [];
    if (this.selectedFacilityId().trim().length === 0) {
      errors.push('Facility is required');
    }
    if (this.selectedDate().trim().length === 0) {
      errors.push('Date is required');
    }
    if (this.startTime().trim().length === 0) {
      errors.push('Start time is required');
    }
    if (this.endTime().trim().length === 0) {
      errors.push('End time is required');
    }
    if (
      this.startTime().trim().length > 0 &&
      this.endTime().trim().length > 0 &&
      !this.isValidTimeRange()
    ) {
      errors.push('Start time must be before end time');
    }
    return errors;
  });

  readonly stateSnapshot = computed<PreviewStateSnapshot>(() => ({
    loading: this.loading(),
    facilitiesLoading: this.facilitiesLoading(),
    bookingInProgress: this.bookingInProgress(),
    bookingSuccess: this.bookingSuccess(),
    hasError: Boolean(this.error()),
    hasPreview: Boolean(this.previewResult()),
    confirmDialogOpen: this.confirmDialogOpen(),
  }));

  constructor() {
    this.registerEffects();
  }

  ngOnInit(): void {
    this.setupConnectivityListeners();
    this.startHeartbeat();
    this.loadFacilities();
    this.destroyRef.onDestroy(() => this.cleanup());
  }

  private loadFacilities(): void {
    this.lastAction.set('facilities');
    this.error.set(null);
    this.previewStale.set(false);
    if (!this.isOnline()) {
      this.facilitiesLoading.set(false);
      this.queueOfflineAction('facilities');
      this.applyError(this.buildOfflineError('facilities'));
      return;
    }

    this.resetRetryState();
    this.facilitiesLoading.set(true);
    this.facilitiesAbort$.next();
    const requestId = ++this.facilitiesRequestId;
    this.api
      .getFacilities()
      .pipe(
        timeout(REQUEST_TIMEOUT_MS),
        takeUntil(this.facilitiesAbort$),
        catchError((err) =>
          throwError(() => this.resolveError('facilities', err))
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (facilities) => {
          if (requestId !== this.facilitiesRequestId) return;
          this.facilities.set(facilities);
          if (facilities.length > 0) {
            this.selectedFacilityId.set(facilities[0].id);
          }
          this.lastAction.set(null);
          this.facilitiesLoading.set(false);
          this.resetRetryState();
        },
        error: (err: PreviewError) => {
          if (requestId !== this.facilitiesRequestId) return;
          this.facilitiesLoading.set(false);
          this.handleRequestError('facilities', err);
        },
      });
  }

  /**
   * Validates that the start time is before the end time.
   * Called from template for aria-invalid and input validation.
   * @returns True if start time < end time, false otherwise
   */
  isValidTimeRange(): boolean {
    const start = this.startTime().trim();
    const end = this.endTime().trim();
    if (!start || !end) return true;
    return start < end;
  }

  private getDefaultDate(): string {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }

  /**
   * Submits a booking preview request with the selected facility, date, and time.
   * Validates inputs, checks online status, and handles offline queueing.
   * Debounced to prevent rapid successive requests.
   */
  onSubmit(): void {
    if (!this.inputsValid()) return;
    const now = Date.now();
    if (now - this.lastSubmitAt < SUBMIT_DEBOUNCE_MS) return;
    this.lastSubmitAt = now;

    const startDateTime = new Date(
      `${this.selectedDate()}T${this.startTime()}`
    );
    const endDateTime = new Date(`${this.selectedDate()}T${this.endTime()}`);
    const payload = this.buildPreviewPayload(startDateTime, endDateTime);
    const lastPayload = this.lastPreviewRequest();
    if (
      this.loading() &&
      lastPayload &&
      this.isSamePayload(lastPayload, payload)
    ) {
      return;
    }

    this.lastAction.set('preview');
    this.loading.set(true);
    this.error.set(null);
    this.previewResult.set(null);
    this.previewStale.set(false);
    this.bookingSuccess.set(false);
    this.bookingReference.set(null);
    this.confirmDialogOpen.set(false);
    this.alternativesExpanded.set(false);
    this.alternativesScrollTop.set(0);
    this.resetRetryState();
    this.lastPreviewRequest.set(payload);

    if (!this.isOnline()) {
      this.loading.set(false);
      this.queueOfflineAction('preview', payload);
      this.applyError(this.buildOfflineError('preview'));
      return;
    }
    this.executePreviewRequest(payload, { ignoreCache: false });
  }

  /**
   * Selects an alternative slot and automatically submits a preview request.
   * Updates date, start time, and end time from the selected alternative.
   * @param alt - The alternative slot to select
   */
  selectAlternative(alt: AlternativeSlotDto): void {
    const startDate = new Date(alt.startTime);
    const endDate = new Date(alt.endTime);

    this.selectedDate.set(startDate.toISOString().split('T')[0]);
    this.startTime.set(startDate.toTimeString().slice(0, 5));
    this.endTime.set(endDate.toTimeString().slice(0, 5));

    this.onSubmit();
  }

  private executePreviewRequest(
    payload: PreviewRequestPayload,
    options: { ignoreCache: boolean }
  ): void {
    this.lastAction.set('preview');
    this.lastPreviewRequest.set(payload);
    const cacheKey = this.buildCacheKey(
      new Date(payload.startTime),
      new Date(payload.endTime),
      payload.facilityId,
      payload.promoCode
    );

    if (options.ignoreCache) {
      this.previewCache.delete(cacheKey);
    } else {
      const cached = this.previewCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        this.previewResult.set(cached.result);
        this.loading.set(false);
        this.lastAction.set(null);
        this.lastPreviewAt.set(Date.now());
        this.lastSuccessfulPreview.set(cached.result);
        this.previewStale.set(false);
        this.resetRetryState();
        return;
      }
    }

    if (this.loading() && this.inFlightPreviewKey === cacheKey) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.inFlightPreviewKey = cacheKey;
    this.previewAbort$.next();
    const requestId = ++this.previewRequestId;

    this.api
      .previewBooking(payload)
      .pipe(
        timeout(REQUEST_TIMEOUT_MS),
        takeUntil(this.previewAbort$),
        catchError((err) =>
          throwError(() => this.resolveError('preview', err))
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (result) => {
          if (requestId !== this.previewRequestId) return;
          this.previewResult.set(result);
          this.loading.set(false);
          this.previewCache.set(cacheKey, {
            result,
            expiresAt: Date.now() + PREVIEW_CACHE_TTL_MS,
          });
          this.lastAction.set(null);
          this.inFlightPreviewKey = null;
          this.lastPreviewAt.set(Date.now());
          this.lastSuccessfulPreview.set(result);
          this.previewStale.set(false);
          this.resetRetryState();
        },
        error: (err: PreviewError) => {
          if (requestId !== this.previewRequestId) return;
          this.loading.set(false);
          this.inFlightPreviewKey = null;
          this.handleRequestError('preview', err);
        },
      });
  }

  /**
   * Formats an ISO time string to a localized time display (HH:MM AM/PM).
   * @param isoString - ISO date-time string or null
   * @returns Formatted time string or empty string if null
   */
  formatTime(isoString: string | null | undefined): string {
    if (!isoString) return '';
    return new Date(isoString).toLocaleTimeString('en-SA', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  /**
   * Formats a numeric amount as currency in SAR.
   * @param amount - The numeric amount to format
   * @param currency - The ISO currency code (e.g., 'SAR')
   * @returns Formatted currency string
   */
  formatPrice(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-SA', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  }

  /**
   * Opens the booking confirmation dialog if booking is valid.
   * Prevents opening while booking is already in progress.
   */
  openConfirmDialog(): void {
    if (!this.canBook() || this.confirmDialogOpen()) return;
    this.confirmDialogOpen.set(true);
  }

  /**
   * Closes the booking confirmation dialog.
   * Prevents closing while booking is in progress.
   */
  closeConfirmDialog(): void {
    if (this.bookingInProgress()) return;
    this.confirmDialogOpen.set(false);
  }

  /**
   * Initiates a booking request with current customer details and preview.
   * Enqueues the booking action to be processed in order.
   * Handles offline state by showing error and clearing dialog.
   */
  onBook(): void {
    if (!this.canBook()) return;
    if (!this.isOnline()) {
      this.applyError(this.buildOfflineError('booking'));
      this.lastAction.set('booking');
      this.confirmDialogOpen.set(false);
      return;
    }

    this.enqueueBookingAction(() => this.executeBooking());
  }

  /**
   * Retries the last failed operation.
   * Shorthand for handleErrorRecovery('retry').
   */
  retry(): void {
    this.handleErrorRecovery('retry');
  }

  /**
   * Handles error recovery actions: retry, refresh, or dismiss.
   * Clears errors and initiates appropriate recovery action based on error category.
   * @param action - The recovery action to perform
   */
  handleErrorRecovery(action: ErrorRecoveryAction): void {
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

  /**
   * Toggles the visibility of alternative booking slots.
   * Used to collapse/expand the alternatives section for large lists.
   */
  toggleAlternatives(): void {
    this.alternativesExpanded.update((value) => !value);
  }

  /**
   * Handles scroll events on the alternatives list.
   * Updates scroll position for virtual scrolling calculations.
   * @param event - The scroll event from alternatives container
   */
  onAlternativesScroll(event: Event): void {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    this.alternativesScrollTop.set(target.scrollTop);
  }

  /**
   * Resets booking success state and customer details.
   * Clears the form to prepare for a new booking.
   */
  resetBooking(): void {
    this.bookingSuccess.set(false);
    this.bookingReference.set(null);
    this.customerName.set('');
    this.customerPhone.set('');
    this.holdAsPending.set(false);
    this.toast.set(null);
  }

  /**
   * Formats a conflict type enum value to a human-readable message.
   * @param type - The conflict type enum value
   * @returns Descriptive message about the type of conflict
   */
  formatConflictType(type: ConflictType | undefined): string {
    switch (type) {
      case ConflictType.EXACT_OVERLAP:
        return 'Exact overlap with an existing booking';
      case ConflictType.CONTAINED_WITHIN:
        return 'Requested time falls within an existing booking';
      case ConflictType.PARTIAL_START_OVERLAP:
        return 'Requested start overlaps an existing booking';
      case ConflictType.PARTIAL_END_OVERLAP:
        return 'Requested end overlaps an existing booking';
      case ConflictType.CONTAINS_EXISTING:
        return 'Requested time contains an existing booking';
      default:
        return 'Conflict detected';
    }
  }

  private enqueueBookingAction(action: () => Promise<void>): void {
    this.bookingQueue.push(action);
    if (this.bookingQueueRunning) return;
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
    const payload = {
      facilityId: this.selectedFacilityId(),
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      customerName: this.customerName().trim(),
      customerPhone: this.customerPhone().trim(),
      status: this.holdAsPending() ? BookingStatus.PENDING : undefined,
    };

    return new Promise((resolve) => {
      this.api
        .createBooking(payload)
        .pipe(
          timeout(REQUEST_TIMEOUT_MS),
          catchError((err) =>
            throwError(() => this.resolveError('booking', err))
          ),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe({
          next: (createdBooking) => {
            this.bookingInProgress.set(false);
            this.bookingSuccess.set(true);
            this.bookingReference.set(createdBooking.bookingReference ?? null);
            this.confirmDialogOpen.set(false);
            this.showToast('Booking confirmed', 'success');
            // Reset form for next booking
            this.customerName.set('');
            this.customerPhone.set('');
            this.holdAsPending.set(false);
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

  private buildPreviewPayload(
    startDateTime: Date,
    endDateTime: Date
  ): PreviewRequestPayload {
    return {
      facilityId: this.selectedFacilityId(),
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      promoCode: this.promoCode().trim() || undefined,
    };
  }

  private isSamePayload(
    first: PreviewRequestPayload,
    second: PreviewRequestPayload
  ): boolean {
    return (
      first.facilityId === second.facilityId &&
      first.startTime === second.startTime &&
      first.endTime === second.endTime &&
      (first.promoCode ?? '').trim().toUpperCase() ===
        (second.promoCode ?? '').trim().toUpperCase()
    );
  }

  private buildCacheKey(
    startDateTime: Date,
    endDateTime: Date,
    facilityId: string = this.selectedFacilityId(),
    promoCode: string | undefined = this.promoCode()
  ): string {
    const promo = (promoCode ?? '').trim().toUpperCase();
    return [
      facilityId,
      startDateTime.toISOString(),
      endDateTime.toISOString(),
      promo,
    ].join('|');
  }

  private showToast(message: string, tone: 'success' | 'info'): void {
    this.toast.set({ message, tone });
    if (this.toastTimer) {
      window.clearTimeout(this.toastTimer);
    }
    this.toastTimer = window.setTimeout(() => {
      this.toast.set(null);
      this.toastTimer = null;
    }, 2500);
  }

  private registerEffects(): void {
    effect(() => {
      const snapshot = this.stateSnapshot();
      this.recordStateSnapshot(snapshot);
      this.enforceStateConsistency(snapshot);
    });

    effect((onCleanup) => {
      const scheduledAt = this.retryScheduledAt();
      if (!scheduledAt) return;
      this.nowTick.set(Date.now());
      const timer = window.setInterval(() => {
        this.nowTick.set(Date.now());
      }, 1000);
      onCleanup(() => window.clearInterval(timer));
    });
  }

  private setupConnectivityListeners(): void {
    this.lastOnlineStatus = this.isOnline();
    const handler = () => {
      const online = this.resolveOnlineStatus();
      if (online === this.isOnline()) return;
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

  private startHeartbeat(): void {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = window.setInterval(() => {
      this.nowTick.set(Date.now());
    }, 30_000);
  }

  private cleanup(): void {
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
    this.previewAbort$.next();
    this.facilitiesAbort$.next();
    this.previewAbort$.complete();
    this.facilitiesAbort$.complete();
    this.pendingActions.set([]);
    this.bookingQueue = [];
    this.bookingQueueRunning = false;
    this.clearTransientState();
  }

  private clearTransientState(): void {
    this.previewResult.set(null);
    this.error.set(null);
    this.loading.set(false);
    this.facilitiesLoading.set(false);
    this.bookingInProgress.set(false);
    this.bookingSuccess.set(false);
    this.bookingReference.set(null);
    this.confirmDialogOpen.set(false);
    this.customerName.set('');
    this.customerPhone.set('');
    this.holdAsPending.set(false);
    this.alternativesExpanded.set(false);
    this.alternativesScrollTop.set(0);
  }

  private enforceStateConsistency(snapshot: PreviewStateSnapshot): void {
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

  private recordStateSnapshot(snapshot: PreviewStateSnapshot): void {
    this.stateHistory.update((history) => {
      const next = [...history, snapshot];
      return next.length > 12 ? next.slice(next.length - 12) : next;
    });
  }

  private resolveOnlineStatus(): boolean {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine ?? true;
  }

  private queueOfflineAction(
    action: OfflineAction['action'],
    payload?: PreviewRequestPayload
  ): void {
    const queued: OfflineAction = {
      action,
      payload,
      queuedAt: Date.now(),
    };
    this.pendingActions.update((actions) => {
      const remaining = actions.filter((item) => item.action !== action);
      return [...remaining, queued];
    });
  }

  private flushOfflineQueue(): void {
    if (!this.isOnline()) return;
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
        'You are back online. Please confirm the booking.',
        'info'
      );
    }
  }

  private handleRequestError(action: PreviewAction, error: PreviewError): void {
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

  private shouldAutoRetry(action: PreviewAction, error: PreviewError): boolean {
    if (!this.isOnline()) return false;
    if (action === 'booking') return false;
    if (error.category !== 'network' && error.category !== 'server') {
      return false;
    }
    return this.retryAttempt() < AUTO_RETRY_MAX_ATTEMPTS;
  }

  private scheduleAutoRetry(action: PreviewAction): void {
    if (this.retryTimer) return;
    const attempt = this.retryAttempt();
    if (attempt >= AUTO_RETRY_MAX_ATTEMPTS) return;
    const delay = this.getBackoffDelayMs(attempt);

    this.retryScheduledAt.set(Date.now() + delay);
    this.retryAction.set(action);
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = null;
      this.retryScheduledAt.set(null);
      this.retryAction.set(null);
      this.retryAttempt.set(attempt + 1);

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
    this.retryAction.set(null);
  }

  private getBackoffDelayMs(attempt: number): number {
    const baseDelay = AUTO_RETRY_BASE_DELAY_MS * 2 ** attempt;
    const jitter = Math.floor(Math.random() * AUTO_RETRY_JITTER_MS);
    return Math.min(baseDelay + jitter, AUTO_RETRY_MAX_DELAY_MS);
  }

  private buildOfflineError(action: PreviewAction): PreviewError {
    const baseMessage =
      action === 'booking'
        ? 'You are offline. Please reconnect to complete the booking.'
        : 'You are offline. We will retry when you are back online.';
    return {
      action,
      category: 'network',
      message: baseMessage,
      status: 0,
    };
  }

  private resolveError(action: PreviewAction, err: unknown): PreviewError {
    const isTimeout =
      err instanceof TimeoutError ||
      (typeof err === 'object' &&
        err !== null &&
        (err as { name?: string }).name === 'TimeoutError');
    const status = this.extractStatus(err);
    const category = isTimeout ? 'network' : this.resolveCategory(status);

    let message = PREVIEW_ERROR_MESSAGES[action];
    if (isTimeout) {
      message = 'Request timed out. Please try again.';
    }
    if (action === 'preview' && status === 404) {
      message = 'Facility not found.';
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

  private applyError(error: PreviewError): void {
    this.error.set(error);
  }

  private resolveCategory(status?: number): PreviewErrorCategory {
    if (status === 0) return 'network';
    if (typeof status === 'number' && status >= 500) return 'server';
    if (typeof status === 'number' && status >= 400) return 'validation';
    return 'unknown';
  }

  private extractStatus(err: unknown): number | undefined {
    if (!err || typeof err !== 'object') return undefined;
    const status = Number((err as { status?: number }).status);
    return Number.isFinite(status) ? status : undefined;
  }

  private extractApiMessage(err: unknown): string | null {
    if (!err || typeof err !== 'object') return null;
    const error = (err as { error?: { message?: string } }).error;
    if (typeof error?.message === 'string' && error.message.trim() !== '') {
      return error.message;
    }
    return null;
  }
}
