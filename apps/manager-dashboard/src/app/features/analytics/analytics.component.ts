import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AnalyticsGroupBy, UserRole } from '@khana/shared-dtos';
import { LocaleFormatService } from '../../shared/services/locale-format.service';
import { FacilityContextStore } from '../../shared/state';
import { AuthStore } from '../../shared/state/auth.store';
import {
  AnalyticsStore,
  RangePreset,
} from '../../state/analytics/analytics.store';
import { DashboardStore } from '../../state/dashboard/dashboard.store';
import { TodaySnapshotComponent } from './today-snapshot/today-snapshot.component';

type TrendMetric = 'bookings' | 'revenue';
type TrendChartState = 'empty' | 'single_point' | 'sparse' | 'ready';
type TrendDensity = 'low' | 'medium' | 'high';

type TrendPointVm = {
  periodStart: string;
  dateKey: string;
  label: string;
  bookings: number;
  revenue: number;
  isObserved: boolean;
};

type TrendMarkerVm = {
  kind: 'first' | 'last';
  x: number;
  y: number;
  isObserved: boolean;
};

type TrendSegmentVm = {
  path: string;
  synthetic: boolean;
};

type TrendTickVm = {
  index: number;
  label: string;
};

type TrendSeriesVm = {
  points: TrendPointVm[];
  displayPoints: TrendPointVm[];
  linePath: string;
  areaPath: string;
  segments: TrendSegmentVm[];
  markers: TrendMarkerVm[];
  tickLabels: TrendTickVm[];
  startLabel: string;
  midLabel: string;
  endLabel: string;
  minValue: number;
  maxValue: number;
  latestValue: number;
  deltaPct: number;
  state: TrendChartState;
  observedCount: number;
  syntheticCount: number;
  density: TrendDensity;
  effectiveGroupBy: AnalyticsGroupBy;
};

type TrendBaseVm = {
  points: TrendPointVm[];
  observedCount: number;
  syntheticCount: number;
  density: TrendDensity;
  effectiveGroupBy: AnalyticsGroupBy;
};

