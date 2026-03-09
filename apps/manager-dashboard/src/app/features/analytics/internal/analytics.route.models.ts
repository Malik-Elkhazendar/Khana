import { AnalyticsGroupBy } from '@khana/shared-dtos';

export type TrendMetric = 'bookings' | 'revenue';
export type TrendChartState = 'empty' | 'single_point' | 'sparse' | 'ready';
export type TrendDensity = 'low' | 'medium' | 'high';

export type TrendPointVm = {
  periodStart: string;
  dateKey: string;
  label: string;
  bookings: number;
  revenue: number;
  isObserved: boolean;
};

export type TrendMarkerVm = {
  kind: 'first' | 'last';
  x: number;
  y: number;
  isObserved: boolean;
};

export type TrendSegmentVm = {
  path: string;
  synthetic: boolean;
};

export type TrendTickVm = {
  index: number;
  label: string;
};

export type TrendSeriesVm = {
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

export type TrendBaseVm = {
  points: TrendPointVm[];
  observedCount: number;
  syntheticCount: number;
  density: TrendDensity;
  effectiveGroupBy: AnalyticsGroupBy;
};

export const CHART_WIDTH = 100;
export const CHART_BASELINE_Y = 40;
export const CHART_TOP_Y = 4;
export const CHART_GRID_LINES: ReadonlyArray<number> = [4, 16, 28, 40];
export const CHART_MAX_RENDER_POINTS = 60;
export const CHART_HEADROOM_RATIO = 1.12;
export const DAY_IN_MS = 86_400_000;
export const GROUP_RANK: Record<AnalyticsGroupBy, number> = {
  day: 1,
  week: 2,
  month: 3,
};
