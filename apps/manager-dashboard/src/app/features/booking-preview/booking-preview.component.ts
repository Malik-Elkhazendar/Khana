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
import { TranslateService } from '@ngx-translate/core';
import {
  Observable,
  Subject,
  TimeoutError,
  catchError,
  takeUntil,
  throwError,
  timeout,
} from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiService } from '../../shared/services/api.service';
import { LanguageService } from '../../shared/services/language.service';
import { LocaleFormatService } from '../../shared/services/locale-format.service';
import { FacilityContextStore } from '../../shared/state';
import {
  FacilityListItemDto,
  BookingPreviewResponseDto,
  AlternativeSlotDto,
  BookingStatus,
  ConflictType,
  PromoValidationReason,
  RecurrenceFrequency,
  WaitlistStatus,
  WaitlistStatusResponseDto,
} from '@khana/shared-dtos';
import { ConfirmationDialogComponent } from '../../shared/components/confirmation-dialog.component';
import {
  UiStatusBadgeComponent,
  UiToastComponent,
} from '../../shared/components';

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

type RecurrenceEndMode = 'COUNT' | 'DATE';

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
type ConflictSlotDto = NonNullable<
  BookingPreviewResponseDto['conflict']
>['conflictingSlots'][number];

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

@Component({
  selector: 'app-booking-preview',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ConfirmationDialogComponent,
    UiStatusBadgeComponent,
    UiToastComponent,
  ],
  templateUrl: './booking-preview.component.html',
  styleUrl: './booking-preview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BookingPreviewComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly facilityContext = inject(FacilityContextStore);
  private readonly languageService = inject(LanguageService, {
    optional: true,
  });
  private readonly localeFormat = inject(LocaleFormatService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly translateService = inject(TranslateService, {
    optional: true,
  });
  private readonly previewCache = new Map<
    string,
    { result: BookingPreviewResponseDto; expiresAt: number }
  >();
  readonly timezoneLabel = Intl.DateTimeFormat().resolvedOptions().timeZone;
  readonly inputLang = computed(() =>
    this.localeFormat.getCurrentLocale() === 'ar-SA' ? 'ar' : 'en'
  );
  readonly WaitlistStatus = WaitlistStatus;

  get confirmCopy(): {
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
  } {
    return {
      title: this.t('BOOKING_PREVIEW.DIALOG.CONFIRM_TITLE'),
      message: this.t('BOOKING_PREVIEW.DIALOG.CONFIRM_MESSAGE'),
      confirmLabel: this.t('BOOKING_PREVIEW.DIALOG.CONFIRM_LABEL'),
      cancelLabel: this.t('BOOKING_PREVIEW.DIALOG.CANCEL_LABEL'),
    };
  }

  get cancellationPolicyNote(): string {
    return this.t('BOOKING_PREVIEW.DIALOG.CANCELLATION_POLICY_NOTE');
  }

  private readonly previewAbort$ = new Subject<void>();
  private readonly facilitiesAbort$ = new Subject<void>();
  private readonly waitlistStatusAbort$ = new Subject<void>();
  private bookingQueue: Array<() => Promise<void>> = [];
  private bookingQueueRunning = false;
  private previewRequestId = 0;
  private facilitiesRequestId = 0;
  private waitlistStatusRequestId = 0;
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
  repeatWeekly = signal<boolean>(false);
  recurrenceFrequency = signal<RecurrenceFrequency>(RecurrenceFrequency.WEEKLY);
  recurrenceEndMode = signal<RecurrenceEndMode>('COUNT');
  recurrenceWeeksCount = signal<number>(8);
  recurrenceEndDate = signal<string>('');

  // Result state
  previewResult = signal<BookingPreviewResponseDto | null>(null);
  waitlistStatus = signal<WaitlistStatusResponseDto | null>(null);
  waitlistLoading = signal<boolean>(false);
  joinWaitlistInProgress = signal<boolean>(false);
  waitlistError = signal<string | null>(null);
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
  recurringCreatedCount = signal<number | null>(null);
  recurrenceGroupId = signal<string | null>(null);
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

  readonly recurrenceControlsValid = computed(() => {
    if (!this.repeatWeekly()) {
      return true;
    }

    if (this.recurrenceEndMode() === 'COUNT') {
      const count = Number(this.recurrenceWeeksCount());
      return Number.isInteger(count) && count >= 1 && count <= 104;
    }

    const endDate = this.recurrenceEndDate().trim();
    if (!endDate) {
      return false;
    }
    return endDate >= this.selectedDate();
  });

  readonly showWeeksCountField = computed(
    () => this.repeatWeekly() && this.recurrenceEndMode() === 'COUNT'
  );

  readonly showEndDateField = computed(
    () => this.repeatWeekly() && this.recurrenceEndMode() === 'DATE'
  );

  canSubmit = computed(() => {
    return this.inputsValid() && !this.loading() && !this.facilitiesLoading();
  });

  canBook = computed(() => {
    const result = this.previewResult();
    return (
      Boolean(result?.canBook) &&
      this.customerName().trim() !== '' &&
      this.customerPhone().trim() !== '' &&
      this.recurrenceControlsValid() &&
      !this.bookingInProgress() &&
      !this.loading()
    );
  });

  readonly errorRecoveryOptions = computed(() => {
    const error = this.error();
    if (!error) return [];
    return this.getErrorRecoveryOptions(error.category);
  });

  readonly errorCategoryLabel = computed(() => {
    const error = this.error();
    if (!error) return '';
    switch (error.category) {
      case 'network':
        return this.t('BOOKING_PREVIEW.ERROR_CATEGORY.NETWORK');
      case 'server':
        return this.t('BOOKING_PREVIEW.ERROR_CATEGORY.SERVER');
      case 'validation':
        return this.t('BOOKING_PREVIEW.ERROR_CATEGORY.VALIDATION');
      default:
        return this.t('BOOKING_PREVIEW.ERROR_CATEGORY.UNKNOWN');
    }
  });

  readonly connectionMessage = computed(() => {
    if (this.isOnline()) return '';
    const queuedCount = this.pendingActions().length;
    if (queuedCount > 0) {
      return this.t('BOOKING_PREVIEW.CONNECTION.OFFLINE_QUEUED', {
        count: queuedCount,
      });
    }
    return this.t('BOOKING_PREVIEW.CONNECTION.OFFLINE_RETRY');
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
    return this.t('BOOKING_PREVIEW.RETRY.ATTEMPT_OF_MAX', {
      attempt: nextAttempt,
      max: AUTO_RETRY_MAX_ATTEMPTS,
    });
  });

  readonly isPreviewStale = computed(() => {
    const lastPreviewAt = this.lastPreviewAt();
    if (!lastPreviewAt) return false;
    return this.nowTick() - lastPreviewAt > STALE_PREVIEW_MS;
  });

  readonly alternatives = computed(() => {
    return this.previewResult()?.suggestedAlternatives ?? [];
  });

  readonly isOnWaitlist = computed(
    () => this.waitlistStatus()?.status === WaitlistStatus.WAITING
  );

  readonly waitlistQueuePosition = computed(
    () => this.waitlistStatus()?.queuePosition ?? null
  );

  readonly canJoinWaitlist = computed(() => {
    const result = this.previewResult();
    return (
      result !== null &&
      result.canBook === false &&
      this.inputsValid() &&
      this.isSelectedSlotInFuture() &&
      !this.waitlistLoading() &&
      !this.joinWaitlistInProgress() &&
      !this.isOnWaitlist()
    );
  });

  readonly promoValidation = computed(
    () => this.previewResult()?.promoValidation ?? null
  );

  readonly promoValidationMessage = computed(() => {
    const promoValidation = this.promoValidation();
    if (!promoValidation || promoValidation.isValid) {
      return null;
    }
    return this.t(
      this.promoValidationReasonKey(promoValidation.reason),
      promoValidation.reason === PromoValidationReason.USAGE_EXCEEDED &&
        typeof promoValidation.discountValue === 'number'
        ? { value: promoValidation.discountValue }
        : undefined
    );
  });

  readonly promoAppliedMessage = computed(() => {
    const promoValidation = this.promoValidation();
    if (!promoValidation?.isValid || !promoValidation.code) {
      return null;
    }
    return this.t('BOOKING_PREVIEW.PROMO_VALIDATION.VALID', {
      code: promoValidation.code,
    });
  });

  readonly alternativesCount = computed(() => this.alternatives().length);

  readonly showAlternativesToggle = computed(() => {
    return this.alternativesCount() > ALTERNATIVES_EAGER_THRESHOLD;
  });

  readonly alternativesToggleLabel = computed(() => {
    return this.alternativesExpanded()
      ? this.t('BOOKING_PREVIEW.ALTERNATIVES.HIDE')
      : this.t('BOOKING_PREVIEW.ALTERNATIVES.VIEW_COUNT', {
          count: this.alternativesCount(),
        });
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
      errors.push(this.t('BOOKING_PREVIEW.VALIDATION.FACILITY_REQUIRED'));
    }
    if (this.selectedDate().trim().length === 0) {
      errors.push(this.t('BOOKING_PREVIEW.VALIDATION.DATE_REQUIRED'));
    }
    if (this.startTime().trim().length === 0) {
      errors.push(this.t('BOOKING_PREVIEW.VALIDATION.START_TIME_REQUIRED'));
    }
    if (this.endTime().trim().length === 0) {
      errors.push(this.t('BOOKING_PREVIEW.VALIDATION.END_TIME_REQUIRED'));
    }
    if (
      this.startTime().trim().length > 0 &&
      this.endTime().trim().length > 0 &&
      !this.isValidTimeRange()
    ) {
      errors.push(this.t('BOOKING_PREVIEW.VALIDATION.START_BEFORE_END'));
    }
    if (this.repeatWeekly()) {
      if (this.recurrenceEndMode() === 'COUNT') {
        const count = Number(this.recurrenceWeeksCount());
        if (!Number.isInteger(count) || count < 1 || count > 104) {
          errors.push(
            this.t('BOOKING_PREVIEW.VALIDATION.REPEAT_COUNT_INVALID')
          );
        }
      } else {
        const endDate = this.recurrenceEndDate().trim();
        if (!endDate || endDate < this.selectedDate()) {
          errors.push(
            this.t('BOOKING_PREVIEW.VALIDATION.REPEAT_END_DATE_INVALID')
          );
        }
      }
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
    effect(() => {
      const sharedSelection = this.facilityContext.selectedFacilityId();
      if (!sharedSelection) return;
      if (sharedSelection === this.selectedFacilityId()) return;
      if (
        this.facilities().some((facility) => facility.id === sharedSelection)
      ) {
        this.selectedFacilityId.set(sharedSelection);
      }
    });

    this.registerEffects();
  }

  ngOnInit(): void {
    this.facilityContext.initialize();
    this.setupConnectivityListeners();
    this.startHeartbeat();
    this.recurrenceEndDate.set(this.getDefaultRecurrenceEndDate());
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
          const sharedSelection = this.facilityContext.selectedFacilityId();
          const nextSelection =
            sharedSelection &&
            facilities.some((facility) => facility.id === sharedSelection)
              ? sharedSelection
              : facilities[0]?.id ?? '';
          this.selectedFacilityId.set(nextSelection);
          this.facilityContext.selectFacility(nextSelection || null);
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

  onFacilitySelectionChange(facilityId: string): void {
    this.selectedFacilityId.set(facilityId);
    this.facilityContext.selectFacility(facilityId || null);
    this.handleSlotSelectionChanged();
  }

  onDateChange(value: string): void {
    this.selectedDate.set(value);
    this.handleSlotSelectionChanged();
    if (!this.repeatWeekly()) {
      return;
    }

    if (this.recurrenceEndMode() === 'COUNT') {
      this.syncEndDateFromWeeksCount();
      return;
    }

    if (this.recurrenceEndDate().trim() && this.recurrenceEndDate() < value) {
      this.recurrenceEndDate.set(value);
      this.syncWeeksCountFromEndDate(value);
    }
  }

  onRepeatWeeklyChange(value: boolean): void {
    this.repeatWeekly.set(value);
    if (!value) {
      return;
    }
    if (this.recurrenceEndMode() === 'COUNT') {
      this.syncEndDateFromWeeksCount();
      return;
    }
    if (!this.recurrenceEndDate().trim()) {
      this.recurrenceEndDate.set(this.getDefaultRecurrenceEndDate());
    }
  }

  onRecurrenceFrequencyChange(value: string): void {
    if (value === RecurrenceFrequency.BIWEEKLY) {
      this.recurrenceFrequency.set(RecurrenceFrequency.BIWEEKLY);
      return;
    }
    this.recurrenceFrequency.set(RecurrenceFrequency.WEEKLY);
  }

  onRecurrenceEndModeChange(value: string): void {
    const mode: RecurrenceEndMode = value === 'DATE' ? 'DATE' : 'COUNT';
    this.recurrenceEndMode.set(mode);
    if (mode === 'COUNT') {
      this.syncEndDateFromWeeksCount();
      return;
    }
    if (!this.recurrenceEndDate().trim()) {
      this.recurrenceEndDate.set(this.getDefaultRecurrenceEndDate());
    }
  }

  onRecurrenceWeeksCountChange(value: string | number): void {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      this.recurrenceWeeksCount.set(1);
      if (this.repeatWeekly() && this.recurrenceEndMode() === 'COUNT') {
        this.syncEndDateFromWeeksCount();
      }
      return;
    }
    const normalized = Math.min(104, Math.max(1, Math.trunc(parsed)));
    this.recurrenceWeeksCount.set(normalized);
    if (this.repeatWeekly() && this.recurrenceEndMode() === 'COUNT') {
      this.syncEndDateFromWeeksCount();
    }
  }

  onRecurrenceEndDateChange(value: string): void {
    if (!value) {
      this.recurrenceEndDate.set('');
      return;
    }
    const normalized =
      value < this.selectedDate() ? this.selectedDate() : value.trim();
    this.recurrenceEndDate.set(normalized);
    this.syncWeeksCountFromEndDate(normalized);
  }

  onStartTimeChange(value: string): void {
    this.startTime.set(value);
    this.handleSlotSelectionChanged();
  }

  onEndTimeChange(value: string): void {
    this.endTime.set(value);
    this.handleSlotSelectionChanged();
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

  private getDateAfterWeeks(baseDateIso: string, weeks: number): string {
    const [year, month, day] = baseDateIso
      .split('-')
      .map((value) => Number(value));

    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month) ||
      !Number.isInteger(day)
    ) {
      return baseDateIso;
    }

    const normalizedWeeks = Number.isFinite(weeks) ? Math.trunc(weeks) : 0;
    const baseDate = new Date(Date.UTC(year, month - 1, day));
    baseDate.setUTCDate(baseDate.getUTCDate() + normalizedWeeks * 7);
    return baseDate.toISOString().split('T')[0];
  }

  private getDefaultRecurrenceEndDate(): string {
    const horizonWeeks = Math.max(0, Number(this.recurrenceWeeksCount()) - 1);
    return this.getDateAfterWeeks(this.selectedDate(), horizonWeeks);
  }

  private syncEndDateFromWeeksCount(): void {
    this.recurrenceEndDate.set(this.getDefaultRecurrenceEndDate());
  }

  private syncWeeksCountFromEndDate(endDateIso: string): void {
    const days = this.getDayDifference(this.selectedDate(), endDateIso);
    const weeksCount = Math.floor(Math.max(0, days) / 7) + 1;
    this.recurrenceWeeksCount.set(Math.min(104, Math.max(1, weeksCount)));
  }

  private getDayDifference(startIso: string, endIso: string): number {
    const parseIsoDate = (value: string): Date | null => {
      const [year, month, day] = value.split('-').map((part) => Number(part));
      if (
        !Number.isInteger(year) ||
        !Number.isInteger(month) ||
        !Number.isInteger(day)
      ) {
        return null;
      }
      return new Date(Date.UTC(year, month - 1, day));
    };

    const startDate = parseIsoDate(startIso);
    const endDate = parseIsoDate(endIso);
    if (!startDate || !endDate) {
      return 0;
    }

    const msPerDay = 24 * 60 * 60 * 1000;
    return Math.floor((endDate.getTime() - startDate.getTime()) / msPerDay);
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
    this.recurrenceGroupId.set(null);
    this.recurringCreatedCount.set(null);
    this.confirmDialogOpen.set(false);
    this.alternativesExpanded.set(false);
    this.alternativesScrollTop.set(0);
    this.waitlistStatus.set(null);
    this.waitlistError.set(null);
    this.waitlistLoading.set(false);
    this.joinWaitlistInProgress.set(false);
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
        if (cached.result.canBook) {
          this.waitlistStatus.set(null);
          this.waitlistLoading.set(false);
          this.waitlistError.set(null);
        } else {
          this.refreshWaitlistStatus();
        }
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
          if (result.canBook) {
            this.waitlistStatus.set(null);
            this.waitlistLoading.set(false);
            this.waitlistError.set(null);
          } else {
            this.refreshWaitlistStatus();
          }
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
    return this.localeFormat.formatDate(isoString, {
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
    return this.localeFormat.formatCurrency(amount, currency);
  }

  facilityOptionLabel(facility: FacilityListItemDto): string {
    // Keep native select option labels single-direction to avoid bidi reordering glitches.
    return facility.name;
  }

  selectedFacilityRateLabel(): string {
    const facility = this.selectedFacility();
    if (!facility) return '';
    return `${this.formatPrice(
      facility.basePrice,
      facility.currency
    )}/${this.text('BOOKING_PREVIEW.FORM.HOUR_SUFFIX')}`;
  }

  text(key: string, params?: Record<string, string | number>): string {
    return this.t(key, params);
  }

  retryCountdownMessage(seconds: number): string {
    return this.t('BOOKING_PREVIEW.RETRY.COUNTDOWN', {
      seconds,
      attempt: this.retryAttemptMessage(),
    });
  }

  alternativeSlotAriaLabel(alt: AlternativeSlotDto): string {
    const start = this.formatTime(alt.startTime);
    const end = this.formatTime(alt.endTime);
    return this.t('BOOKING_PREVIEW.ALTERNATIVES.SELECT_SLOT_ARIA', {
      start,
      end,
    });
  }

  trackConflictSlot(_: number, slot: ConflictSlotDto): string {
    return `${slot.startTime}|${slot.endTime}|${slot.status}|${
      slot.bookingReference ?? ''
    }`;
  }

  conflictSlotStatusTone(
    status: string
  ): 'success' | 'warning' | 'danger' | 'neutral' {
    switch (status) {
      case 'BOOKED':
        return 'warning';
      case 'BLOCKED':
        return 'danger';
      case 'MAINTENANCE':
        return 'neutral';
      default:
        return 'neutral';
    }
  }

  conflictSlotStatusLabel(status: string): string {
    switch (status) {
      case 'BOOKED':
        return this.t('BOOKING_PREVIEW.SLOT_STATUS.BOOKED');
      case 'BLOCKED':
        return this.t('BOOKING_PREVIEW.SLOT_STATUS.BLOCKED');
      case 'MAINTENANCE':
        return this.t('BOOKING_PREVIEW.SLOT_STATUS.MAINTENANCE');
      default:
        return this.t('BOOKING_PREVIEW.SLOT_STATUS.UNKNOWN');
    }
  }

  conflictSlotAriaLabel(slot: ConflictSlotDto): string {
    const start = this.formatTime(slot.startTime);
    const end = this.formatTime(slot.endTime);
    const status = this.conflictSlotStatusLabel(slot.status);
    return this.t('BOOKING_PREVIEW.CONFLICT.SLOT_ARIA', { status, start, end });
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

  joinWaitlist(): void {
    if (!this.canJoinWaitlist()) return;

    const slotQuery = this.buildWaitlistStatusQuery();
    if (!slotQuery) return;

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
        catchError((err) =>
          throwError(() => this.resolveError('preview', err))
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (response) => {
          this.joinWaitlistInProgress.set(false);
          this.waitlistStatus.set({
            isOnWaitlist: response.status === WaitlistStatus.WAITING,
            entryId: response.entryId,
            status: response.status,
            queuePosition: response.queuePosition,
          });
          this.showToast(
            this.t('BOOKING_PREVIEW.WAITLIST.JOIN_SUCCESS', {
              position: response.queuePosition,
            }),
            'info'
          );
        },
        error: () => {
          this.joinWaitlistInProgress.set(false);
          this.waitlistError.set(this.t('CLIENT_ERRORS.WAITLIST.JOIN_FAILED'));
        },
      });
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
    this.recurrenceGroupId.set(null);
    this.recurringCreatedCount.set(null);
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
        return this.t('BOOKING_PREVIEW.CONFLICT.EXACT_OVERLAP');
      case ConflictType.CONTAINED_WITHIN:
        return this.t('BOOKING_PREVIEW.CONFLICT.CONTAINED_WITHIN');
      case ConflictType.PARTIAL_START_OVERLAP:
        return this.t('BOOKING_PREVIEW.CONFLICT.PARTIAL_START_OVERLAP');
      case ConflictType.PARTIAL_END_OVERLAP:
        return this.t('BOOKING_PREVIEW.CONFLICT.PARTIAL_END_OVERLAP');
      case ConflictType.CONTAINS_EXISTING:
        return this.t('BOOKING_PREVIEW.CONFLICT.CONTAINS_EXISTING');
      default:
        return this.t('BOOKING_PREVIEW.CONFLICT.DEFAULT');
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
    const status = this.holdAsPending() ? BookingStatus.PENDING : undefined;
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
                : this.getDateAfterWeeks(
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
          ),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe({
          next: (createdBooking: unknown) => {
            this.bookingInProgress.set(false);
            this.bookingSuccess.set(true);
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
              isRecurring
                ? this.t('BOOKING_PREVIEW.TOAST.RECURRING_BOOKING_CONFIRMED')
                : this.t('BOOKING_PREVIEW.TOAST.BOOKING_CONFIRMED'),
              'success'
            );
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

  private getErrorRecoveryOptions(
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

  private getPreviewErrorMessage(action: PreviewAction): string {
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

  private t(key: string, params?: Record<string, string | number>): string {
    this.languageService?.languageVersion();
    const translated = this.translateService?.instant(key, params);
    return translated && translated !== key ? translated : key;
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
    this.waitlistStatusAbort$.next();
    this.previewAbort$.complete();
    this.facilitiesAbort$.complete();
    this.waitlistStatusAbort$.complete();
    this.pendingActions.set([]);
    this.bookingQueue = [];
    this.bookingQueueRunning = false;
    this.clearTransientState();
  }

  private clearTransientState(): void {
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
        this.t('BOOKING_PREVIEW.CONNECTION.BACK_ONLINE_CONFIRM'),
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
        ? this.t('BOOKING_PREVIEW.ERRORS.OFFLINE_BOOKING')
        : this.t('BOOKING_PREVIEW.ERRORS.OFFLINE_RETRY');
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

  private handleSlotSelectionChanged(): void {
    this.waitlistError.set(null);
    this.waitlistStatus.set(null);
    this.waitlistLoading.set(false);

    if (!this.inputsValid() || !this.isSelectedSlotInFuture()) {
      return;
    }

    this.refreshWaitlistStatus();
  }

  private isSelectedSlotInFuture(): boolean {
    const slotQuery = this.buildWaitlistStatusQuery();
    if (!slotQuery) {
      return false;
    }

    return new Date(slotQuery.startTime) > new Date();
  }

  private buildWaitlistStatusQuery(): {
    facilityId: string;
    startTime: string;
    endTime: string;
  } | null {
    if (!this.inputsValid()) {
      return null;
    }

    const startDateTime = new Date(
      `${this.selectedDate()}T${this.startTime()}`
    );
    const endDateTime = new Date(`${this.selectedDate()}T${this.endTime()}`);

    if (
      Number.isNaN(startDateTime.getTime()) ||
      Number.isNaN(endDateTime.getTime()) ||
      startDateTime >= endDateTime
    ) {
      return null;
    }

    return {
      facilityId: this.selectedFacilityId(),
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
    };
  }

  private refreshWaitlistStatus(): void {
    const query = this.buildWaitlistStatusQuery();
    if (!query || !this.isSelectedSlotInFuture()) {
      this.waitlistStatus.set(null);
      this.waitlistLoading.set(false);
      return;
    }

    this.waitlistLoading.set(true);
    this.waitlistError.set(null);
    this.waitlistStatusAbort$.next();
    const requestId = ++this.waitlistStatusRequestId;

    this.api
      .getBookingWaitlistStatus(query)
      .pipe(
        timeout(REQUEST_TIMEOUT_MS),
        takeUntil(this.waitlistStatusAbort$),
        takeUntilDestroyed(this.destroyRef),
        catchError((err) => throwError(() => this.resolveError('preview', err)))
      )
      .subscribe({
        next: (status) => {
          if (requestId !== this.waitlistStatusRequestId) return;
          this.waitlistStatus.set(status);
          this.waitlistLoading.set(false);
        },
        error: () => {
          if (requestId !== this.waitlistStatusRequestId) return;
          this.waitlistLoading.set(false);
          this.waitlistError.set(
            this.t('CLIENT_ERRORS.WAITLIST.STATUS_FAILED')
          );
        },
      });
  }

  private extractApiMessage(err: unknown): string | null {
    if (!err || typeof err !== 'object') return null;
    const error = (err as { error?: { message?: string } }).error;
    if (typeof error?.message === 'string' && error.message.trim() !== '') {
      return error.message;
    }
    return null;
  }

  private getValidPromoCodeForBooking(): string | undefined {
    const promoValidation = this.previewResult()?.promoValidation;
    if (!promoValidation?.isValid || !promoValidation.code) {
      return undefined;
    }
    return promoValidation.code.trim().toUpperCase();
  }

  private promoValidationReasonKey(reason?: PromoValidationReason): string {
    switch (reason) {
      case PromoValidationReason.INVALID_FORMAT:
        return 'BOOKING_PREVIEW.PROMO_VALIDATION.INVALID_FORMAT';
      case PromoValidationReason.NOT_FOUND:
        return 'BOOKING_PREVIEW.PROMO_VALIDATION.NOT_FOUND';
      case PromoValidationReason.INACTIVE:
        return 'BOOKING_PREVIEW.PROMO_VALIDATION.INACTIVE';
      case PromoValidationReason.EXPIRED:
        return 'BOOKING_PREVIEW.PROMO_VALIDATION.EXPIRED';
      case PromoValidationReason.FACILITY_MISMATCH:
        return 'BOOKING_PREVIEW.PROMO_VALIDATION.FACILITY_MISMATCH';
      case PromoValidationReason.USAGE_EXCEEDED:
        return 'BOOKING_PREVIEW.PROMO_VALIDATION.USAGE_EXCEEDED';
      case PromoValidationReason.EMPTY_CODE:
      default:
        return 'BOOKING_PREVIEW.PROMO_VALIDATION.INVALID_GENERIC';
    }
  }
}
