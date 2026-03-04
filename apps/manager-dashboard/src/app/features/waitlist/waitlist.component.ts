import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  WaitlistEntryListItemDto,
  WaitlistStatus,
  WaitlistSummaryCountsDto,
} from '@khana/shared-dtos';
import { TranslateModule } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../../shared/services/api.service';
import { LocaleFormatService } from '../../shared/services/locale-format.service';
import { FacilityContextStore } from '../../shared/state';

const DEFAULT_PAGE_SIZE = 20;
const WAITLIST_STATUSES = Object.values(WaitlistStatus);

@Component({
  selector: 'app-waitlist',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
  templateUrl: './waitlist.component.html',
  styleUrl: './waitlist.component.scss',
})
export class WaitlistComponent {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly localeFormat = inject(LocaleFormatService);
  private readonly facilityContext = inject(FacilityContextStore);

  readonly facilities = this.facilityContext.facilities;

  readonly loading = signal(false);
  readonly error = signal<Error | null>(null);
  readonly filterError = signal<string | null>(null);

  readonly fromDate = signal(this.toInputDate(new Date()));
  readonly toDate = signal(this.toInputDate(new Date()));
  readonly facilityId = signal('');
  readonly statusFilter = signal<WaitlistStatus | 'ALL'>('ALL');

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

  readonly statusOptions: ReadonlyArray<WaitlistStatus | 'ALL'> = [
    'ALL',
    WaitlistStatus.WAITING,
    WaitlistStatus.NOTIFIED,
    WaitlistStatus.EXPIRED,
    WaitlistStatus.FULFILLED,
  ];

  constructor() {
    this.facilityContext.initialize();
    this.hydrateFromQueryParams();
    void this.loadEntries();
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

  private async loadEntries(): Promise<void> {
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

      this.items.set(response.items);
      this.summary.set(response.summary);
      this.total.set(response.total);
      this.page.set(response.page);
      this.pageSize.set(response.pageSize);
    } catch (error) {
      this.error.set(error as Error);
    } finally {
      this.loading.set(false);
    }
  }

  private hydrateFromQueryParams(): void {
    const queryParamMap = this.route.snapshot.queryParamMap;
    const dateParam = queryParamMap.get('date');
    if (dateParam === 'today') {
      const today = this.toInputDate(new Date());
      this.fromDate.set(today);
      this.toDate.set(today);
    }

    const statusParam = queryParamMap.get('status');
    if (statusParam && this.isWaitlistStatus(statusParam)) {
      this.statusFilter.set(statusParam);
    }
  }

  private isWaitlistStatus(value: string): value is WaitlistStatus {
    return WAITLIST_STATUSES.includes(value as WaitlistStatus);
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
}
