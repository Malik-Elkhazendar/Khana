import {
  TrendChartState,
  TrendMetric,
  TrendSeriesVm,
  TrendTickVm,
} from './analytics.route.models';
import { AnalyticsRouteStateBase } from './analytics.route-state';

export abstract class AnalyticsRouteFormattingBase extends AnalyticsRouteStateBase {
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
    if (vm.deltaPct > 0.5) {
      return 'trend-chart__delta--up';
    }
    if (vm.deltaPct < -0.5) {
      return 'trend-chart__delta--down';
    }
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

  protected metricTitleKey(metric: TrendMetric): string {
    return metric === 'bookings'
      ? 'DASHBOARD.PAGES.ANALYTICS.CHARTS.BOOKINGS_TREND'
      : 'DASHBOARD.PAGES.ANALYTICS.CHARTS.REVENUE_TREND';
  }
}