const CHART_WIDTH = 100;
const CHART_BASELINE_Y = 40;
const CHART_TOP_Y = 4;
const CHART_GRID_LINES: ReadonlyArray<number> = [4, 16, 28, 40];
const CHART_MAX_RENDER_POINTS = 60;
const CHART_HEADROOM_RATIO = 1.12;
const GROUP_RANK: Record<AnalyticsGroupBy, number> = {
  day: 1,
  week: 2,
  month: 3,
};

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, TodaySnapshotComponent],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AnalyticsComponent {
  private readonly translateService = inject(TranslateService, {
    optional: true,
  });
  private readonly localeFormat = inject(LocaleFormatService);
  private readonly facilityContext = inject(FacilityContextStore);
  private readonly authStore = inject(AuthStore);
  private readonly dashboardStore = inject(DashboardStore);
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

  constructor() {
    this.facilityContext.initialize();
    this.store.setQuickRange('this_month', this.weekStartsOnSunday());
    const initialFilters = this.store.filters();
    this.fromDate.set(this.toInputDate(initialFilters.from));
    this.toDate.set(this.toInputDate(initialFilters.to));
    this.activePreset.set('this_month');
    void this.store.loadAnalytics();

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
    }
  }

  async applyFilters(): Promise<void> {
    const from = this.fromDate();
    const to = this.toDate();

    const fromIso = this.toRangeIso(from, 'start');
    const toIso = this.toRangeIso(to, 'end');

    if (!fromIso || !toIso || fromIso > toIso) {
      this.filterError.set('DASHBOARD.PAGES.ANALYTICS.ERRORS.INVALID_RANGE');
      return;
    }

    this.filterError.set(null);
    this.store.setDateRange(fromIso, toIso);
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

  trendStateHintKey(state: TrendChartState): string | null {
    if (state === 'single_point') {
      return 'DASHBOARD.PAGES.ANALYTICS.CHARTS.SINGLE_POINT_HINT';
    }
    if (state === 'sparse') {
      return 'DASHBOARD.PAGES.ANALYTICS.CHARTS.SPARSE_DATA_HINT';
    }
    return null;
  }

  trendTickPosition(vm: TrendSeriesVm, tick: TrendTickVm): number {
    if (vm.displayPoints.length <= 1) {
      return 50;
    }

    return Number(
      ((tick.index * 100) / (vm.displayPoints.length - 1)).toFixed(2)
    );
  }

  trendDeltaClass(
    vm: TrendSeriesVm
  ):
    | 'trend-chart__delta--up'
    | 'trend-chart__delta--down'
    | 'trend-chart__delta--flat' {
    if (vm.deltaPct > 0.5) return 'trend-chart__delta--up';
    if (vm.deltaPct < -0.5) return 'trend-chart__delta--down';
    return 'trend-chart__delta--flat';
  }

  trendDeltaLabel(metric: TrendMetric, vm: TrendSeriesVm): string {
    const metricLabel = this.text(this.metricTitleKey(metric));
    const delta = this.formatPercent(Math.abs(vm.deltaPct));
    const trendClass = this.trendDeltaClass(vm);

    if (trendClass === 'trend-chart__delta--up') {
      return this.text('DASHBOARD.PAGES.ANALYTICS.CHARTS.DELTA_UP', {
        metric: metricLabel,
        pct: delta,
      });
    }
    if (trendClass === 'trend-chart__delta--down') {
      return this.text('DASHBOARD.PAGES.ANALYTICS.CHARTS.DELTA_DOWN', {
        metric: metricLabel,
        pct: delta,
      });
    }

    return this.text('DASHBOARD.PAGES.ANALYTICS.CHARTS.DELTA_FLAT', {
      metric: metricLabel,
    });
  }

  trendSummary(metric: TrendMetric, vm: TrendSeriesVm): string {
    return this.trendDeltaLabel(metric, vm);
  }

  trendObservedSyntheticSummary(vm: TrendSeriesVm): string {
    if (vm.syntheticCount <= 0) {
      return '';
    }

    return this.text('DASHBOARD.PAGES.ANALYTICS.CHARTS.SYNTHETIC_BREAKDOWN', {
      observed: this.formatNumber(vm.observedCount),
      synthetic: this.formatNumber(vm.syntheticCount),
    });
  }

  formatTrendMetricValue(metric: TrendMetric, value: number): string {
    return metric === 'revenue'
      ? this.formatCurrency(value)
      : this.formatNumber(value);
  }

  text(key: string, params?: Record<string, unknown>): string {
    const translated = this.translateService?.instant(key, params);
    return translated && translated !== key ? translated : key;
  }

  formatCurrency(value: number): string {
    return this.localeFormat.formatCurrency(value, 'SAR', {
      maximumFractionDigits: 2,
    });
  }

  formatPercent(value: number): string {
    return `${this.formatNumber(value, 2)}%`;
  }

  formatNumber(value: number, maxFractionDigits = 0): string {
    const locale = this.localeFormat.getCurrentLocale();
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: maxFractionDigits,
    }).format(value);
  }

  private metricTitleKey(metric: TrendMetric): string {
    return metric === 'bookings'
      ? 'DASHBOARD.PAGES.ANALYTICS.CHARTS.BOOKINGS_TREND'
      : 'DASHBOARD.PAGES.ANALYTICS.CHARTS.REVENUE_TREND';
  }

  private buildTrendBaseVm(): TrendBaseVm {
    const observedPoints = this.buildObservedTrendPoints();
    const effectiveGroupBy = this.resolveEffectiveGroupBy();
    const grouped = this.regroupTrendPoints(observedPoints, effectiveGroupBy);
    const points =
      effectiveGroupBy === 'day' ? this.fillDailyGaps(grouped) : grouped;

    const observedCount = points.filter((point) => point.isObserved).length;
    const syntheticCount = Math.max(points.length - observedCount, 0);

    return {
      points,
      observedCount,
      syntheticCount,
      density: this.resolveTrendDensity(points.length),
      effectiveGroupBy,
    };
  }

  private buildObservedTrendPoints(): TrendPointVm[] {
    const selectedGroupBy = this.groupBy();

    return (this.revenue()?.trend ?? [])
      .slice()
      .sort(
        (left, right) =>
          new Date(left.periodStart).getTime() -
          new Date(right.periodStart).getTime()
      )
      .map((point) => ({
        periodStart: point.periodStart,
        dateKey: this.toDateKey(point.periodStart),
        label: this.formatTrendLabel(
          point.periodStart,
          point.periodLabel,
          selectedGroupBy
        ),
        bookings: point.bookings,
        revenue: point.revenue,
        isObserved: true,
      }));
  }

  private regroupTrendPoints(
    points: TrendPointVm[],
    targetGroupBy: AnalyticsGroupBy
  ): TrendPointVm[] {
    if (points.length === 0 || targetGroupBy === 'day') {
      return points;
    }

    const grouped = new Map<string, TrendPointVm>();
    const preserveWeekLabel =
      this.groupBy() === 'week' && targetGroupBy === 'week';

    for (const point of points) {
      const date = new Date(point.periodStart);
      if (Number.isNaN(date.getTime())) {
        continue;
      }

      const bucketStart =
        targetGroupBy === 'week'
          ? this.startOfWeek(date, this.weekStartsOnSunday())
          : this.startOfMonth(date);
      const periodStart = bucketStart.toISOString();
      const key = this.toDateKey(bucketStart);
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, {
          periodStart,
          dateKey: key,
          label: this.formatTrendLabel(
            periodStart,
            preserveWeekLabel ? point.label : undefined,
            targetGroupBy
          ),
          bookings: point.bookings,
          revenue: point.revenue,
          isObserved: point.isObserved,
        });
        continue;
      }

      existing.bookings += point.bookings;
      existing.revenue += point.revenue;
      existing.isObserved = existing.isObserved || point.isObserved;
    }

    return Array.from(grouped.values()).sort(
      (left, right) =>
        new Date(left.periodStart).getTime() -
        new Date(right.periodStart).getTime()
    );
  }

  private fillDailyGaps(points: TrendPointVm[]): TrendPointVm[] {
    const from = this.parseInputDate(this.fromDate());
    const to = this.parseInputDate(this.toDate());

    if (!from || !to || from.getTime() > to.getTime()) {
      return points;
    }

    const byDateKey = new Map(points.map((point) => [point.dateKey, point]));
    const normalized: TrendPointVm[] = [];
    const cursor = new Date(from);

    while (cursor.getTime() <= to.getTime()) {
      const key = this.toDateKey(cursor);
      const existing = byDateKey.get(key);
      const periodStart = new Date(
        cursor.getFullYear(),
        cursor.getMonth(),
        cursor.getDate(),
        0,
        0,
        0,
        0
      ).toISOString();

      normalized.push({
        periodStart,
        dateKey: key,
        label:
          existing?.label ??
          this.formatTrendLabel(periodStart, undefined, 'day'),
        bookings: existing?.bookings ?? 0,
        revenue: existing?.revenue ?? 0,
        isObserved: existing?.isObserved ?? false,
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    return normalized;
  }

  private buildTrendSeriesVm(metric: TrendMetric): TrendSeriesVm {
    const base = this.trendBaseVm();
    const points = base.points;
    const displayPoints = this.decimatePoints(
      points,
      metric,
      CHART_MAX_RENDER_POINTS
    );

    if (displayPoints.length === 0) {
      return {
        points: [],
        displayPoints: [],
        linePath: '',
        areaPath: '',
        segments: [],
        markers: [],
        tickLabels: [],
        startLabel: '',
        midLabel: '',
        endLabel: '',
        minValue: 0,
        maxValue: 0,
        latestValue: 0,
        deltaPct: 0,
        state: 'empty',
        observedCount: base.observedCount,
        syntheticCount: base.syntheticCount,
        density: base.density,
        effectiveGroupBy: base.effectiveGroupBy,
      };
    }

    const values = displayPoints.map((point) =>
      this.metricValue(point, metric)
    );
    const sourceValues = points.map((point) => this.metricValue(point, metric));
    const maxForScale = Math.max(Math.max(...values) * CHART_HEADROOM_RATIO, 1);
    const coordinates = this.buildCoordinates(
      displayPoints,
      metric,
      maxForScale
    );
    const midpointIndex = Math.floor((displayPoints.length - 1) / 2);

    return {
      points,
      displayPoints,
      linePath: this.buildLinePath(coordinates),
      areaPath: this.buildAreaPath(coordinates),
      segments: this.buildLineSegments(coordinates),
      markers:
        coordinates.length === 1
          ? [
              {
                kind: 'last',
                x: coordinates[0].x,
                y: coordinates[0].y,
                isObserved: coordinates[0].isObserved,
              },
            ]
          : [
              {
                kind: 'first',
                x: coordinates[0].x,
                y: coordinates[0].y,
                isObserved: coordinates[0].isObserved,
              },
              {
                kind: 'last',
                x: coordinates[coordinates.length - 1].x,
                y: coordinates[coordinates.length - 1].y,
                isObserved: coordinates[coordinates.length - 1].isObserved,
              },
            ],
      tickLabels: this.buildTickLabels(displayPoints),
      startLabel: displayPoints[0].label,
      midLabel: displayPoints[midpointIndex].label,
      endLabel: displayPoints[displayPoints.length - 1].label,
      minValue: sourceValues.length > 0 ? Math.min(...sourceValues) : 0,
      maxValue: sourceValues.length > 0 ? Math.max(...sourceValues) : 0,
      latestValue:
        sourceValues.length > 0 ? sourceValues[sourceValues.length - 1] : 0,
      deltaPct: this.calculateDeltaPct(values),
      state: this.resolveTrendState(
        displayPoints.length,
        base.observedCount,
        base.syntheticCount
      ),
      observedCount: base.observedCount,
      syntheticCount: base.syntheticCount,
      density: base.density,
      effectiveGroupBy: base.effectiveGroupBy,
    };
  }

  private resolveTrendState(
    pointCount: number,
    observedCount: number,
    syntheticCount: number
  ): TrendChartState {
    if (pointCount === 0) return 'empty';
    if (pointCount === 1) return 'single_point';

    if (syntheticCount > observedCount || pointCount < 4) {
      return 'sparse';
    }

    return 'ready';
  }

  private resolveTrendDensity(pointCount: number): TrendDensity {
    if (pointCount < 8) {
      return 'low';
    }
    if (pointCount < 24) {
      return 'medium';
    }
    return 'high';
  }

  private resolveEffectiveGroupBy(): AnalyticsGroupBy {
    const selected = this.groupBy();
    const rangeDays = this.selectedRangeDays();
    const rangeGroup = this.rangeGroupByForDays(rangeDays);
    return GROUP_RANK[selected] >= GROUP_RANK[rangeGroup]
      ? selected
      : rangeGroup;
  }

  private rangeGroupByForDays(rangeDays: number): AnalyticsGroupBy {
    if (rangeDays <= 31) {
      return 'day';
    }
    if (rangeDays <= 180) {
      return 'week';
    }
    return 'month';
  }

  private selectedRangeDays(): number {
    const from = this.parseInputDate(this.fromDate());
    const to = this.parseInputDate(this.toDate());

    if (!from || !to || from.getTime() > to.getTime()) {
      return 1;
    }

    const diffMs = to.getTime() - from.getTime();
    return Math.floor(diffMs / 86_400_000) + 1;
  }

  private decimatePoints(
    points: TrendPointVm[],
    metric: TrendMetric,
    maxPoints: number
  ): TrendPointVm[] {
    if (points.length <= maxPoints) {
      return points;
    }

    const interiorCount = points.length - 2;
    if (interiorCount <= 0) {
      return points;
    }

    const segmentCount = Math.max(1, Math.floor((maxPoints - 2) / 2));
    const segmentSize = Math.ceil(interiorCount / segmentCount);
    const picked = new Set<number>([0, points.length - 1]);

    for (let start = 1; start < points.length - 1; start += segmentSize) {
      const end = Math.min(start + segmentSize, points.length - 1);
      let minIndex = start;
      let maxIndex = start;

      for (let index = start; index < end; index += 1) {
        if (
          this.metricValue(points[index], metric) <
          this.metricValue(points[minIndex], metric)
        ) {
          minIndex = index;
        }
        if (
          this.metricValue(points[index], metric) >
          this.metricValue(points[maxIndex], metric)
        ) {
          maxIndex = index;
        }
      }

      picked.add(minIndex);
      picked.add(maxIndex);
    }

    return Array.from(picked)
      .sort((left, right) => left - right)
      .map((index) => points[index]);
  }

  private calculateDeltaPct(values: number[]): number {
    if (values.length < 2) return 0;

    const latest = values[values.length - 1];
    const previous = values[values.length - 2];

    if (previous === 0) {
      return latest === 0 ? 0 : 100;
    }

    return Number(
      (((latest - previous) / Math.abs(previous)) * 100).toFixed(2)
    );
  }

  private buildCoordinates(
    points: TrendPointVm[],
    metric: TrendMetric,
    maxForScale: number
  ): Array<{ x: number; y: number; isObserved: boolean }> {
    if (points.length === 1) {
      const point = points[0];
      return [
        {
          x: Number((CHART_WIDTH / 2).toFixed(2)),
          y: this.toChartY(this.metricValue(point, metric), maxForScale),
          isObserved: point.isObserved,
        },
      ];
    }

    const step = CHART_WIDTH / Math.max(points.length - 1, 1);

    return points.map((point, index) => ({
      x: Number((index * step).toFixed(2)),
      y: this.toChartY(this.metricValue(point, metric), maxForScale),
      isObserved: point.isObserved,
    }));
  }

  private buildTickLabels(points: TrendPointVm[]): TrendTickVm[] {
    if (points.length === 0) {
      return [];
    }

    const targetCount =
      points.length <= 6 ? points.length : points.length <= 20 ? 4 : 6;

    if (targetCount === 1) {
      return [{ index: 0, label: points[0].label }];
    }

    const indices = new Set<number>();
    for (let i = 0; i < targetCount; i += 1) {
      const index = Math.round((i * (points.length - 1)) / (targetCount - 1));
      indices.add(index);
    }

    return Array.from(indices)
      .sort((left, right) => left - right)
      .map((index) => ({ index, label: points[index].label }));
  }

  private buildLinePath(
    coords: Array<{ x: number; y: number; isObserved: boolean }>
  ): string {
    if (coords.length === 0) {
      return '';
    }

    return coords
      .map((coord, index) =>
        index === 0 ? `M ${coord.x} ${coord.y}` : `L ${coord.x} ${coord.y}`
      )
      .join(' ');
  }

  private buildLineSegments(
    coords: Array<{ x: number; y: number; isObserved: boolean }>
  ): TrendSegmentVm[] {
    if (coords.length === 0) {
      return [];
    }

    if (coords.length === 1) {
      const point = coords[0];
      const startX = Number(Math.max(0, point.x - 6).toFixed(2));
      const endX = Number(Math.min(CHART_WIDTH, point.x + 6).toFixed(2));
      return [
        {
          path: `M ${startX} ${point.y} L ${endX} ${point.y}`,
          synthetic: !point.isObserved,
        },
      ];
    }

    const segments: TrendSegmentVm[] = [];

    for (let index = 0; index < coords.length - 1; index += 1) {
      const current = coords[index];
      const next = coords[index + 1];
      segments.push({
        path: `M ${current.x} ${current.y} L ${next.x} ${next.y}`,
        synthetic: !current.isObserved || !next.isObserved,
      });
    }

    return segments;
  }

  private buildAreaPath(
    coords: Array<{ x: number; y: number; isObserved: boolean }>
  ): string {
    if (coords.length === 0) return '';

    if (coords.length === 1) {
      const point = coords[0];
      const startX = Number(Math.max(0, point.x - 6).toFixed(2));
      const endX = Number(Math.min(CHART_WIDTH, point.x + 6).toFixed(2));
      return `M ${startX} ${CHART_BASELINE_Y} L ${startX} ${point.y} L ${endX} ${point.y} L ${endX} ${CHART_BASELINE_Y} Z`;
    }

    const lineSegment = coords
      .map((coord) => `L ${coord.x} ${coord.y}`)
      .join(' ');
    return `M ${coords[0].x} ${CHART_BASELINE_Y} ${lineSegment} L ${
      coords[coords.length - 1].x
    } ${CHART_BASELINE_Y} Z`;
  }

  private toChartY(value: number, maxForScale: number): number {
    const ratio = Math.max(value, 0) / maxForScale;
    return Number(
      (CHART_BASELINE_Y - ratio * (CHART_BASELINE_Y - CHART_TOP_Y)).toFixed(2)
    );
  }

  private metricValue(point: TrendPointVm, metric: TrendMetric): number {
    return metric === 'bookings' ? point.bookings : point.revenue;
  }

  private formatTrendLabel(
    periodStart: string,
    periodLabel?: string,
    groupBy: AnalyticsGroupBy = this.groupBy()
  ): string {
    if (groupBy === 'week' && periodLabel) {
      return periodLabel;
    }

    if (groupBy === 'month') {
      return this.localeFormat.formatDate(periodStart, {
        month: 'short',
        year: 'numeric',
      });
    }

    return this.localeFormat.formatDate(periodStart, {
      month: 'short',
      day: 'numeric',
    });
  }

  private startOfWeek(date: Date, weekStartsOnSunday: boolean): Date {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const day = start.getDay();
    const offset = weekStartsOnSunday ? day : day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - offset);
    return start;
  }

  private startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  }

  private toDateKey(value: Date | string): string {
    const date = value instanceof Date ? new Date(value) : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private toInputDate(isoDate: string): string {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private parseInputDate(value: string): Date | null {
    const [yearRaw, monthRaw, dayRaw] = value
      .split('-')
      .map((part) => Number(part));
    if (!yearRaw || !monthRaw || !dayRaw) return null;

    const date = new Date(yearRaw, monthRaw - 1, dayRaw, 0, 0, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private toRangeIso(value: string, edge: 'start' | 'end'): string | null {
    const [yearRaw, monthRaw, dayRaw] = value
      .split('-')
      .map((part) => Number(part));
    if (!yearRaw || !monthRaw || !dayRaw) return null;

    const date = new Date(
      yearRaw,
      monthRaw - 1,
      dayRaw,
      edge === 'start' ? 0 : 23,
      edge === 'start' ? 0 : 59,
      edge === 'start' ? 0 : 59,
      edge === 'start' ? 0 : 999
    );

    if (Number.isNaN(date.getTime())) {
      return null;
    }
    return date.toISOString();
  }

  private weekStartsOnSunday(): boolean {
    return this.localeFormat.getCurrentLocale().toLowerCase().startsWith('ar');
  }
}
