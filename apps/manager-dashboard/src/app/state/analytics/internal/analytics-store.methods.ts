import { patchState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { AnalyticsGroupBy } from '@khana/shared-dtos';
import { ApiService } from '../../../shared/services/api.service';
import { LoggerService } from '../../../shared/services/logger.service';
import {
  createInitialAnalyticsState,
  getDefaultDateRange,
  getQuickRange,
} from './analytics-store-date';
import {
  AnalyticsStoreStateSource,
  isAuthSensitiveAnalyticsError,
  RangePreset,
  resolveAnalyticsError,
  resolveRequestId,
  toAnalyticsError,
} from './analytics-store.models';

export const createAnalyticsStoreMethods = (
  store: AnalyticsStoreStateSource,
  api: ApiService,
  logger: LoggerService
) => {
  let inFlightLoad: Promise<void> | null = null;

  const runLoad = async (): Promise<void> => {
    if (inFlightLoad) {
      return inFlightLoad;
    }

    const promise = (async () => {
      patchState(store, { loading: true, error: null, errorCode: null });

      const filters = store.filters();
      const baseQuery = {
        from: filters.from,
        to: filters.to,
        facilityId: filters.facilityId ?? undefined,
        timeZone: filters.timeZone,
      };

      try {
        // Fetch all dashboard panels against the same filter snapshot so
        // cards and charts cannot render mixed time ranges.
        const [summary, occupancy, revenue, peakHours] = await Promise.all([
          firstValueFrom(api.getAnalyticsSummary(baseQuery)),
          firstValueFrom(api.getAnalyticsOccupancy(baseQuery)),
          firstValueFrom(
            api.getAnalyticsRevenue({
              ...baseQuery,
              groupBy: filters.groupBy,
            })
          ),
          firstValueFrom(api.getAnalyticsPeakHours(baseQuery)),
        ]);

        patchState(store, {
          summary,
          occupancy,
          revenue,
          peakHours,
          loading: false,
        });
      } catch (err) {
        const resolved = resolveAnalyticsError(err);
        const requestId = resolveRequestId(err);
        const context: Record<string, unknown> = {
          from: filters.from,
          to: filters.to,
          groupBy: filters.groupBy,
          facilityId: filters.facilityId,
        };
        if (requestId) {
          context['requestId'] = requestId;
        }

        logger.error(
          'client.analytics.load.failed',
          'Failed to load analytics dashboard data',
          context,
          err
        );

        patchState(store, {
          loading: false,
          // Keep the last successful snapshot for recoverable failures, but
          // clear auth-sensitive data when the session is no longer valid.
          summary: isAuthSensitiveAnalyticsError(err) ? null : store.summary(),
          occupancy: isAuthSensitiveAnalyticsError(err)
            ? null
            : store.occupancy(),
          revenue: isAuthSensitiveAnalyticsError(err) ? null : store.revenue(),
          peakHours: isAuthSensitiveAnalyticsError(err)
            ? null
            : store.peakHours(),
          error: toAnalyticsError(resolved.message),
          errorCode: resolved.code,
        });
      }
    })();

    inFlightLoad = promise;
    promise.finally(() => {
      inFlightLoad = null;
    });
    return promise;
  };

  return {
    syncTenantTimeZone: (tenantTimeZone: string): void => {
      patchState(store, (state) => ({
        filters: {
          ...state.filters,
          timeZone: tenantTimeZone,
        },
      }));
    },
    setTimeZone: (timeZone: string): void => {
      patchState(store, (state) => ({
        filters: {
          ...state.filters,
          timeZone,
        },
      }));
    },
    loadAnalytics: async (): Promise<void> => {
      await runLoad();
    },
    setDateRange: (from: string, to: string): void => {
      patchState(store, (state) => ({
        filters: {
          ...state.filters,
          from,
          to,
        },
      }));
    },
    setGroupBy: (groupBy: AnalyticsGroupBy): void => {
      patchState(store, (state) => ({
        filters: {
          ...state.filters,
          groupBy,
        },
      }));
    },
    setFacilityFilter: (facilityId: string | null): void => {
      patchState(store, (state) => ({
        filters: {
          ...state.filters,
          facilityId,
        },
      }));
    },
    clearError: (): void => {
      patchState(store, { error: null, errorCode: null });
    },
    reset: (): void => {
      patchState(store, createInitialAnalyticsState(store.filters().timeZone));
    },
    setQuickRange: (preset: RangePreset, weekStartsOnSunday = false): void => {
      // Quick ranges resolve in the tenant timezone so "today" and "this
      // month" stay aligned with the backend analytics window.
      const range = getQuickRange(
        preset,
        weekStartsOnSunday,
        store.filters().timeZone
      );
      patchState(store, (state) => ({
        filters: {
          ...state.filters,
          from: range.from,
          to: range.to,
        },
      }));
    },
    resetToToday: (): void => {
      const today = getDefaultDateRange(store.filters().timeZone);
      patchState(store, (state) => ({
        filters: {
          ...state.filters,
          from: today.from,
          to: today.to,
        },
      }));
    },
  };
};
