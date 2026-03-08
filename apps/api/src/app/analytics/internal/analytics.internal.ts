import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Tenant } from '@khana/data-access';
import {
  AnalyticsOccupancyFacilityDto,
  BookingStatus,
  DEFAULT_TENANT_TIMEZONE,
  FacilityPerformanceRowDto,
  isValidIanaTimeZone,
  RevenueTrendPointDto,
} from '@khana/shared-dtos';
import { DataSource, Repository } from 'typeorm';
import { AppLoggerService, LOG_EVENTS } from '../../logging';
import { GoalsService } from '../../goals/goals.service';

export const ACCESS_DENIED_MESSAGE =
  'Access denied: You do not have permission to access this resource.';
export const RESOURCE_NOT_FOUND_MESSAGE = 'Resource not found';
export const INVALID_RANGE_MESSAGE =
  'Invalid date range. Ensure from <= to and range is at most 366 days.';
export const MAX_RANGE_DAYS = 366;
export const MINUTES_PER_DAY = 24 * 60;

export const REVENUE_STATUSES: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
  BookingStatus.NO_SHOW,
];
export const OCCUPIED_STATUSES: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
  BookingStatus.NO_SHOW,
];

export type DateRange = {
  from: Date;
  to: Date;
  durationMs: number;
};

export type SummaryAggregateRow = {
  totalBookings: number | string | null;
  totalCancellations: number | string | null;
  totalRevenue: number | string | null;
};

export type OccupancyRow = {
  facilityId: string;
  facilityName: string;
  date: string;
  availableMinutes: number | string;
  occupiedMinutes: number | string;
  bookingCount: number | string;
};

export type RevenueTrendRow = {
  periodStart: string;
  periodLabel: string;
  bookings: number | string;
  revenue: number | string;
};

export type FacilityPerformanceRawRow = {
  facilityId: string;
  facilityName: string;
  totalBookings: number | string;
  totalCancellations: number | string;
  revenue: number | string;
  occupancyRate: number | string;
};

export type HourlyRow = {
  hourOfDay: number | string;
  bookingCount: number | string;
};

export type MostBookedFacilityRow = {
  facilityName: string;
  bookingCount: number | string;
};

export type AnalyticsDependencies = {
  tenantRepository: Repository<Tenant>;
  dataSource: DataSource;
  appLogger: AppLoggerService;
  goalsService: GoalsService;
};

export const requireTenantId = (tenantId?: string): string => {
  const normalized = tenantId?.trim();
  if (!normalized) {
    throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
  }
  return normalized;
};

export const getTenantTimeZone = async (
  deps: AnalyticsDependencies,
  tenantId: string
): Promise<string> => {
  const tenant = await deps.tenantRepository.findOne({
    where: { id: tenantId },
    select: ['id', 'timezone'],
  });

  if (!tenant) {
    throw new NotFoundException(RESOURCE_NOT_FOUND_MESSAGE);
  }

  const normalized = tenant.timezone?.trim();
  return isValidIanaTimeZone(normalized) ? normalized : DEFAULT_TENANT_TIMEZONE;
};

export const resolveLocalDate = (
  value: string | undefined,
  timeZone: string
): string | null => {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(parsed);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    return null;
  }

  return `${year}-${month}-${day}`;
};

