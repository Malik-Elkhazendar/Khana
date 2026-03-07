import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { AnalyticsStore } from './analytics.store';
import { ApiService } from '../../shared/services/api.service';
import { LoggerService } from '../../shared/services/logger.service';
import { createApiMock, ApiServiceMock } from '../../testing/api-mocks';

describe('AnalyticsStore', () => {
  let store: InstanceType<typeof AnalyticsStore>;
  let apiMock: ApiServiceMock;
  let logger: jest.Mocked<LoggerService>;

  beforeEach(() => {
    apiMock = createApiMock();
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;

    TestBed.configureTestingModule({
      providers: [
        { provide: ApiService, useValue: apiMock },
        { provide: LoggerService, useValue: logger },
      ],
    });

    store = TestBed.inject(AnalyticsStore);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('initializes with today range and day grouping', () => {
    const filters = store.filters();
    expect(filters.groupBy).toBe('day');
    expect(filters.from).toBeTruthy();
    expect(filters.to).toBeTruthy();
    expect(filters.timeZone).toBe('Asia/Riyadh');
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('loads summary/occupancy/revenue/peak-hours together', async () => {
    await store.loadAnalytics();

    expect(apiMock.getAnalyticsSummary).toHaveBeenCalledTimes(1);
    expect(apiMock.getAnalyticsOccupancy).toHaveBeenCalledTimes(1);
    expect(apiMock.getAnalyticsRevenue).toHaveBeenCalledTimes(1);
    expect(apiMock.getAnalyticsPeakHours).toHaveBeenCalledTimes(1);

    const summaryQuery = apiMock.getAnalyticsSummary.mock.calls[0]?.[0];
    expect(summaryQuery.from).toBe(store.filters().from);
    expect(summaryQuery.to).toBe(store.filters().to);

    const revenueQuery = apiMock.getAnalyticsRevenue.mock.calls[0]?.[0];
    expect(revenueQuery.groupBy).toBe('day');
    expect(store.summary()).not.toBeNull();
    expect(store.occupancy()).not.toBeNull();
    expect(store.revenue()).not.toBeNull();
    expect(store.peakHours()).not.toBeNull();
    expect(store.error()).toBeNull();
  });

  it('syncs tenant timezone from caller-provided value', () => {
    store.syncTenantTimeZone('Europe/Istanbul');

    expect(store.filters().timeZone).toBe('Europe/Istanbul');
  });

  it('applies filters and sends them to API calls', async () => {
    store.setDateRange('2026-03-01T00:00:00.000Z', '2026-03-07T23:59:59.999Z');
    store.setGroupBy('week');
    store.setFacilityFilter('facility-2');

    await store.loadAnalytics();

    expect(apiMock.getAnalyticsSummary).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '2026-03-01T00:00:00.000Z',
        to: '2026-03-07T23:59:59.999Z',
        facilityId: 'facility-2',
      })
    );
    expect(apiMock.getAnalyticsRevenue).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '2026-03-01T00:00:00.000Z',
        to: '2026-03-07T23:59:59.999Z',
        facilityId: 'facility-2',
        groupBy: 'week',
      })
    );
  });

  it('sets validation error code when API returns 400', async () => {
    apiMock.getAnalyticsSummary.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 400 }))
    );
    apiMock.getAnalyticsOccupancy.mockReturnValueOnce(
      of({ facilities: [], overallOccupancyRate: 0 })
    );
    apiMock.getAnalyticsRevenue.mockReturnValueOnce(
      of({ groupBy: 'day', trend: [], facilityPerformance: [] })
    );
    apiMock.getAnalyticsPeakHours.mockReturnValueOnce(
      of({
        peakTimeRange: null,
        mostBookedFacility: null,
        mostBookedCourt: null,
      })
    );

    await store.loadAnalytics();

    expect(store.errorCode()).toBe('VALIDATION');
    expect(store.error()?.message).toBe('CLIENT_ERRORS.ANALYTICS.VALIDATION');
    expect(logger.error).toHaveBeenCalled();
  });

  it('clears analytics datasets on auth-sensitive failures', async () => {
    store.syncTenantTimeZone('Europe/Istanbul');
    await store.loadAnalytics();

    apiMock.getAnalyticsSummary.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 401 }))
    );
    apiMock.getAnalyticsOccupancy.mockReturnValueOnce(
      of({ facilities: [], overallOccupancyRate: 0 })
    );
    apiMock.getAnalyticsRevenue.mockReturnValueOnce(
      of({ groupBy: 'day', trend: [], facilityPerformance: [] })
    );
    apiMock.getAnalyticsPeakHours.mockReturnValueOnce(
      of({
        peakTimeRange: null,
        mostBookedFacility: null,
        mostBookedCourt: null,
      })
    );

    await store.loadAnalytics();

    expect(store.summary()).toBeNull();
    expect(store.occupancy()).toBeNull();
    expect(store.revenue()).toBeNull();
    expect(store.peakHours()).toBeNull();
    expect(store.errorCode()).toBe('UNAUTHORIZED');
    expect(store.filters().timeZone).toBe('Europe/Istanbul');
  });

  it('resets analytics state while preserving the active tenant timezone', async () => {
    await store.loadAnalytics();
    store.syncTenantTimeZone('Europe/Istanbul');
    store.setFacilityFilter('facility-2');
    store.setGroupBy('week');

    store.reset();

    expect(store.summary()).toBeNull();
    expect(store.occupancy()).toBeNull();
    expect(store.revenue()).toBeNull();
    expect(store.peakHours()).toBeNull();
    expect(store.error()).toBeNull();
    expect(store.errorCode()).toBeNull();
    expect(store.loading()).toBe(false);
    expect(store.filters().facilityId).toBeNull();
    expect(store.filters().groupBy).toBe('day');
    expect(store.filters().timeZone).toBe('Europe/Istanbul');
  });
});
