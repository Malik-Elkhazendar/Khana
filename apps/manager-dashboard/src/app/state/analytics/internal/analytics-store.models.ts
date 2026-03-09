import { HttpErrorResponse } from '@angular/common/http';
import { WritableStateSource } from '@ngrx/signals';
import {
  AnalyticsGroupBy,
  AnalyticsOccupancyResponseDto,
  AnalyticsPeakHoursResponseDto,
  AnalyticsRevenueResponseDto,
  AnalyticsSummaryResponseDto,
} from '@khana/shared-dtos';

export type AnalyticsFilters = {
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

export type AnalyticsErrorCode =
  | 'NETWORK'
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'SERVER_ERROR'
  | 'UNKNOWN';

export type AnalyticsState = {
  filters: AnalyticsFilters;
  summary: AnalyticsSummaryResponseDto | null;
  occupancy: AnalyticsOccupancyResponseDto | null;
  revenue: AnalyticsRevenueResponseDto | null;
  peakHours: AnalyticsPeakHoursResponseDto | null;
  loading: boolean;
  error: Error | null;
  errorCode: AnalyticsErrorCode | null;
};

export const ANALYTICS_ERROR_MESSAGES: Record<AnalyticsErrorCode, string> = {
  NETWORK: 'CLIENT_ERRORS.ANALYTICS.NETWORK',
  VALIDATION: 'CLIENT_ERRORS.ANALYTICS.VALIDATION',
  UNAUTHORIZED: 'API_ERRORS.UNAUTHORIZED',
  FORBIDDEN: 'CLIENT_ERRORS.ANALYTICS.FORBIDDEN',
  NOT_FOUND: 'API_ERRORS.NOT_FOUND',
  SERVER_ERROR: 'API_ERRORS.SERVER_ERROR',
  UNKNOWN: 'CLIENT_ERRORS.ANALYTICS.UNKNOWN',
};

export type AnalyticsStoreSlice = {
  filters(): AnalyticsFilters;
  summary(): AnalyticsSummaryResponseDto | null;
  occupancy(): AnalyticsOccupancyResponseDto | null;
  revenue(): AnalyticsRevenueResponseDto | null;
  peakHours(): AnalyticsPeakHoursResponseDto | null;
  loading(): boolean;
  error(): Error | null;
  errorCode(): AnalyticsErrorCode | null;
};

export type AnalyticsStoreStateSource = WritableStateSource<AnalyticsState> &
  AnalyticsStoreSlice;

export const toAnalyticsError = (message: string): Error => new Error(message);

export const resolveAnalyticsError = (
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

export const resolveRequestId = (err: unknown): string | undefined => {
  if (!(err instanceof HttpErrorResponse)) return undefined;
  return err.headers?.get('x-request-id') ?? undefined;
};

export const isAuthSensitiveAnalyticsError = (err: unknown): boolean => {
  return err instanceof HttpErrorResponse && [401, 403].includes(err.status);
};
