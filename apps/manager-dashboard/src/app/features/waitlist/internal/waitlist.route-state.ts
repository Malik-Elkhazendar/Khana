import { HttpErrorResponse } from '@angular/common/http';
import { computed, DestroyRef, inject, signal } from '@angular/core';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import {
  UserRole,
  WaitlistEntryListItemDto,
  WaitlistStatus,
  WaitlistSummaryCountsDto,
} from '@khana/shared-dtos';
import { firstValueFrom } from 'rxjs';
import { UiStatusTone } from '../../../shared/components/ui';
import { WAITLIST_UPCOMING_WINDOW_DAYS } from '../../../shared/constants/waitlist.constants';
import { ApiService } from '../../../shared/services/api.service';
import { LocaleFormatService } from '../../../shared/services/locale-format.service';
import { AuthStore } from '../../../shared/state/auth.store';
import { FacilityContextStore } from '../../../shared/state';
import {
  DEFAULT_PAGE_SIZE,
  WAITLIST_STATUSES,
  WaitlistSlotContext,
} from './waitlist.route.models';

/**
 * Route state for the waitlist page.
 * This layer owns filters, computed view state, and presentation helpers while
 * the facade layer owns navigation and loading workflows.
 */
export abstract class WaitlistRouteState {
  protected readonly api = inject(ApiService);
  protected readonly route = inject(ActivatedRoute);
  protected readonly router = inject(Router);
  protected readonly destroyRef = inject(DestroyRef);
  protected readonly localeFormat = inject(LocaleFormatService);
  protected readonly facilityContext = inject(FacilityContextStore);
  protected readonly authStore = inject(AuthStore);
  protected loadRequestSequence = 0;
  protected readonly initialUpcomingRange = this.createUpcomingRange();
  protected hasHydratedQueryParams = false;
  readonly facilities = this.facilityContext.facilities;
  readonly loading = signal(false);
  readonly error = signal<Error | null>(null);
  readonly filterError = signal<string | null>(null);
  readonly fromDate = signal(this.initialUpcomingRange.from);
  readonly toDate = signal(this.initialUpcomingRange.to);
  readonly facilityId = signal('');
  readonly statusFilter = signal<WaitlistStatus | 'ALL'>('ALL');
  readonly slotContext = signal<WaitlistSlotContext | null>(null);
  readonly items = signal<WaitlistEntryListItemDto[]>([]);
  readonly summary = signal<WaitlistSummaryCountsDto>({
    waiting: 0,
    notified: 0,
    expired: 0,
    fulfilled: 0,
  });
  readonly page = signal(1);
  readonly pageSize = signal(DEFAULT_PAGE_SIZE);
  readonly total = signal(0);
  readonly totalPages = computed(() => {
    return Math.max(1, Math.ceil(this.total() / this.pageSize()));
  });

  readonly hasPreviousPage = computed(() => this.page() > 1);
  readonly hasNextPage = computed(() => this.page() < this.totalPages());
  readonly selectedFacilityName = computed(() => {
    const facilityId = this.facilityId();
    if (!facilityId) {
      return null;
    }

    return (
      this.facilities().find((facility) => facility.id === facilityId)?.name ??
      facilityId
    );
  });
  readonly hasSlotContext = computed(() => this.slotContext() !== null);
  readonly hasMatchingSlotContextRows = computed(() => {
    const context = this.slotContext();
    if (!context) {
      return false;
    }

    return this.items().some((item) => this.isSlotContextMatch(item, context));
  });
  readonly canUseBookNow = computed(() => {
    const role = this.authStore.user()?.role;
    return role === UserRole.OWNER || role === UserRole.MANAGER;
  });

  readonly statusOptions: ReadonlyArray<WaitlistStatus | 'ALL'> = [
    'ALL',
    WaitlistStatus.WAITING,
    WaitlistStatus.NOTIFIED,
    WaitlistStatus.EXPIRED,
    WaitlistStatus.FULFILLED,
  ];

  statusLabelKey(status: WaitlistStatus | 'ALL'): string {
    if (status === 'ALL') {
      return 'DASHBOARD.PAGES.WAITLIST.FILTERS.ALL_STATUSES';
    }
    return `DASHBOARD.PAGES.WAITLIST.STATUS.${status}`;
  }

  statusTone(status: WaitlistStatus): UiStatusTone {
    switch (status) {
      case WaitlistStatus.WAITING:
        return 'neutral';
      case WaitlistStatus.NOTIFIED:
        return 'warning';
      case WaitlistStatus.EXPIRED:
        return 'danger';
      case WaitlistStatus.FULFILLED:
        return 'success';
      default:
        return 'neutral';
    }
  }

