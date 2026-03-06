import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import {
  UserRole,
  WaitlistEntryListItemDto,
  WaitlistStatus,
  WaitlistSummaryCountsDto,
} from '@khana/shared-dtos';
import { TranslateModule } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../shared/services/api.service';
import { LocaleFormatService } from '../../shared/services/locale-format.service';
import { AuthStore } from '../../shared/state/auth.store';
import {
  UiStatusTone,
  UiStatusBadgeComponent,
} from '../../shared/components/ui';
import { FacilityContextStore } from '../../shared/state';
import { WAITLIST_UPCOMING_WINDOW_DAYS } from '../../shared/constants/waitlist.constants';

const DEFAULT_PAGE_SIZE = 20;
const WAITLIST_STATUSES = Object.values(WaitlistStatus);

type WaitlistSlotContext = {
  facilityId: string | null;
  startTime: string;
  endTime: string;
  source: 'booking-preview' | 'unknown';
};

@Component({
  selector: 'app-waitlist',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, UiStatusBadgeComponent],
  templateUrl: './waitlist.component.html',
  styleUrl: './waitlist.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WaitlistComponent {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly localeFormat = inject(LocaleFormatService);
  private readonly facilityContext = inject(FacilityContextStore);
  private readonly authStore = inject(AuthStore);
  private loadRequestSequence = 0;
  private readonly initialUpcomingRange = this.createUpcomingRange();
  private hasHydratedQueryParams = false;

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

  constructor() {
    this.facilityContext.initialize();
    this.bindQueryParams();
  }

  async applyFilters(): Promise<void> {
    this.page.set(1);
    await this.loadEntries();
  }

  async setToday(): Promise<void> {
    const today = this.toInputDate(new Date());
    this.fromDate.set(today);
    this.toDate.set(today);
    this.page.set(1);
    await this.loadEntries();
  }

  async setUpcoming(): Promise<void> {
    const range = this.createUpcomingRange();
    this.fromDate.set(range.from);
    this.toDate.set(range.to);
    this.page.set(1);
    await this.loadEntries();
  }

  onFacilityChange(value: string): void {
    this.facilityId.set(value);
    this.page.set(1);
    void this.loadEntries();
  }

  onStatusChange(value: string): void {
    if (this.isWaitlistStatus(value)) {
      this.statusFilter.set(value);
    } else {
      this.statusFilter.set('ALL');
    }
    this.page.set(1);
    void this.loadEntries();
  }

  async goToPage(page: number): Promise<void> {
    if (page < 1 || page > this.totalPages() || page === this.page()) {
      return;
    }

    this.page.set(page);
    await this.loadEntries();
  }

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

  private async loadEntries(): Promise<void> {
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

      if (requestSequence !== this.loadRequestSequence) {
        return;
      }

      this.items.set(response.items);
      this.summary.set(response.summary);
      this.total.set(response.total);
      this.page.set(response.page);
      this.pageSize.set(response.pageSize);
    } catch (error) {
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

  private bindQueryParams(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((queryParamMap) => {
        const filtersChanged = this.hydrateFromQueryParams(queryParamMap);

        if (!this.hasHydratedQueryParams) {
          this.hasHydratedQueryParams = true;
          this.page.set(1);
          void this.loadEntries();
          return;
        }

        if (filtersChanged) {
          this.page.set(1);
          void this.loadEntries();
        }
      });
  }

  private hydrateFromQueryParams(queryParamMap: ParamMap): boolean {
    const defaultUpcomingRange = this.createUpcomingRange();
    let nextFromDate = defaultUpcomingRange.from;
    let nextToDate = defaultUpcomingRange.to;
    let nextFacilityId = '';
    let nextStatusFilter: WaitlistStatus | 'ALL' = 'ALL';

    const dateParam = queryParamMap.get('date');
    if (dateParam === 'today') {
      const today = this.toInputDate(new Date());
      nextFromDate = today;
      nextToDate = today;
    } else if (this.isInputDate(dateParam)) {
      nextFromDate = dateParam;
      nextToDate = dateParam;
    }

    const facilityIdParam = queryParamMap.get('facilityId');
    if (facilityIdParam) {
      nextFacilityId = facilityIdParam;
    }

    const statusParam = queryParamMap.get('status');
    if (statusParam && this.isWaitlistStatus(statusParam)) {
      nextStatusFilter = statusParam;
    }

    const nextSlotContext = this.normalizeSlotContext({
      facilityId: queryParamMap.get('facilityId'),
      slotStart: queryParamMap.get('slotStart'),
      slotEnd: queryParamMap.get('slotEnd'),
      source: queryParamMap.get('source'),
    });

    let hasChanges = false;

    if (this.fromDate() !== nextFromDate) {
      this.fromDate.set(nextFromDate);
      hasChanges = true;
    }

    if (this.toDate() !== nextToDate) {
      this.toDate.set(nextToDate);
      hasChanges = true;
    }

    if (this.facilityId() !== nextFacilityId) {
      this.facilityId.set(nextFacilityId);
      hasChanges = true;
    }

    if (this.statusFilter() !== nextStatusFilter) {
      this.statusFilter.set(nextStatusFilter);
      hasChanges = true;
    }

    if (!this.areSlotContextsEqual(this.slotContext(), nextSlotContext)) {
      this.slotContext.set(nextSlotContext);
      hasChanges = true;
    }

    return hasChanges;
  }

  private isWaitlistStatus(value: string): value is WaitlistStatus {
    return WAITLIST_STATUSES.includes(value as WaitlistStatus);
  }

  private isInputDate(value: string | null): value is string {
    return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
  }

  private toInputDate(value: Date): string {
    const offset = value.getTimezoneOffset();
    const local = new Date(value.getTime() - offset * 60_000);
    return local.toISOString().slice(0, 10);
  }

  private toRangeIso(value: string, boundary: 'start' | 'end'): string | null {
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

  private toLocalDateInput(value: Date): string {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private toLocalTimeInput(value: Date): string {
    const hours = String(value.getHours()).padStart(2, '0');
    const minutes = String(value.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private createUpcomingRange(baseDate: Date = new Date()): {
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

  private normalizeSlotContext(params: {
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

  private isSlotContextMatch(
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

  private areSlotContextsEqual(
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

  private isAuthSensitiveError(error: unknown): boolean {
    return (
      error instanceof HttpErrorResponse && [401, 403].includes(error.status)
    );
  }
}
