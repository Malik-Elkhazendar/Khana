import { Directive } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, throwError, timeout } from 'rxjs';
import { AlternativeSlotDto, FacilityListItemDto } from '@khana/shared-dtos';
import {
  buildBookingPrefill,
  hasBookingPrefill,
} from './booking-preview.prefill';
import {
  buildPreviewCacheKey,
  buildPreviewPayload,
  isSamePreviewPayload,
} from './booking-preview.request';
import {
  clampRecurrenceWeeksCount,
  getDateAfterWeeks,
  getDefaultBookingDate,
  getDefaultRecurrenceEndDate,
  normalizeRecurrenceEndDate,
  resolveRecurrenceEndMode,
  resolveRecurrenceFrequency,
  syncWeeksCountFromEndDate,
} from './booking-preview.recurrence';
import {
  PreviewError,
  PREVIEW_CACHE_TTL_MS,
  PreviewRequestPayload,
  REQUEST_TIMEOUT_MS,
  SUBMIT_DEBOUNCE_MS,
} from './booking-preview.models';
import { BookingPreviewRouteResilienceBase } from './booking-preview.route-resilience';

@Directive()
export abstract class BookingPreviewRoutePreviewBase extends BookingPreviewRouteResilienceBase {
  protected buildCacheKey(start: Date, end: Date): string {
    return buildPreviewCacheKey(
      buildPreviewPayload({
        facilityId: this.selectedFacilityId(),
        selectedDate: this.selectedDate(),
        startTime: start.toTimeString().slice(0, 5),
        endTime: end.toTimeString().slice(0, 5),
        promoCode: this.promoCode(),
      })
    );
  }

  ngOnInit(): void {
    this.isOnline.set(this.resolveOnlineStatus());
    this.selectedDate.set(getDefaultBookingDate());
    this.facilityContext.initialize();
    this.capturePrefillFromQueryParams();
    this.setupConnectivityListeners();
    this.startHeartbeat();
    this.recurrenceEndDate.set(
      getDefaultRecurrenceEndDate(
        this.selectedDate(),
        this.recurrenceWeeksCount()
      )
    );
    this.loadFacilities();
    this.destroyRef.onDestroy(() => this.cleanup());
  }

