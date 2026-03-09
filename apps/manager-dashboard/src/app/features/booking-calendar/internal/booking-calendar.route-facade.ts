import { Directive, effect } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BookingCalendarRouteActionsBase } from './booking-calendar.route-actions';
import {
  AUTO_RETRY_BASE_DELAY_MS,
  AUTO_RETRY_MAX_ATTEMPTS,
  AUTO_RETRY_MAX_DELAY_MS,
  NAVIGATION_THROTTLE_MS,
} from './booking-calendar.models';
import { extractCardTypographyMetrics } from './booking-calendar.presentation';

/**
 * Route-scoped facade for the booking calendar page. The component inherits
 * this class so the route shell stays thin while preserving the existing API.
 */
@Directive()
export class BookingCalendarRouteFacade extends BookingCalendarRouteActionsBase {
  constructor() {
    super();

    effect(() => {
      if (!this.facilityContext.initialized()) {
        return;
      }

      const selectedFacilityId = this.facilityContext.selectedFacilityId();
      if (selectedFacilityId === this.lastLoadedFacilityId) {
        return;
      }

      this.loadBookings(true);
    });

    this.registerEffects();
  }

  ngOnInit(): void {
    this.facilityContext.initialize();
    this.setInitialSlotFocus();
    this.loadBookings(true);
  }

  ngAfterViewInit(): void {
    this.setupResizeObserver();

    this.slotCells?.changes
      ?.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.observeMeasurementTargets());
    this.gridBookingCards?.changes
      ?.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.observeMeasurementTargets());
    this.timelineCards?.changes
      ?.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.observeMeasurementTargets());

    queueMicrotask(() => this.observeMeasurementTargets());
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.clearTimers();
  }

  protected registerEffects(): void {
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

    effect(() => {
      const days = this.weekDays();
      const selected = this.selectedDay();
      const selectedDow = selected.getDay();
      const matchingDay = days.find((day) => day.getDay() === selectedDow);
      if (matchingDay && matchingDay.getTime() !== selected.getTime()) {
        this.selectedDay.set(matchingDay);
      } else if (!matchingDay && days.length > 0) {
        this.selectedDay.set(days[0]);
      }
    });
  }

  protected setInitialSlotFocus(): void {
    const now = new Date();
    this.focusedSlot.set({
      dayIndex: now.getDay(),
      hourIndex: now.getHours(),
    });
  }

  protected focusSlot(dayIndex: number, hourIndex: number): void {
    const maxDay = this.weekDays().length - 1;
    const maxHour = this.hours.length - 1;
    const nextDay = Math.min(Math.max(dayIndex, 0), maxDay);
    const nextHour = Math.min(Math.max(hourIndex, 0), maxHour);
    this.focusedSlot.set({ dayIndex: nextDay, hourIndex: nextHour });

    const index = nextHour * this.weekDays().length + nextDay;
    const slots = this.slotCells?.toArray();
    if (!slots || index < 0 || index >= slots.length) {
      return;
    }

    queueMicrotask(() => {
      slots[index]?.nativeElement.focus();
    });
  }

  protected lockNavigation(): void {
    if (this.navigationTimer) {
      window.clearTimeout(this.navigationTimer);
    }
    this.navigationLocked.set(true);
    this.navigationTimer = window.setTimeout(() => {
      this.navigationLocked.set(false);
      this.navigationTimer = null;
    }, NAVIGATION_THROTTLE_MS);
  }

  protected scheduleAutoRetry(): void {
    if (this.retryTimer) {
      return;
    }

    const attempt = this.retryAttempt();
    if (attempt >= AUTO_RETRY_MAX_ATTEMPTS) {
      return;
    }

    const delay = Math.min(
      AUTO_RETRY_BASE_DELAY_MS * 2 ** attempt,
      AUTO_RETRY_MAX_DELAY_MS
    );

    this.retryScheduledAt.set(Date.now() + delay);
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = null;
      this.retryScheduledAt.set(null);
      this.loadBookings(false);
      this.retryAttempt.set(attempt + 1);
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
  }

  protected loadBookings(resetRetry: boolean): void {
    if (resetRetry) {
      this.resetRetryState();
    }

    const selectedFacilityId = this.facilityContext.selectedFacilityId();
    this.lastLoadedFacilityId = selectedFacilityId;
    this.store.loadBookings(selectedFacilityId);
  }

  protected setupResizeObserver(): void {
    if (typeof ResizeObserver === 'undefined') {
      this.observeMeasurementTargets();
      return;
    }

    this.resizeObserver = new ResizeObserver(() => {
      this.observeMeasurementTargets();
    });
  }

  protected observeMeasurementTargets(): void {
    const slot = this.slotCells?.first?.nativeElement ?? null;
    const gridCard = this.gridBookingCards?.first?.nativeElement ?? null;
    const timelineCard = this.timelineCards?.first?.nativeElement ?? null;

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      if (slot) {
        this.resizeObserver.observe(slot);
      }
      if (gridCard) {
        this.resizeObserver.observe(gridCard);
      }
      if (timelineCard) {
        this.resizeObserver.observe(timelineCard);
      }
    }

    if (slot) {
      const slotRect = slot.getBoundingClientRect();
      this.slotBlockSizePx.set(slotRect.height);
      this.calendarCellInlineSizePx.set(slotRect.width);
    } else {
      this.slotBlockSizePx.set(0);
      this.calendarCellInlineSizePx.set(0);
    }

    if (timelineCard) {
      const timelineRect = timelineCard.getBoundingClientRect();
      this.timelineCardBlockSizePx.set(timelineRect.height);
      this.timelineCardInlineSizePx.set(timelineRect.width);
    } else {
      this.timelineCardBlockSizePx.set(0);
      this.timelineCardInlineSizePx.set(0);
    }

    this.gridTypographyMetrics.set(extractCardTypographyMetrics(gridCard));
    this.timelineTypographyMetrics.set(
      extractCardTypographyMetrics(timelineCard)
    );
  }

  protected clearTimers(): void {
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
    if (this.panelCloseTimer) {
      window.clearTimeout(this.panelCloseTimer);
      this.panelCloseTimer = null;
    }
  }

  protected now(): number {
    if (typeof performance !== 'undefined' && performance.now) {
      return performance.now();
    }
    return Date.now();
  }
}