export const computeDurationFromDateStrings = (
  fromDate: string,
  toDate: string
): number => {
  const start = new Date(`${fromDate}T00:00:00.000Z`);
  const end = new Date(`${toDate}T23:59:59.999Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw new BadRequestException(INVALID_RANGE_MESSAGE);
  }

  return end.getTime() - start.getTime() + 1;
};

export const parseRange = async (
  deps: AnalyticsDependencies,
  fromRaw: string | undefined,
  toRaw: string | undefined,
  timeZone: string
): Promise<DateRange> => {
  const fromDate = resolveLocalDate(fromRaw, timeZone);
  const toDate = resolveLocalDate(toRaw, timeZone);

  if (!fromDate || !toDate || fromDate > toDate) {
    throw new BadRequestException(INVALID_RANGE_MESSAGE);
  }

  const durationMs = computeDurationFromDateStrings(fromDate, toDate);
  const maxRangeMs = MAX_RANGE_DAYS * MINUTES_PER_DAY * 60 * 1000;
  if (durationMs > maxRangeMs) {
    throw new BadRequestException(INVALID_RANGE_MESSAGE);
  }

  const [boundaries] = (await deps.dataSource.query(
    `
      SELECT
        ($2::date::timestamp AT TIME ZONE $1) AS "fromUtc",
        (($3::date + interval '1 day')::timestamp AT TIME ZONE $1 - interval '1 millisecond') AS "toUtc"
    `,
    [timeZone, fromDate, toDate]
  )) as Array<{ fromUtc: string; toUtc: string }>;

  const from = new Date(boundaries?.fromUtc ?? '');
  const to = new Date(boundaries?.toUtc ?? '');

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new BadRequestException(INVALID_RANGE_MESSAGE);
  }

  return { from, to, durationMs };
};

export const fetchSummaryAggregate = async (
  deps: AnalyticsDependencies,
  tenantId: string,
  range: DateRange,
  facilityId?: string
): Promise<SummaryAggregateRow> => {
  const rows = await deps.dataSource.query(
    `
      SELECT
        COUNT(*)::int AS "totalBookings",
        COUNT(*) FILTER (WHERE b.status = 'CANCELLED')::int AS "totalCancellations",
        COALESCE(
          SUM(
            CASE
              WHEN b.status::text = ANY($5::text[]) THEN b."totalAmount"::numeric
              ELSE 0
            END
          ),
          0
        )::numeric AS "totalRevenue"
      FROM bookings b
      INNER JOIN facilities f ON f.id = b."facilityId"
      WHERE f."tenantId" = $1
        AND b."startTime" <= $3::timestamptz
        AND b."endTime" >= $2::timestamptz
        AND ($4::uuid IS NULL OR f.id = $4::uuid)
    `,
    [
      tenantId,
      range.from.toISOString(),
      range.to.toISOString(),
      facilityId ?? null,
      REVENUE_STATUSES,
    ]
  );

  return (
    (rows as SummaryAggregateRow[])[0] ?? {
      totalBookings: 0,
      totalCancellations: 0,
      totalRevenue: 0,
    }
  );
};

export const getPreviousRange = (range: DateRange): DateRange => {
  const previousTo = new Date(range.from.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - range.durationMs + 1);
  return {
    from: previousFrom,
    to: previousTo,
    durationMs: range.durationMs,
  };
};

export const ensureFacilityInTenant = async (
  deps: AnalyticsDependencies,
  facilityId: string,
  tenantId: string
): Promise<void> => {
  const rows = await deps.dataSource.query(
    `
      SELECT f.id
      FROM facilities f
      WHERE f.id = $1::uuid
        AND f."tenantId" = $2
      LIMIT 1
    `,
    [facilityId, tenantId]
  );

  if ((rows as Array<{ id: string }>).length === 0) {
    throw new NotFoundException(RESOURCE_NOT_FOUND_MESSAGE);
  }
};

export const calculatePercentageChange = (
  current: number,
  previous: number
): number => {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }
  return ((current - previous) / Math.abs(previous)) * 100;
};

export const round = (value: number): number => Number(value.toFixed(2));

export const toNumber = (value: string | number | null | undefined): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export const padHour = (hour: number): string => String(hour).padStart(2, '0');

export const logAnalyticsSuccess = (
  deps: AnalyticsDependencies,
  message: string,
  payload: Record<string, unknown>
): void => {
  deps.appLogger.info(LOG_EVENTS.ANALYTICS_QUERY_SUCCESS, message, payload);
};

export const logAnalyticsIntegrityWarning = (
  deps: AnalyticsDependencies,
  payload: Record<string, unknown>
): void => {
  deps.appLogger.warn(
    LOG_EVENTS.ANALYTICS_DATA_INTEGRITY_WARNING,
    'Analytics occupancy invariant violation detected',
    payload
  );
};

export type AnalyticsOccupancyFacilityState = {
  facilityMap: Map<string, AnalyticsOccupancyFacilityDto>;
  totalOccupied: number;
  totalAvailable: number;
};

export const toTrendPoint = (row: RevenueTrendRow): RevenueTrendPointDto => ({
  periodStart: new Date(row.periodStart).toISOString(),
  periodLabel: row.periodLabel,
  bookings: toNumber(row.bookings),
  revenue: round(toNumber(row.revenue)),
});

export const toFacilityPerformanceRow = (
  row: FacilityPerformanceRawRow
): FacilityPerformanceRowDto => {
  const totalBookings = toNumber(row.totalBookings);
  const totalCancellations = toNumber(row.totalCancellations);
  return {
    facilityId: row.facilityId,
    facilityName: row.facilityName,
    totalBookings,
    revenue: round(toNumber(row.revenue)),
    occupancyRate: round(toNumber(row.occupancyRate)),
    cancellationRate:
      totalBookings === 0
        ? 0
        : round((totalCancellations / totalBookings) * 100),
  };
};