  protected loadFacilities(): void {
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
    const requestId = ++this.facilitiesRequestId;

    this.api
      .getFacilities()
      .pipe(
        timeout(REQUEST_TIMEOUT_MS),
        catchError((err) =>
          throwError(() => this.resolveError('facilities', err))
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (facilities) => {
          if (requestId !== this.facilitiesRequestId) {
            return;
          }

          this.facilities.set(facilities);
          const nextSelection =
            this.resolveInitialFacilitySelection(facilities);
          this.selectedFacilityId.set(nextSelection);
          this.facilityContext.selectFacility(nextSelection || null);
          this.applyPrefillAfterFacilitiesLoad();
          this.lastAction.set(null);
          this.facilitiesLoading.set(false);
          this.resetRetryState();
        },
        error: (err: PreviewError) => {
          if (requestId !== this.facilitiesRequestId) {
            return;
          }

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

    const activePreset = this.activeRecurringPreset();
    if (activePreset) {
      this.applyRecurringPreset(activePreset);
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
      this.activeRecurringPreset.set(null);
      return;
    }
    if (this.recurrenceEndMode() === 'COUNT') {
      this.syncEndDateFromWeeksCount();
      return;
    }
    if (!this.recurrenceEndDate().trim()) {
      this.recurrenceEndDate.set(
        getDefaultRecurrenceEndDate(
          this.selectedDate(),
          this.recurrenceWeeksCount()
        )
      );
    }
  }

  onRecurrenceFrequencyChange(value: string): void {
    this.recurrenceFrequency.set(resolveRecurrenceFrequency(value));
  }

  onRecurrenceEndModeChange(value: string): void {
    const mode = resolveRecurrenceEndMode(value);
    this.recurrenceEndMode.set(mode);
    const activePreset = this.activeRecurringPreset();
    if (activePreset) {
      this.applyRecurringPreset(activePreset);
      return;
    }
    if (mode === 'COUNT') {
      this.syncEndDateFromWeeksCount();
      return;
    }
    if (!this.recurrenceEndDate().trim()) {
      this.recurrenceEndDate.set(
        getDefaultRecurrenceEndDate(
          this.selectedDate(),
          this.recurrenceWeeksCount()
        )
      );
    }
  }

  onRecurrenceWeeksCountChange(value: string | number): void {
    this.activeRecurringPreset.set(null);
    const normalized = clampRecurrenceWeeksCount(value);
    this.recurrenceWeeksCount.set(normalized);
    if (this.repeatWeekly() && this.recurrenceEndMode() === 'COUNT') {
      this.syncEndDateFromWeeksCount();
    }
  }

  onRecurrenceEndDateChange(value: string): void {
    this.activeRecurringPreset.set(null);
    const normalized = normalizeRecurrenceEndDate(this.selectedDate(), value);
    this.recurrenceEndDate.set(normalized);
    if (!normalized) {
      return;
    }
    this.syncWeeksCountFromEndDate(normalized);
  }

  onBookingSubmissionModeChange(value: string): void {
    if (value === 'HOLD') {
      if (!this.canSelectHoldMode()) {
        return;
      }
      this.bookingSubmissionMode.set('HOLD');
      return;
    }

    this.bookingSubmissionMode.set('CONFIRMED');
  }

  applyRecurringPreset(key: string): void {
    const preset = this.recurringPresets.find((item) => item.key === key);
    if (!preset) {
      return;
    }

    if (this.recurrenceEndMode() === 'COUNT') {
      this.recurrenceWeeksCount.set(preset.weeks);
      this.syncEndDateFromWeeksCount();
      this.activeRecurringPreset.set(preset.key);
      return;
    }

    const endDate = getDateAfterWeeks(
      this.selectedDate(),
      Math.max(0, preset.weeks - 1)
    );
    this.recurrenceEndDate.set(endDate);
    this.syncWeeksCountFromEndDate(endDate);
    this.activeRecurringPreset.set(preset.key);
  }

  onStartTimeChange(value: string): void {
    this.startTime.set(value);
    this.handleSlotSelectionChanged();
  }

  onEndTimeChange(value: string): void {
    this.endTime.set(value);
    this.handleSlotSelectionChanged();
  }

  onSubmit(): void {
    if (!this.inputsValid()) {
      return;
    }

    const now = Date.now();
    if (now - this.lastSubmitAt < SUBMIT_DEBOUNCE_MS) {
      return;
    }
    this.lastSubmitAt = now;

    const payload = buildPreviewPayload({
      facilityId: this.selectedFacilityId(),
      selectedDate: this.selectedDate(),
      startTime: this.startTime(),
      endTime: this.endTime(),
      promoCode: this.promoCode(),
    });
    const lastPayload = this.lastPreviewRequest();
    if (
      this.loading() &&
      lastPayload &&
      isSamePreviewPayload(lastPayload, payload)
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
    this.lastSuccessfulBookingMode.set(null);
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

  selectAlternative(alt: AlternativeSlotDto): void {
    const startDate = new Date(alt.startTime);
    const endDate = new Date(alt.endTime);

    this.selectedDate.set(startDate.toISOString().split('T')[0]);
    this.startTime.set(startDate.toTimeString().slice(0, 5));
    this.endTime.set(endDate.toTimeString().slice(0, 5));

    this.onSubmit();
  }

  protected executePreviewRequest(
    payload: PreviewRequestPayload,
    options: { ignoreCache: boolean }
  ): void {
    this.lastAction.set('preview');
    this.lastPreviewRequest.set(payload);
    const cacheKey = buildPreviewCacheKey(payload);

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

    // Deduplicate identical in-flight previews so rapid submit events do not
    // overwrite each other with stale request ordering.
    if (this.loading() && this.inFlightPreviewKey === cacheKey) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);
    this.inFlightPreviewKey = cacheKey;
    const requestId = ++this.previewRequestId;

    this.api
      .previewBooking(payload)
      .pipe(
        timeout(REQUEST_TIMEOUT_MS),
        catchError((err) =>
          throwError(() => this.resolveError('preview', err))
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (result) => {
          if (requestId !== this.previewRequestId) {
            return;
          }

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
          if (requestId !== this.previewRequestId) {
            return;
          }

          this.loading.set(false);
          this.inFlightPreviewKey = null;
          this.handleRequestError('preview', err);
        },
      });
  }

  protected capturePrefillFromQueryParams(): void {
    const prefill = buildBookingPrefill({
      facilityId: this.route.snapshot.queryParamMap.get('facilityId'),
      date: this.route.snapshot.queryParamMap.get('date'),
      startTime: this.route.snapshot.queryParamMap.get('startTime'),
      endTime: this.route.snapshot.queryParamMap.get('endTime'),
    });

    if (!hasBookingPrefill(prefill)) {
      return;
    }

    this.queryPrefillParams = prefill;

    if (prefill.date) {
      this.selectedDate.set(prefill.date);
    }
    if (prefill.startTime) {
      this.startTime.set(prefill.startTime);
    }
    if (prefill.endTime) {
      this.endTime.set(prefill.endTime);
    }
    if (prefill.facilityId) {
      this.selectedFacilityId.set(prefill.facilityId);
    }
  }

  protected resolveInitialFacilitySelection(
    facilities: FacilityListItemDto[]
  ): string {
    const prefilledFacilityId = this.queryPrefillParams?.facilityId;
    if (
      prefilledFacilityId &&
      facilities.some((facility) => facility.id === prefilledFacilityId)
    ) {
      return prefilledFacilityId;
    }

    const sharedSelection = this.facilityContext.selectedFacilityId();
    if (
      sharedSelection &&
      facilities.some((facility) => facility.id === sharedSelection)
    ) {
      return sharedSelection;
    }

    const currentSelection = this.selectedFacilityId();
    if (
      currentSelection &&
      facilities.some((facility) => facility.id === currentSelection)
    ) {
      return currentSelection;
    }

    return facilities[0]?.id ?? '';
  }

  protected applyPrefillAfterFacilitiesLoad(): void {
    const prefill = this.queryPrefillParams;
    if (!prefill) {
      return;
    }

    if (prefill.date) {
      this.selectedDate.set(prefill.date);
    }
    if (prefill.startTime) {
      this.startTime.set(prefill.startTime);
    }
    if (prefill.endTime) {
      this.endTime.set(prefill.endTime);
    }

    this.queryPrefillParams = null;
    this.handleSlotSelectionChanged();
  }

  protected syncEndDateFromWeeksCount(): void {
    this.recurrenceEndDate.set(
      getDefaultRecurrenceEndDate(
        this.selectedDate(),
        this.recurrenceWeeksCount()
      )
    );
  }

  protected syncWeeksCountFromEndDate(endDateIso: string): void {
    this.recurrenceWeeksCount.set(
      syncWeeksCountFromEndDate(this.selectedDate(), endDateIso)
    );
  }
}
