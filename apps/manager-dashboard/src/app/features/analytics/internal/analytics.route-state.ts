import { computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { AnalyticsGroupBy, UserRole } from '@khana/shared-dtos';
import { LocaleFormatService } from '../../../shared/services/locale-format.service';
import { FacilityContextStore } from '../../../shared/state';
import { AuthStore } from '../../../shared/state/auth.store';
import {
  AnalyticsStore,
  RangePreset,
} from '../../../state/analytics/analytics.store';
import { DashboardStore } from '../../../state/dashboard/dashboard.store';
import {
  CHART_GRID_LINES,
  DAY_IN_MS,
  TrendBaseVm,
  TrendMetric,
  TrendSeriesVm,
} from './analytics.route.models';

export abstract class AnalyticsRouteStateBase {
  protected readonly translateService = inject(TranslateService, {
    optional: true,
  });
  protected readonly localeFormat = inject(LocaleFormatService);
  protected readonly facilityContext = inject(FacilityContextStore);
  protected readonly authStore = inject(AuthStore);
  protected readonly dashboardStore = inject(DashboardStore);
  readonly store = inject(AnalyticsStore);

  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly summary = this.store.summary;
  readonly occupancy = this.store.occupancy;
  readonly revenue = this.store.revenue;
  readonly peakHours = this.store.peakHours;
  readonly facilities = this.facilityContext.facilities;
  readonly snapshot = this.dashboardStore.snapshot;
  readonly loadingSnapshot = this.dashboardStore.loadingSnapshot;
  readonly canViewSnapshot = computed(() => {
    const role = this.authStore.user()?.role;
    return role === UserRole.OWNER || role === UserRole.MANAGER;
  });

  readonly fromDate = signal(this.toInputDate(this.store.filters().from));
  readonly toDate = signal(this.toInputDate(this.store.filters().to));
  readonly groupBy = signal<AnalyticsGroupBy>(this.store.filters().groupBy);
  readonly facilityId = signal(this.store.filters().facilityId ?? '');
  readonly filterError = signal<string | null>(null);
  readonly activePreset = signal<RangePreset | null>(null);
  readonly quickRanges: ReadonlyArray<RangePreset> = [
    'today',
    'this_week',
    'this_month',
    'last_30_days',
    'last_90_days',
  ];
  readonly previousPeriodTooltipMeta = computed<{
    key:
      | 'DASHBOARD.PAGES.ANALYTICS.KPI.PERIOD_TOOLTIP_SINGLE'
      | 'DASHBOARD.PAGES.ANALYTICS.KPI.PERIOD_TOOLTIP_MULTI';
    params: { from: string; to: string; count?: number };
  }>(() => {
    const filters = this.store.filters();
    const currentFrom = new Date(filters.from);
    const currentTo = new Date(filters.to);

    if (
      Number.isNaN(currentFrom.getTime()) ||
      Number.isNaN(currentTo.getTime()) ||
      currentFrom.getTime() > currentTo.getTime()
    ) {
      return {
        key: 'DASHBOARD.PAGES.ANALYTICS.KPI.PERIOD_TOOLTIP_MULTI',
        params: { from: '', to: '', count: 0 },
      };
    }

    const currentFromDay = new Date(currentFrom);
    currentFromDay.setHours(0, 0, 0, 0);
    const currentToDay = new Date(currentTo);
    currentToDay.setHours(0, 0, 0, 0);

    const diffMs = currentToDay.getTime() - currentFromDay.getTime();
    const days = Math.max(1, Math.floor(diffMs / DAY_IN_MS) + 1);

    const prevTo = new Date(currentFromDay.getTime() - 1);
    const prevFrom = new Date(prevTo.getTime() - (days - 1) * DAY_IN_MS);

    const from = this.localeFormat.formatDate(prevFrom.toISOString(), {
      day: 'numeric',
      month: 'short',
    });
    const to = this.localeFormat.formatDate(prevTo.toISOString(), {
      day: 'numeric',
      month: 'short',
    });

    if (days === 1) {
      return {
        key: 'DASHBOARD.PAGES.ANALYTICS.KPI.PERIOD_TOOLTIP_SINGLE',
        params: { from, to },
      };
    }

    return {
      key: 'DASHBOARD.PAGES.ANALYTICS.KPI.PERIOD_TOOLTIP_MULTI',
      params: { from, to, count: days },
    };
  });

  readonly chartGridLines = CHART_GRID_LINES;
  readonly showBookingsDetails = signal(false);
  readonly showRevenueDetails = signal(false);

  readonly trendBaseVm = computed<TrendBaseVm>(() => this.buildTrendBaseVm());
  readonly bookingsTrendVm = computed<TrendSeriesVm>(() =>
    this.buildTrendSeriesVm('bookings')
  );
  readonly revenueTrendVm = computed<TrendSeriesVm>(() =>
    this.buildTrendSeriesVm('revenue')
  );

  readonly occupancySeries = computed(() => this.occupancy()?.facilities ?? []);
  readonly hasAnyData = computed(() => {
    return Boolean(
      this.summary() ||
        (this.revenue()?.trend.length ?? 0) > 0 ||
        (this.occupancy()?.facilities.length ?? 0) > 0
    );
  });

  protected abstract buildTrendBaseVm(): TrendBaseVm;
  protected abstract buildTrendSeriesVm(metric: TrendMetric): TrendSeriesVm;
  protected abstract toInputDate(isoDate: string): string;
  protected abstract weekStartsOnSunday(): boolean;
}
