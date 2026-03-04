import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AnalyticsGroupBy } from '@khana/shared-dtos';
import { LocaleFormatService } from '../../shared/services/locale-format.service';
import { FacilityContextStore } from '../../shared/state';
import { AnalyticsStore } from '../../state/analytics/analytics.store';

type TrendViewPoint = {
  label: string;
  bookings: number;
  revenue: number;
};

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule],
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
  readonly store = inject(AnalyticsStore);

  readonly loading = this.store.loading;
  readonly error = this.store.error;
  readonly summary = this.store.summary;
  readonly occupancy = this.store.occupancy;
  readonly revenue = this.store.revenue;
  readonly peakHours = this.store.peakHours;
  readonly facilities = this.facilityContext.facilities;

  readonly fromDate = signal(this.toInputDate(this.store.filters().from));
  readonly toDate = signal(this.toInputDate(this.store.filters().to));
  readonly groupBy = signal<AnalyticsGroupBy>(this.store.filters().groupBy);
  readonly facilityId = signal(this.store.filters().facilityId ?? '');
  readonly filterError = signal<string | null>(null);

  readonly trendPoints = computed<TrendViewPoint[]>(() => {
    return (this.revenue()?.trend ?? []).map((point) => ({
      label: this.formatTrendLabel(point.periodStart, point.periodLabel),
      bookings: point.bookings,
      revenue: point.revenue,
    }));
  });

  readonly bookingsPolyline = computed(() =>
    this.buildPolyline(this.trendPoints().map((point) => point.bookings))
  );
  readonly revenuePolyline = computed(() =>
    this.buildPolyline(this.trendPoints().map((point) => point.revenue))
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
    void this.store.loadAnalytics();
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
    await this.store.loadAnalytics();
  }

  async setToday(): Promise<void> {
    this.store.resetToToday();
    const filters = this.store.filters();
    this.fromDate.set(this.toInputDate(filters.from));
    this.toDate.set(this.toInputDate(filters.to));
    await this.store.loadAnalytics();
  }

  async retryLoad(): Promise<void> {
    this.store.clearError();
    await this.store.loadAnalytics();
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

  private formatTrendLabel(periodStart: string, periodLabel: string): string {
    if (this.groupBy() === 'week') {
      return periodLabel;
    }
    if (this.groupBy() === 'month') {
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

  private buildPolyline(values: number[]): string {
    if (values.length === 0) return '';

    const chartWidth = 100;
    const chartHeight = 36;
    const maxValue = Math.max(...values, 1);

    if (values.length === 1) {
      const y = this.toChartY(values[0], maxValue, chartHeight);
      return `0,${y} ${chartWidth},${y}`;
    }

    const stepX = chartWidth / (values.length - 1);
    return values
      .map((value, index) => {
        const x = Number((index * stepX).toFixed(2));
        const y = this.toChartY(value, maxValue, chartHeight);
        return `${x},${y}`;
      })
      .join(' ');
  }

  private toChartY(
    value: number,
    maxValue: number,
    chartHeight: number
  ): number {
    return Number(
      (chartHeight - (Math.max(value, 0) / maxValue) * chartHeight).toFixed(2)
    );
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
}
