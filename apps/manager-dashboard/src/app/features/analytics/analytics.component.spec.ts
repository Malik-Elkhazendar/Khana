import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { UserRole } from '@khana/shared-dtos';
import { of } from 'rxjs';
import { AnalyticsComponent } from './analytics.component';
import { ApiService } from '../../shared/services/api.service';
import { LoggerService } from '../../shared/services/logger.service';
import { FacilityContextStore } from '../../shared/state';
import { AuthStore } from '../../shared/state/auth.store';
import { createApiMock, ApiServiceMock } from '../../testing/api-mocks';

const EN_TRANSLATIONS = {
  DASHBOARD: {
    PAGES: {
      ANALYTICS: {
        TITLE: 'Analytics',
        SUBTITLE: 'KPI and trends',
      },
    },
  },
};

const buildMonthlyTrend = (
  count: number,
  startIso = '2016-01-01T00:00:00.000Z'
) => {
  const start = new Date(startIso);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setMonth(start.getMonth() + index);
    return {
      periodStart: date.toISOString(),
      periodLabel: date.toISOString().slice(0, 7),
      bookings: (index % 12) + 1,
      revenue: ((index % 12) + 1) * 120,
    };
  });
};

describe('AnalyticsComponent', () => {
  let fixture: ComponentFixture<AnalyticsComponent>;
  let component: AnalyticsComponent;
  let apiMock: ApiServiceMock;
  let translateService: TranslateService;
  let authStore: InstanceType<typeof AuthStore>;

  const createUser = (role: UserRole) => ({
    id: `${role.toLowerCase()}-1`,
    tenantId: 'tenant-1',
    email: `${role.toLowerCase()}@khana.dev`,
    name: 'Khana User',
    role,
    isActive: true,
    onboardingCompleted: true,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  });

  const facilityContextMock = {
    facilities: signal([
      {
        id: 'facility-1',
        name: 'Court A',
        type: 'PADEL_COURT' as const,
        basePrice: 180,
        openTime: '08:00',
        closeTime: '23:00',
      },
    ]),
    selectedFacilityId: signal<string | null>(null),
    loading: signal(false),
    error: signal<Error | null>(null),
    initialized: signal(true),
    initialize: jest.fn(),
    refreshFacilities: jest.fn(),
    selectFacility: jest.fn(),
    clearError: jest.fn(),
  };

  beforeEach(async () => {
    apiMock = createApiMock();
    facilityContextMock.initialize.mockReset();

    await TestBed.configureTestingModule({
      imports: [AnalyticsComponent, TranslateModule.forRoot()],
      providers: [
        { provide: ApiService, useValue: apiMock },
        {
          provide: LoggerService,
          useValue: {
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
          },
        },
        { provide: FacilityContextStore, useValue: facilityContextMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AnalyticsComponent);
    component = fixture.componentInstance;
    translateService = TestBed.inject(TranslateService);
    authStore = TestBed.inject(AuthStore);
    translateService.setTranslation('en', EN_TRANSLATIONS);
    translateService.use('en');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('creates and loads analytics on init', () => {
    expect(component).toBeTruthy();
    expect(facilityContextMock.initialize).toHaveBeenCalled();
    expect(apiMock.getAnalyticsSummary).toHaveBeenCalled();
    expect(apiMock.getAnalyticsOccupancy).toHaveBeenCalled();
    expect(apiMock.getAnalyticsRevenue).toHaveBeenCalled();
    expect(apiMock.getAnalyticsPeakHours).toHaveBeenCalled();
  });

  it('renders analytics page header', () => {
    const title = fixture.nativeElement.querySelector('h1');
    expect(title?.textContent).toContain('Analytics');
  });

  it('renders KPI period info buttons with matching tooltip bindings', () => {
    const infoButtons = fixture.nativeElement.querySelectorAll(
      '.kpi-period-info__btn'
    );
    const bookingsTip = fixture.nativeElement.querySelector(
      '#period-tip-bookings'
    );
    const revenueTip = fixture.nativeElement.querySelector(
      '#period-tip-revenue'
    );

    expect(infoButtons).toHaveLength(2);
    expect(infoButtons[0].getAttribute('aria-describedby')).toBe(
      'period-tip-bookings'
    );
    expect(infoButtons[1].getAttribute('aria-describedby')).toBe(
      'period-tip-revenue'
    );
    expect(bookingsTip?.getAttribute('role')).toBe('tooltip');
    expect(revenueTip?.getAttribute('role')).toBe('tooltip');
  });

  it('uses previous-period single-day tooltip key for one-day filters', () => {
    const from = new Date(2026, 2, 5, 0, 0, 0, 0).toISOString();
    const to = new Date(2026, 2, 5, 23, 59, 59, 999).toISOString();
    component.store.setDateRange(from, to);
    fixture.detectChanges();

    const meta = component.previousPeriodTooltipMeta();
    expect(meta.key).toBe(
      'DASHBOARD.PAGES.ANALYTICS.KPI.PERIOD_TOOLTIP_SINGLE'
    );
    expect(meta.params.count).toBeUndefined();
    expect(meta.params.from).toBeTruthy();
    expect(meta.params.to).toBeTruthy();
  });

  it('uses previous-period multi-day tooltip key with day count', () => {
    const from = new Date(2026, 2, 1, 0, 0, 0, 0).toISOString();
    const to = new Date(2026, 2, 5, 23, 59, 59, 999).toISOString();
    component.store.setDateRange(from, to);
    fixture.detectChanges();

    const meta = component.previousPeriodTooltipMeta();
    expect(meta.key).toBe('DASHBOARD.PAGES.ANALYTICS.KPI.PERIOD_TOOLTIP_MULTI');
    expect(meta.params.count).toBe(5);
    expect(meta.params.from).toBeTruthy();
    expect(meta.params.to).toBeTruthy();
  });

  it('renders trend and insights cards', () => {
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('DASHBOARD.PAGES.ANALYTICS.CHARTS.BOOKINGS_TREND');
    expect(text).toContain('DASHBOARD.PAGES.ANALYTICS.CHARTS.REVENUE_TREND');
    expect(text).toContain('DASHBOARD.PAGES.ANALYTICS.INSIGHTS.TITLE');
  });

  it('renders sparse state hint when trend has limited density', () => {
    expect(component.bookingsTrendVm().state).toBe('sparse');
    expect(component.bookingsTrendVm().syntheticCount).toBeGreaterThan(0);
    expect(
      component.bookingsTrendVm().segments.some((segment) => segment.synthetic)
    ).toBe(true);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('DASHBOARD.PAGES.ANALYTICS.CHARTS.SPARSE_DATA_HINT');
  });

  it('renders single-point hint when quick range is today', async () => {
    await component.selectQuickRange('today');
    fixture.detectChanges();

    expect(component.bookingsTrendVm().state).toBe('single_point');
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain(
      'DASHBOARD.PAGES.ANALYTICS.CHARTS.SINGLE_POINT_HINT'
    );
  });

  it('renders empty state when trend response is empty', async () => {
    apiMock.getAnalyticsRevenue.mockReturnValueOnce(
      of({
        groupBy: 'month',
        trend: [],
        facilityPerformance: [],
      })
    );
    component.groupBy.set('month');
    await component.applyFilters();
    fixture.detectChanges();

    expect(component.bookingsTrendVm().state).toBe('empty');
    expect(
      fixture.nativeElement.querySelector('.analytics-empty')
    ).toBeTruthy();
  });

  it('opens and closes trend details table', () => {
    expect(component.isTrendDetailsOpen('bookings')).toBe(false);
    component.toggleTrendDetails('bookings');
    fixture.detectChanges();
    expect(component.isTrendDetailsOpen('bookings')).toBe(true);
    expect(
      fixture.nativeElement.querySelector('.trend-data-table')
    ).toBeTruthy();
  });

  it('applies filters and reloads analytics', async () => {
    component.fromDate.set('2026-03-01');
    component.toDate.set('2026-03-05');
    component.groupBy.set('week');
    component.facilityId.set('facility-1');

    await component.applyFilters();

    expect(apiMock.getAnalyticsSummary).toHaveBeenLastCalledWith(
      expect.objectContaining({
        facilityId: 'facility-1',
      })
    );
    expect(apiMock.getAnalyticsRevenue).toHaveBeenLastCalledWith(
      expect.objectContaining({
        groupBy: 'week',
      })
    );
  });

  it('validates date range before loading filters', async () => {
    component.fromDate.set('2026-03-10');
    component.toDate.set('2026-03-01');
    const beforeCalls = apiMock.getAnalyticsSummary.mock.calls.length;

    await component.applyFilters();

    expect(component.filterError()).toBe(
      'DASHBOARD.PAGES.ANALYTICS.ERRORS.INVALID_RANGE'
    );
    expect(apiMock.getAnalyticsSummary.mock.calls.length).toBe(beforeCalls);
  });

  it('selects quick ranges and marks active preset', async () => {
    const quickRangeSpy = jest.spyOn(component.store, 'setQuickRange');
    const loadSpy = jest
      .spyOn(component.store, 'loadAnalytics')
      .mockResolvedValue();

    await component.selectQuickRange('last_30_days');

    expect(quickRangeSpy).toHaveBeenCalledWith('last_30_days', false);
    expect(loadSpy).toHaveBeenCalledTimes(1);
    expect(component.activePreset()).toBe('last_30_days');
  });

  it('clears active preset when date input changes manually', () => {
    component.activePreset.set('today');
    component.onFromDateChange('2026-03-01');

    expect(component.activePreset()).toBeNull();
  });

  it('uses sunday week start for arabic locale quick range', async () => {
    const quickRangeSpy = jest.spyOn(component.store, 'setQuickRange');
    jest.spyOn(component.store, 'loadAnalytics').mockResolvedValue();

    translateService.use('ar');
    await fixture.whenStable();

    await component.selectQuickRange('this_week');

    expect(quickRangeSpy).toHaveBeenCalledWith('this_week', true);
  });

  it('uses effective week grouping for medium-large day ranges', async () => {
    component.fromDate.set('2025-10-01');
    component.toDate.set('2025-12-20');
    component.groupBy.set('day');

    await component.applyFilters();

    expect(component.bookingsTrendVm().effectiveGroupBy).toBe('week');
  });

  it('uses effective month grouping for very large day ranges', async () => {
    component.fromDate.set('2025-01-01');
    component.toDate.set('2025-12-31');
    component.groupBy.set('day');

    await component.applyFilters();

    expect(component.bookingsTrendVm().effectiveGroupBy).toBe('month');
  });

  it('decimates render points while keeping full details points', async () => {
    apiMock.getAnalyticsRevenue.mockReturnValue(
      of({
        groupBy: 'month',
        trend: buildMonthlyTrend(120),
        facilityPerformance: [],
      })
    );

    component.fromDate.set('2016-01-01');
    component.toDate.set('2025-12-31');
    component.groupBy.set('month');

    await component.applyFilters();

    const vm = component.bookingsTrendVm();
    expect(vm.points.length).toBeGreaterThan(60);
    expect(vm.displayPoints.length).toBeLessThanOrEqual(60);
  });

  it('renders snapshot card and loads snapshot for owner role', async () => {
    authStore.setUser(createUser(UserRole.OWNER));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const snapshotCard =
      fixture.nativeElement.querySelector('app-today-snapshot');
    expect(snapshotCard).toBeTruthy();
    expect(apiMock.getTodaySnapshot).toHaveBeenCalled();
  });

  it('hides snapshot card and skips snapshot load for viewer role', async () => {
    apiMock.getTodaySnapshot.mockClear();
    authStore.setUser(createUser(UserRole.VIEWER));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const snapshotCard =
      fixture.nativeElement.querySelector('app-today-snapshot');
    expect(snapshotCard).toBeNull();
    expect(apiMock.getTodaySnapshot).not.toHaveBeenCalled();
  });
});
