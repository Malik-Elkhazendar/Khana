import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ParamMap } from '@angular/router';
import { WaitlistStatus } from '@khana/shared-dtos';
import { WaitlistRouteState } from './waitlist.route-state';

/**
 * Waitlist route facade keeps query-param hydration and filter actions out of the
 * standalone component root so the page entrypoint stays readable.
 */
export class WaitlistRouteFacade extends WaitlistRouteState {
  constructor() {
    super();
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

  protected override bindQueryParams(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((queryParamMap) => {
        // Hydrate from the URL so links coming from booking-preview can prefill
        // the relevant slot and facility on first open.
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

  protected override hydrateFromQueryParams(queryParamMap: ParamMap): boolean {
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
}
