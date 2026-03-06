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
  DEFAULT_TENANT_TIMEZONE,
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

export type RangePreset =
  | 'today'
  | 'this_week'
  | 'this_month'
  | 'last_30_days'
  | 'last_90_days';

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

const padDatePart = (value: number): string =>
  value.toString().padStart(2, '0');

const formatUtcDate = (date: Date): string => {
  return `${date.getUTCFullYear()}-${padDatePart(
    date.getUTCMonth() + 1
  )}-${padDatePart(date.getUTCDate())}`;
};

const toUtcDate = (date: string): Date | null => {
  const [yearRaw, monthRaw, dayRaw] = date
    .split('-')
    .map((part) => Number(part));
  if (!yearRaw || !monthRaw || !dayRaw) {
    return null;
  }

  const parsed = new Date(Date.UTC(yearRaw, monthRaw - 1, dayRaw, 0, 0, 0, 0));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const addDaysToDate = (date: string, days: number): string => {
  const base = toUtcDate(date);
  if (!base) {
    return date;
  }

  base.setUTCDate(base.getUTCDate() + days);
  return formatUtcDate(base);
};

const resolveDateInTimeZone = (source: Date, timeZone: string): string => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = formatter.formatToParts(source);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  if (!year || !month || !day) {
    return formatUtcDate(source);
  }

  return `${year}-${month}-${day}`;
};

const getWeekStart = (
  sourceDate: string,
  weekStartsOnSunday: boolean
): string => {
  const date = toUtcDate(sourceDate);
  if (!date) {
    return sourceDate;
  }

  const day = date.getUTCDay();
  const offset = weekStartsOnSunday ? day : day === 0 ? 6 : day - 1;
  return addDaysToDate(sourceDate, -offset);
};

const getMonthStart = (sourceDate: string): string => {
  const date = toUtcDate(sourceDate);
  if (!date) {
    return sourceDate;
  }
  return `${date.getUTCFullYear()}-${padDatePart(date.getUTCMonth() + 1)}-01`;
};

const getDefaultDateRange = (
  timeZone: string
): Pick<AnalyticsFilters, 'from' | 'to'> => {
  const today = resolveDateInTimeZone(new Date(), timeZone);
  return {
    from: today,
    to: today,
  };
};

const getQuickRange = (
  preset: RangePreset,
  weekStartsOnSunday: boolean,
  timeZone: string
): Pick<AnalyticsFilters, 'from' | 'to'> => {
  const today = resolveDateInTimeZone(new Date(), timeZone);

  switch (preset) {
    case 'today':
      return {
        from: today,
        to: today,
      };
    case 'this_week': {
      const weekStart = getWeekStart(today, weekStartsOnSunday);
      return {
        from: weekStart,
        to: today,
      };
    }
    case 'this_month': {
      const monthStart = getMonthStart(today);
      return {
        from: monthStart,
        to: today,
      };
    }
    case 'last_30_days': {
      const from = addDaysToDate(today, -29);
      return {
        from,
        to: today,
      };
    }
    case 'last_90_days': {
      const from = addDaysToDate(today, -89);
      return {
        from,
        to: today,
      };
    }
  }

  return {
    from: today,
    to: today,
  };
};

const createInitialState = (
  timeZone = DEFAULT_TENANT_TIMEZONE
): AnalyticsState => {
  const initialDateRange = getDefaultDateRange(timeZone);

  return {
    filters: {
      from: initialDateRange.from,
      to: initialDateRange.to,
      groupBy: 'day',
      facilityId: null,
      timeZone,
    },
    summary: null,
    occupancy: null,
    revenue: null,
    peakHours: null,
    loading: false,
    error: null,
    errorCode: null,
  };
};

const initialState: AnalyticsState = createInitialState();

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

const isAuthSensitiveError = (err: unknown): boolean => {
  return err instanceof HttpErrorResponse && [401, 403].includes(err.status);
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
              summary: isAuthSensitiveError(err) ? null : store.summary(),
              occupancy: isAuthSensitiveError(err) ? null : store.occupancy(),
              revenue: isAuthSensitiveError(err) ? null : store.revenue(),
              peakHours: isAuthSensitiveError(err) ? null : store.peakHours(),
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
          patchState(store, createInitialState());
        },
        setQuickRange: (
          preset: RangePreset,
          weekStartsOnSunday = false
        ): void => {
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
    }
  )
);
