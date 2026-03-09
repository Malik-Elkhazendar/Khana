import { DestroyRef, Directive, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import {
  BookingPreviewResponseDto,
  CustomerSummaryDto,
  FacilityListItemDto,
  PromoValidationReason,
  RecurrenceFrequency,
  UserRole,
  WaitlistStatus,
  WaitlistStatusResponseDto,
} from '@khana/shared-dtos';
import { ApiService } from '../../../shared/services/api.service';
import { LanguageService } from '../../../shared/services/language.service';
import { LocaleFormatService } from '../../../shared/services/locale-format.service';
import { FacilityContextStore } from '../../../shared/state';
import { AuthStore } from '../../../shared/state/auth.store';
import { buildAlternativesWindow } from './booking-preview.alternatives';
import {
  ALTERNATIVES_EAGER_THRESHOLD,
  ALTERNATIVES_VIRTUAL_THRESHOLD,
  AUTO_RETRY_MAX_ATTEMPTS,
  BookingPrefillQueryParams,
  BookingSubmissionMode,
  CUSTOMER_TAG_MAX_COUNT,
  ErrorRecoveryOption,
  OfflineAction,
  PreviewAction,
  PreviewError,
  PreviewErrorCategory,
  PreviewRequestPayload,
  PreviewStateSnapshot,
  RECURRING_PRESETS,
  RecurrenceEndMode,
  RecurringPresetKey,
  TranslationParams,
} from './booking-preview.models';
import { hasNormalizedTag, normalizeTagValue } from './booking-preview.tags';
import {
  hasActiveWaitlistEntry,
  isOnWaitlist,
  normalizeWaitlistQueuePosition,
} from './booking-preview.waitlist';

@Directive()
export abstract class BookingPreviewRouteStateBase {
  protected readonly api = inject(ApiService);
  protected readonly facilityContext = inject(FacilityContextStore);
  protected readonly authStore = inject(AuthStore);
  protected readonly route = inject(ActivatedRoute);
  protected readonly router = inject(Router);
  protected readonly languageService = inject(LanguageService, {
    optional: true,
  });
  protected readonly localeFormat = inject(LocaleFormatService);
  protected readonly destroyRef = inject(DestroyRef);
  protected readonly translateService = inject(TranslateService, {
    optional: true,
  });

  protected abstract t(key: string, params?: TranslationParams): string;
  protected abstract getErrorRecoveryOptions(
    category: PreviewErrorCategory
  ): ErrorRecoveryOption[];
  protected abstract registerEffects(): void;
  protected abstract promoValidationReasonKey(
    reason?: PromoValidationReason
  ): string;
  protected abstract isSelectedSlotInFuture(): boolean;
  protected abstract resolveOnlineStatus(): boolean;

  readonly timezoneLabel = computed(() =>
    this.localeFormat.getCurrentTimeZone()
  );
  readonly inputLang = computed(() =>
    this.localeFormat.getCurrentLocale() === 'ar-SA' ? 'ar' : 'en'
  );
  readonly WaitlistStatus = WaitlistStatus;
  readonly recurringPresets = RECURRING_PRESETS;

  protected readonly previewCache = new Map<
    string,
    { result: BookingPreviewResponseDto; expiresAt: number }
  >();

  protected bookingQueue: Array<() => Promise<void>> = [];
  protected bookingQueueRunning = false;
  protected previewRequestId = 0;
  protected facilitiesRequestId = 0;
  protected waitlistStatusRequestId = 0;
  protected retryTimer: number | null = null;
  protected heartbeatTimer: number | null = null;
  protected lastSubmitAt = 0;
  protected lastOnlineStatus = true;
  protected inFlightPreviewKey: string | null = null;
  protected toastTimer: number | null = null;
  protected phoneLookupTimer: number | null = null;
  protected phoneLookupRequestId = 0;
  protected tenantTagsLoaded = false;
  protected connectivityHandler?: () => void;
  protected queryPrefillParams: BookingPrefillQueryParams | null = null;

  facilities = signal<FacilityListItemDto[]>([]);
  selectedFacilityId = signal<string>('');
  selectedDate = signal<string>('');
  startTime = signal<string>('10:00');
  endTime = signal<string>('11:00');
  promoCode = signal<string>('');
  repeatWeekly = signal<boolean>(false);
  recurrenceFrequency = signal<RecurrenceFrequency>(RecurrenceFrequency.WEEKLY);
  recurrenceEndMode = signal<RecurrenceEndMode>('COUNT');
  recurrenceWeeksCount = signal<number>(8);
  recurrenceEndDate = signal<string>('');
  activeRecurringPreset = signal<RecurringPresetKey | null>(null);

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

  customerName = signal<string>('');
  customerPhone = signal<string>('');
  matchedCustomer = signal<CustomerSummaryDto | null>(null);
  lookupLoading = signal<boolean>(false);
  tagEditMode = signal<boolean>(false);
  availableTags = signal<string[]>([]);
  newTagInput = signal<string>('');
  bookingSubmissionMode = signal<BookingSubmissionMode>('CONFIRMED');
  lastSuccessfulBookingMode = signal<BookingSubmissionMode | null>(null);
  bookingInProgress = signal<boolean>(false);
  bookingSuccess = signal<boolean>(false);
  bookingReference = signal<string | null>(null);
  recurringCreatedCount = signal<number | null>(null);
  recurrenceGroupId = signal<string | null>(null);
  isOnline = signal<boolean>(true);

  readonly selectedFacility = computed(() =>
    this.facilities().find(
      (facility) => facility.id === this.selectedFacilityId()
    )
  );

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

  readonly isHoldMode = computed(() => this.bookingSubmissionMode() === 'HOLD');

  readonly canSelectHoldMode = computed(() => {
    const result = this.previewResult();
    return (
      Boolean(result?.canBook) &&
      !this.previewStale() &&
      !this.isPreviewStale() &&
      !this.loading()
    );
  });

  readonly canSubmit = computed(() => {
    return this.inputsValid() && !this.loading() && !this.facilitiesLoading();
  });

  readonly canBook = computed(() => {
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

  readonly canEditTags = computed(() => {
    const role = this.authStore.user()?.role;
    return role === UserRole.OWNER || role === UserRole.MANAGER;
  });

  readonly hasLookupPhoneThreshold = computed(
    () => this.customerPhone().replace(/\D/g, '').length >= 10
  );

  readonly canAddNewTag = computed(() => {
    const customer = this.matchedCustomer();
    if (!customer || !this.canEditTags()) {
      return false;
    }

    const candidate = normalizeTagValue(this.newTagInput());
    if (!candidate) {
      return false;
    }

    const existing = customer.tags ?? [];
    if (existing.length >= CUSTOMER_TAG_MAX_COUNT) {
      return false;
    }

    return !hasNormalizedTag(existing, candidate);
  });

  readonly errorRecoveryOptions = computed(() => {
    const error = this.error();
    if (!error) {
      return [];
    }

    return this.getErrorRecoveryOptions(error.category);
  });

  readonly errorCategoryLabel = computed(() => {
    const error = this.error();
    if (!error) {
      return '';
    }

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
    if (this.isOnline()) {
      return '';
    }

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
    if (!scheduledAt) {
      return null;
    }

    const remainingMs = Math.max(0, scheduledAt - this.nowTick());
    return Math.ceil(remainingMs / 1000);
  });

  readonly retryAttemptMessage = computed(() => {
    if (!this.retryScheduledAt()) {
      return '';
    }

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
    if (!lastPreviewAt) {
      return false;
    }

    return this.nowTick() - lastPreviewAt > 300_000;
  });

  readonly alternatives = computed(
    () => this.previewResult()?.suggestedAlternatives ?? []
  );

  readonly isOnWaitlist = computed(() =>
    isOnWaitlist(this.waitlistStatus()?.status)
  );

  readonly selectedSlotIsInFuture = computed(() =>
    this.isSelectedSlotInFuture()
  );

  readonly hasActiveWaitlistEntry = computed(() =>
    hasActiveWaitlistEntry(this.waitlistStatus()?.status)
  );

  readonly waitlistQueuePosition = computed(() =>
    normalizeWaitlistQueuePosition(this.waitlistStatus()?.queuePosition)
  );

  readonly canJoinWaitlist = computed(() => {
    const result = this.previewResult();
    return (
      result !== null &&
      result.canBook === false &&
      this.inputsValid() &&
      this.selectedSlotIsInFuture() &&
      !this.waitlistLoading() &&
      !this.joinWaitlistInProgress() &&
      !this.hasActiveWaitlistEntry()
    );
  });

  readonly canOpenWaitlistOperations = computed(() => {
    const status = this.waitlistStatus()?.status;
    return (
      !!this.selectedFacilityId() &&
      !!this.selectedDate() &&
      (status === WaitlistStatus.WAITING || status === WaitlistStatus.NOTIFIED)
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

  readonly showAlternativesToggle = computed(
    () => this.alternativesCount() > ALTERNATIVES_EAGER_THRESHOLD
  );

  readonly alternativesToggleLabel = computed(() => {
    return this.alternativesExpanded()
      ? this.t('BOOKING_PREVIEW.ALTERNATIVES.HIDE')
      : this.t('BOOKING_PREVIEW.ALTERNATIVES.VIEW_COUNT', {
          count: this.alternativesCount(),
        });
  });

  readonly showAlternatives = computed(() => {
    if (this.alternativesCount() === 0) {
      return false;
    }

    if (!this.showAlternativesToggle()) {
      return true;
    }

    return this.alternativesExpanded();
  });

  readonly shouldVirtualizeAlternatives = computed(
    () => this.alternatives().length >= ALTERNATIVES_VIRTUAL_THRESHOLD
  );

  readonly alternativesWindow = computed(() =>
    buildAlternativesWindow(
      this.alternatives(),
      this.shouldVirtualizeAlternatives(),
      this.alternativesScrollTop()
    )
  );

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

  readonly bookingSuccessCopy = computed(() => {
    const isRecurring = this.recurringCreatedCount() !== null;
    const successfulMode = this.lastSuccessfulBookingMode();

    if (successfulMode === 'HOLD') {
      return {
        title: this.t(
          isRecurring
            ? 'BOOKING_PREVIEW.SUCCESS.HOLD_RECURRING_TITLE'
            : 'BOOKING_PREVIEW.SUCCESS.HOLD_TITLE'
        ),
        subtitle: this.t(
          isRecurring
            ? 'BOOKING_PREVIEW.SUCCESS.HOLD_RECURRING_SUBTITLE'
            : 'BOOKING_PREVIEW.SUCCESS.HOLD_SUBTITLE'
        ),
      };
    }

    return {
      title: this.t('BOOKING_PREVIEW.SUCCESS.TITLE'),
      subtitle: this.t('BOOKING_PREVIEW.SUCCESS.SUBTITLE'),
    };
  });

  get confirmCopy(): {
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
  } {
    if (this.isHoldMode()) {
      return {
        title: this.t('BOOKING_PREVIEW.DIALOG.HOLD_TITLE'),
        message: this.t('BOOKING_PREVIEW.DIALOG.HOLD_MESSAGE'),
        confirmLabel: this.t('BOOKING_PREVIEW.DIALOG.HOLD_LABEL'),
        cancelLabel: this.t('BOOKING_PREVIEW.DIALOG.CANCEL_LABEL'),
      };
    }

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

  abstract isValidTimeRange(): boolean;
}
