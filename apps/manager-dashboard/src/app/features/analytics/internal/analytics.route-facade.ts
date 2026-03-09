import { effect } from '@angular/core';
import { AnalyticsGroupBy } from '@khana/shared-dtos';
import { RangePreset } from '../../../state/analytics/analytics.store';
import {
  TrendChartState,
  TrendMetric,
  TrendSeriesVm,
  TrendTickVm,
} from './analytics.route.models';
import { AnalyticsRouteTrendsBase } from './analytics.route-trends';

/**
 * Route-scoped facade for the analytics page. The component inherits this
 * class so filters and VM orchestration stay out of the route shell.
 */
export class AnalyticsRouteFacade extends AnalyticsRouteTrendsBase {
  constructor() {
    super();

    this.facilityContext.initialize();
    this.store.syncTenantTimeZone(this.localeFormat.getCurrentTimeZone());
    this.store.setQuickRange('this_month', this.weekStartsOnSunday());
    const initialFilters = this.store.filters();
    this.fromDate.set(this.toInputDate(initialFilters.from));
    this.toDate.set(this.toInputDate(initialFilters.to));
    this.activePreset.set('this_month');
    void this.store.loadAnalytics();

    effect(() => {
      const tenantTimeZone = this.localeFormat.getCurrentTimeZone();
      if (this.store.filters().timeZone === tenantTimeZone) {
        return;
      }
      this.store.setTimeZone(tenantTimeZone);
    });

    effect(() => {
      if (!this.canViewSnapshot()) {
        return;
      }

      const facilityId = this.facilityId() || undefined;
      void this.dashboardStore.loadSnapshot(facilityId);
    });
  }

  onGroupByChange(value: AnalyticsGroupBy): void {
    this.groupBy.set(value);
    void this.applyFilters();
  }

  onFacilityChange(value: string): void {
    this.facilityId.set(value);
    void this.applyFilters();
  }

  onDateChange(): void {
    this.filterError.set(null);
    this.activePreset.set(null);
  }

  onFromDateChange(value: string): void {
    this.fromDate.set(value);
    this.onDateChange();
  }

  onToDateChange(value: string): void {
    this.toDate.set(value);
    this.onDateChange();
  }

  async selectQuickRange(preset: RangePreset): Promise<void> {
    this.store.setQuickRange(preset, this.weekStartsOnSunday());
    const filters = this.store.filters();
    this.fromDate.set(this.toInputDate(filters.from));
    this.toDate.set(this.toInputDate(filters.to));
    this.filterError.set(null);
    this.activePreset.set(preset);
    this.showBookingsDetails.set(false);
    this.showRevenueDetails.set(false);
    await this.store.loadAnalytics();
  }

  presetLabelKey(preset: RangePreset): string {
    switch (preset) {
      case 'today':
        return 'DASHBOARD.PAGES.ANALYTICS.DATE_PRESETS.TODAY';
      case 'this_week':
        return 'DASHBOARD.PAGES.ANALYTICS.DATE_PRESETS.THIS_WEEK';
      case 'this_month':
        return 'DASHBOARD.PAGES.ANALYTICS.DATE_PRESETS.THIS_MONTH';
      case 'last_30_days':
        return 'DASHBOARD.PAGES.ANALYTICS.DATE_PRESETS.LAST_30_DAYS';
      case 'last_90_days':
        return 'DASHBOARD.PAGES.ANALYTICS.DATE_PRESETS.LAST_90_DAYS';
      default:
        return 'DASHBOARD.PAGES.ANALYTICS.DATE_PRESETS.TODAY';
    }
  }

  async applyFilters(): Promise<void> {
    const fromDate = this.normalizeInputDate(this.fromDate());
    const toDate = this.normalizeInputDate(this.toDate());

    if (!fromDate || !toDate || fromDate > toDate) {
      this.filterError.set('DASHBOARD.PAGES.ANALYTICS.ERRORS.INVALID_RANGE');
      return;
    }

    this.filterError.set(null);
    this.store.setDateRange(fromDate, toDate);
    this.store.setGroupBy(this.groupBy());
    this.store.setFacilityFilter(this.facilityId() || null);
    this.showBookingsDetails.set(false);
    this.showRevenueDetails.set(false);
    await this.store.loadAnalytics();
  }

  async retryLoad(): Promise<void> {
    this.store.clearError();
    await this.store.loadAnalytics();
  }

  toggleTrendDetails(metric: TrendMetric): void {
    if (metric === 'bookings') {
      this.showBookingsDetails.update((value) => !value);
      return;
    }
    this.showRevenueDetails.update((value) => !value);
  }

  isTrendDetailsOpen(metric: TrendMetric): boolean {
    return metric === 'bookings'
      ? this.showBookingsDetails()
      : this.showRevenueDetails();
  }

  override trendStateHintKey(state: TrendChartState): string | null {
    return super.trendStateHintKey(state);
  }

  override trendTickPosition(vm: TrendSeriesVm, tick: TrendTickVm): number {
    return super.trendTickPosition(vm, tick);
  }
}
