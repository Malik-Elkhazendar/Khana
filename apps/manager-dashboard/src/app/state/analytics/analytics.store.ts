import { inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  AnalyticsGroupBy,
  AnalyticsOccupancyResponseDto,
  AnalyticsPeakHoursResponseDto,
  AnalyticsRevenueResponseDto,
  AnalyticsSummaryResponseDto,
} from '@khana/shared-dtos';
import { ApiService } from '../../shared/services/api.service';
import { LoggerService } from '../../shared/services/logger.service';

type AnalyticsFilters = {
  from: string;
  to: string;
  groupBy: AnalyticsGroupBy;
  facilityId: string | null;
  timeZone: string;
};

type AnalyticsErrorCode =
  | 'NETWORK'
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

type AnalyticsState = {
  filters: AnalyticsFilters;
  summary: AnalyticsSummaryResponseDto | null;
  occupancy: AnalyticsOccupancyResponseDto | null;
  revenue: AnalyticsRevenueResponseDto | null;
  peakHours: AnalyticsPeakHoursResponseDto | null;
  loading: boolean;
  error: Error | null;
  errorCode: AnalyticsErrorCode | null;
};

const ANALYTICS_ERROR_MESSAGES: Record<AnalyticsErrorCode, string> = {
  NETWORK: 'CLIENT_ERRORS.ANALYTICS.NETWORK',
  VALIDATION: 'CLIENT_ERRORS.ANALYTICS.VALIDATION',
  UNAUTHORIZED: 'API_ERRORS.UNAUTHORIZED',
  FORBIDDEN: 'CLIENT_ERRORS.ANALYTICS.FORBIDDEN',
  NOT_FOUND: 'API_ERRORS.NOT_FOUND',
  SERVER_ERROR: 'API_ERRORS.SERVER_ERROR',
  UNKNOWN: 'CLIENT_ERRORS.ANALYTICS.UNKNOWN',
};

const resolveBrowserTimeZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

const getDefaultDateRange = (): Pick<AnalyticsFilters, 'from' | 'to'> => {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);
  return {
    from: start.toISOString(),
    to: end.toISOString(),
  };
};

const initialDateRange = getDefaultDateRange();

const initialState: AnalyticsState = {
  filters: {
    from: initialDateRange.from,
    to: initialDateRange.to,
    groupBy: 'day',
    facilityId: null,
    timeZone: resolveBrowserTimeZone(),
  },
  summary: null,
  occupancy: null,
  revenue: null,
  peakHours: null,
  loading: false,
  error: null,
  errorCode: null,
};

const toError = (message: string): Error => new Error(message);

const resolveAnalyticsError = (
  err: unknown
): { code: AnalyticsErrorCode; message: string } => {
  if (err instanceof HttpErrorResponse) {
    const statusMap: Record<number, AnalyticsErrorCode> = {
      0: 'NETWORK',
      400: 'VALIDATION',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      500: 'SERVER_ERROR',
    };
    const fallbackCode = statusMap[err.status] ?? 'UNKNOWN';
    const serverMessage =
      typeof err.error?.message === 'string' ? err.error.message : undefined;
    return {
      code: fallbackCode,
      message: serverMessage ?? ANALYTICS_ERROR_MESSAGES[fallbackCode],
    };
  }

  return { code: 'UNKNOWN', message: ANALYTICS_ERROR_MESSAGES.UNKNOWN };
};

const resolveRequestId = (err: unknown): string | undefined => {
  if (!(err instanceof HttpErrorResponse)) return undefined;
  return err.headers?.get('x-request-id') ?? undefined;
};

export const AnalyticsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods(
    (store, api = inject(ApiService), logger = inject(LoggerService)) => {
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
              error: toError(resolved.message),
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
        resetToToday: (): void => {
          const today = getDefaultDateRange();
          patchState(store, (state) => ({
            filters: {
              ...state.filters,
              from: today.from,
              to: today.to,
            },
          }));
        },
      };
    }
  )
);