  formatDateTime(value: string): string {
    return this.localeFormat.formatDate(value, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  trackByEntryId(_: number, item: WaitlistEntryListItemDto): string {
    return item.entryId;
  }

  bookNow(item: WaitlistEntryListItemDto): void {
    if (!this.canUseBookNow()) {
      return;
    }

    const desiredStart = new Date(item.desiredStartTime);
    const desiredEnd = new Date(item.desiredEndTime);
    if (
      Number.isNaN(desiredStart.getTime()) ||
      Number.isNaN(desiredEnd.getTime())
    ) {
      return;
    }

    void this.router.navigate(['/dashboard/new'], {
      queryParams: {
        facilityId: item.facilityId,
        date: this.toLocalDateInput(desiredStart),
        startTime: this.toLocalTimeInput(desiredStart),
        endTime: this.toLocalTimeInput(desiredEnd),
      },
    });
  }

  formatInputDate(value: string): string {
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return this.localeFormat.formatDate(date.toISOString(), {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  isContextRow(item: WaitlistEntryListItemDto): boolean {
    const context = this.slotContext();
    if (!context) {
      return false;
    }

    return this.isSlotContextMatch(item, context);
  }

  protected isWaitlistStatus(value: string): value is WaitlistStatus {
    return WAITLIST_STATUSES.includes(value as WaitlistStatus);
  }

  protected isInputDate(value: string | null): value is string {
    return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  protected toInputDate(value: Date): string {
    const offset = value.getTimezoneOffset();
    const local = new Date(value.getTime() - offset * 60_000);
    return local.toISOString().slice(0, 10);
  }

  protected toRangeIso(
    value: string,
    boundary: 'start' | 'end'
  ): string | null {
    if (!value) {
      return null;
    }

    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    if (boundary === 'end') {
      date.setHours(23, 59, 59, 999);
    }

    return date.toISOString();
  }

  protected toLocalDateInput(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  protected toLocalTimeInput(value: Date): string {
    const hours = String(value.getHours()).padStart(2, '0');
    const minutes = String(value.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  protected createUpcomingRange(baseDate: Date = new Date()): {
    from: string;
    to: string;
  } {
    const from = this.toInputDate(baseDate);
    const toDate = new Date(baseDate);
    toDate.setDate(toDate.getDate() + WAITLIST_UPCOMING_WINDOW_DAYS);

    return {
      from,
      to: this.toInputDate(toDate),
    };
  }

  protected normalizeSlotContext(params: {
    facilityId: string | null;
    slotStart: string | null;
    slotEnd: string | null;
    source: string | null;
  }): WaitlistSlotContext | null {
    if (!params.slotStart || !params.slotEnd) {
      return null;
    }

    const startTime = new Date(params.slotStart);
    const endTime = new Date(params.slotEnd);

    if (
      Number.isNaN(startTime.getTime()) ||
      Number.isNaN(endTime.getTime()) ||
      startTime >= endTime
    ) {
      return null;
    }

    return {
      facilityId: params.facilityId,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      source:
        params.source === 'booking-preview' ? 'booking-preview' : 'unknown',
    };
  }

  protected isSlotContextMatch(
    item: WaitlistEntryListItemDto,
    context: WaitlistSlotContext
  ): boolean {
    const itemStart = new Date(item.desiredStartTime).getTime();
    const itemEnd = new Date(item.desiredEndTime).getTime();
    const contextStart = new Date(context.startTime).getTime();
    const contextEnd = new Date(context.endTime).getTime();

    if (itemStart !== contextStart || itemEnd !== contextEnd) {
      return false;
    }

    if (!context.facilityId) {
      return true;
    }

    return item.facilityId === context.facilityId;
  }

  protected areSlotContextsEqual(
    current: WaitlistSlotContext | null,
    next: WaitlistSlotContext | null
  ): boolean {
    if (current === next) {
      return true;
    }

    if (!current || !next) {
      return false;
    }

    return (
      current.facilityId === next.facilityId &&
      current.startTime === next.startTime &&
      current.endTime === next.endTime &&
      current.source === next.source
    );
  }

  protected isAuthSensitiveError(error: unknown): boolean {
    return (
      error instanceof HttpErrorResponse && [401, 403].includes(error.status)
    );
  }

  protected async loadEntries(): Promise<void> {
    const requestSequence = ++this.loadRequestSequence;
    const fromIso = this.toRangeIso(this.fromDate(), 'start');
    const toIso = this.toRangeIso(this.toDate(), 'end');

    if (!fromIso || !toIso || fromIso > toIso) {
      this.filterError.set('DASHBOARD.PAGES.WAITLIST.ERRORS.INVALID_RANGE');
      return;
    }

    this.filterError.set(null);
    this.loading.set(true);
    this.error.set(null);
    const selectedStatus = this.statusFilter();
    const status: WaitlistStatus | undefined =
      selectedStatus === 'ALL' ? undefined : selectedStatus;

    try {
      const response = await firstValueFrom(
        this.api.getWaitlistEntries({
          from: fromIso,
          to: toIso,
          facilityId: this.facilityId() || undefined,
          status,
          page: this.page(),
          pageSize: this.pageSize(),
        })
      );

      // Only the latest request is allowed to mutate state because filters can
      // change again before the API comes back.
      if (requestSequence !== this.loadRequestSequence) {
        return;
      }

      this.items.set(response.items);
      this.summary.set(response.summary);
      this.total.set(response.total);
      this.page.set(response.page);
      this.pageSize.set(response.pageSize);
    } catch (error) {
      // Apply the same stale-response guard to errors so an older failed request
      // cannot wipe out a newer successful load.
      if (requestSequence !== this.loadRequestSequence) {
        return;
      }

      if (this.isAuthSensitiveError(error)) {
        this.items.set([]);
        this.summary.set({
          waiting: 0,
          notified: 0,
          expired: 0,
          fulfilled: 0,
        });
        this.total.set(0);
      }

      this.error.set(error as Error);
    } finally {
      if (requestSequence === this.loadRequestSequence) {
        this.loading.set(false);
      }
    }
  }

  protected bindQueryParams(): void {
    throw new Error('Not implemented');
  }

  protected hydrateFromQueryParams(_queryParamMap: ParamMap): boolean {
    void _queryParamMap;
    throw new Error('Not implemented');
  }
}
