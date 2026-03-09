import { AnalyticsGroupBy } from '@khana/shared-dtos';
import {
  CHART_BASELINE_Y,
  CHART_HEADROOM_RATIO,
  CHART_MAX_RENDER_POINTS,
  CHART_TOP_Y,
  CHART_WIDTH,
  DAY_IN_MS,
  GROUP_RANK,
  TrendBaseVm,
  TrendChartState,
  TrendDensity,
  TrendMetric,
  TrendPointVm,
  TrendSegmentVm,
  TrendSeriesVm,
  TrendTickVm,
} from './analytics.route.models';
import { AnalyticsRouteFormattingBase } from './analytics.route-formatting';

export abstract class AnalyticsRouteTrendsBase extends AnalyticsRouteFormattingBase {
  protected buildTrendBaseVm(): TrendBaseVm {
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

  protected buildObservedTrendPoints(): TrendPointVm[] {
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

  protected regroupTrendPoints(
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

  protected fillDailyGaps(points: TrendPointVm[]): TrendPointVm[] {
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

  protected buildTrendSeriesVm(metric: TrendMetric): TrendSeriesVm {
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

  protected resolveTrendState(
    pointCount: number,
    observedCount: number,
    syntheticCount: number
  ): TrendChartState {
    if (pointCount === 0) return 'empty';
    if (pointCount === 1) return 'single_point';
    if (syntheticCount > observedCount || pointCount < 4) return 'sparse';
    return 'ready';
  }

  protected resolveTrendDensity(pointCount: number): TrendDensity {
    if (pointCount < 8) return 'low';
    if (pointCount < 24) return 'medium';
    return 'high';
  }

  protected resolveEffectiveGroupBy(): AnalyticsGroupBy {
    const selected = this.groupBy();
    const rangeDays = this.selectedRangeDays();
    const rangeGroup = this.rangeGroupByForDays(rangeDays);
    return GROUP_RANK[selected] >= GROUP_RANK[rangeGroup]
      ? selected
      : rangeGroup;
  }

  protected rangeGroupByForDays(rangeDays: number): AnalyticsGroupBy {
    if (rangeDays <= 31) return 'day';
    if (rangeDays <= 180) return 'week';
    return 'month';
  }

  protected selectedRangeDays(): number {
    const from = this.parseInputDate(this.fromDate());
    const to = this.parseInputDate(this.toDate());

    if (!from || !to || from.getTime() > to.getTime()) {
      return 1;
    }

    const diffMs = to.getTime() - from.getTime();
    return Math.floor(diffMs / DAY_IN_MS) + 1;
  }

  protected decimatePoints(
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

  protected calculateDeltaPct(values: number[]): number {
    if (values.length < 2) {
      return 0;
    }

    const latest = values[values.length - 1];
    const previous = values[values.length - 2];

    if (previous === 0) {
      return latest === 0 ? 0 : 100;
    }

    return Number(
      (((latest - previous) / Math.abs(previous)) * 100).toFixed(2)
    );
  }

  protected buildCoordinates(
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

  protected buildTickLabels(points: TrendPointVm[]): TrendTickVm[] {
    if (points.length === 0) return [];

    const targetCount =
      points.length <= 6 ? points.length : points.length <= 20 ? 4 : 6;

    if (targetCount === 1) return [{ index: 0, label: points[0].label }];

    const indices = new Set<number>();
    for (let index = 0; index < targetCount; index += 1) {
      const pointIndex = Math.round(
        (index * (points.length - 1)) / (targetCount - 1)
      );
      indices.add(pointIndex);
    }

    return Array.from(indices)
      .sort((left, right) => left - right)
      .map((index) => ({ index, label: points[index].label }));
  }

  protected buildLinePath(
    coords: Array<{ x: number; y: number; isObserved: boolean }>
  ): string {
    if (coords.length === 0) return '';

    return coords
      .map((coord, index) =>
        index === 0 ? `M ${coord.x} ${coord.y}` : `L ${coord.x} ${coord.y}`
      )
      .join(' ');
  }

  protected buildLineSegments(
    coords: Array<{ x: number; y: number; isObserved: boolean }>
  ): TrendSegmentVm[] {
    if (coords.length === 0) return [];

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

  protected buildAreaPath(
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

  protected toChartY(value: number, maxForScale: number): number {
    const ratio = Math.max(value, 0) / maxForScale;
    return Number(
      (CHART_BASELINE_Y - ratio * (CHART_BASELINE_Y - CHART_TOP_Y)).toFixed(2)
    );
  }

  protected metricValue(point: TrendPointVm, metric: TrendMetric): number {
    return metric === 'bookings' ? point.bookings : point.revenue;
  }

  protected formatTrendLabel(
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

  protected startOfWeek(date: Date, weekStartsOnSunday: boolean): Date {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);

    const day = start.getDay();
    const offset = weekStartsOnSunday ? day : day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - offset);
    return start;
  }

  protected startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
  }

  protected toDateKey(value: Date | string): string {
    const date = value instanceof Date ? new Date(value) : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  protected toInputDate(isoDate: string): string {
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
      return isoDate;
    }

    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  protected parseInputDate(value: string): Date | null {
    const [yearRaw, monthRaw, dayRaw] = value
      .split('-')
      .map((part) => Number(part));
    if (!yearRaw || !monthRaw || !dayRaw) {
      return null;
    }

    const date = new Date(yearRaw, monthRaw - 1, dayRaw, 0, 0, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  protected normalizeInputDate(value: string): string | null {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return null;
    }

    const [yearRaw, monthRaw, dayRaw] = value
      .split('-')
      .map((part) => Number(part));
    if (!yearRaw || !monthRaw || !dayRaw) {
      return null;
    }

    const date = new Date(Date.UTC(yearRaw, monthRaw - 1, dayRaw, 0, 0, 0, 0));
    if (
      Number.isNaN(date.getTime()) ||
      date.getUTCFullYear() !== yearRaw ||
      date.getUTCMonth() + 1 !== monthRaw ||
      date.getUTCDate() !== dayRaw
    ) {
      return null;
    }

    return `${yearRaw.toString().padStart(4, '0')}-${monthRaw
      .toString()
      .padStart(2, '0')}-${dayRaw.toString().padStart(2, '0')}`;
  }

  protected weekStartsOnSunday(): boolean {
    return this.localeFormat.getCurrentLocale().toLowerCase().startsWith('ar');
  }
}
