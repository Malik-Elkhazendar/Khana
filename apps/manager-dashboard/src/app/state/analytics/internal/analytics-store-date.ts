import { DEFAULT_TENANT_TIMEZONE } from '@khana/shared-dtos';
import {
  AnalyticsFilters,
  AnalyticsState,
  RangePreset,
} from './analytics-store.models';

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

export const getDefaultDateRange = (
  timeZone: string
): Pick<AnalyticsFilters, 'from' | 'to'> => {
  const today = resolveDateInTimeZone(new Date(), timeZone);
  return {
    from: today,
    to: today,
  };
};

export const getQuickRange = (
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

export const createInitialAnalyticsState = (
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
