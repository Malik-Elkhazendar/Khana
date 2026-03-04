import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  AnalyticsGroupBy,
  AnalyticsOccupancyFacilityDto,
  AnalyticsOccupancyResponseDto,
  AnalyticsPeakHoursResponseDto,
  AnalyticsRevenueResponseDto,
  AnalyticsSummaryResponseDto,
  BookingStatus,
  FacilityPerformanceRowDto,
  RevenueTrendPointDto,
} from '@khana/shared-dtos';
import { AppLoggerService, LOG_EVENTS } from '../logging';
import { AnalyticsQueryDto, RevenueQueryDto } from './dto';
import { GoalsService } from '../goals/goals.service';

const ACCESS_DENIED_MESSAGE =
  'Access denied: You do not have permission to access this resource.';
const RESOURCE_NOT_FOUND_MESSAGE = 'Resource not found';
const INVALID_RANGE_MESSAGE =
  'Invalid date range. Ensure from <= to and range is at most 366 days.';
const MAX_RANGE_DAYS = 366;
const MINUTES_PER_DAY = 24 * 60;

const REVENUE_STATUSES: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
  BookingStatus.NO_SHOW,
];
const OCCUPIED_STATUSES: BookingStatus[] = [
  BookingStatus.CONFIRMED,
  BookingStatus.COMPLETED,
  BookingStatus.NO_SHOW,
];

type DateRange = {
  from: Date;
  to: Date;
  durationMs: number;
};

type SummaryAggregateRow = {
  totalBookings: number | string | null;
  totalCancellations: number | string | null;
  totalRevenue: number | string | null;
};

type OccupancyRow = {
  facilityId: string;
  facilityName: string;
  date: string;
  availableMinutes: number | string;
  occupiedMinutes: number | string;
  bookingCount: number | string;
};

type RevenueTrendRow = {
  periodStart: string;
  periodLabel: string;
  bookings: number | string;
  revenue: number | string;
};

type FacilityPerformanceRawRow = {
  facilityId: string;
  facilityName: string;
  totalBookings: number | string;
  totalCancellations: number | string;
  revenue: number | string;
  occupancyRate: number | string;
};

type HourlyRow = {
  hourOfDay: number | string;
  bookingCount: number | string;
};

type MostBookedFacilityRow = {
  facilityName: string;
  bookingCount: number | string;
};

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly appLogger: AppLoggerService,
    private readonly goalsService: GoalsService
  ) {}

  async getSummary(
    query: AnalyticsQueryDto,
    tenantId: string
  ): Promise<AnalyticsSummaryResponseDto> {
    const resolvedTenantId = this.requireTenantId(tenantId);
    const timeZone = this.resolveTimeZone(query.timeZone);
    const range = this.parseRange(query.from, query.to);

    if (query.facilityId) {
      await this.ensureFacilityInTenant(query.facilityId, resolvedTenantId);
    }

    const current = await this.fetchSummaryAggregate(
      resolvedTenantId,
      range,
      query.facilityId
    );
    const previous = await this.fetchSummaryAggregate(
      resolvedTenantId,
      this.getPreviousRange(range),
      query.facilityId
    );

    const totalBookings = this.toNumber(current.totalBookings);
    const totalCancellations = this.toNumber(current.totalCancellations);
    const totalRevenue = this.toNumber(current.totalRevenue);

    const previousBookings = this.toNumber(previous.totalBookings);
    const previousRevenue = this.toNumber(previous.totalRevenue);
    const [goalProgress, goalMilestones] = await Promise.all([
      this.goalsService.getGoalProgress(resolvedTenantId, timeZone),
      this.goalsService.listMilestones(resolvedTenantId, 6),
    ]);

    const response: AnalyticsSummaryResponseDto = {
      totalBookings,
      totalRevenue: this.round(totalRevenue),
      totalCancellations,
      cancellationRate:
        totalBookings === 0
          ? 0
          : this.round((totalCancellations / totalBookings) * 100),
      avgBookingValue:
        totalBookings === 0 ? 0 : this.round(totalRevenue / totalBookings),
      revenueComparison: {
        currentPeriodValue: this.round(totalRevenue),
        previousPeriodValue: this.round(previousRevenue),
        percentageChange: this.round(
          this.calculatePercentageChange(totalRevenue, previousRevenue)
        ),
      },
      bookingsComparison: {
        currentPeriodValue: totalBookings,
        previousPeriodValue: previousBookings,
        percentageChange: this.round(
          this.calculatePercentageChange(totalBookings, previousBookings)
        ),
      },
      goalProgress,
      goalMilestones,
    };

    this.appLogger.info(
      LOG_EVENTS.ANALYTICS_QUERY_SUCCESS,
      'Analytics summary fetched',
      {
        tenantId: resolvedTenantId,
        facilityId: query.facilityId ?? null,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        timeZone,
      }
    );

    return response;
  }

  async getOccupancy(
    query: AnalyticsQueryDto,
    tenantId: string
  ): Promise<AnalyticsOccupancyResponseDto> {
    const resolvedTenantId = this.requireTenantId(tenantId);
    const timeZone = this.resolveTimeZone(query.timeZone);
    const range = this.parseRange(query.from, query.to);

    if (query.facilityId) {
      await this.ensureFacilityInTenant(query.facilityId, resolvedTenantId);
    }

    const rows = await this.dataSource.query(
      `
        WITH facilities_scope AS (
          SELECT f.id, f.name, f.config
          FROM facilities f
          WHERE f."tenantId" = $1
            AND f."isActive" = true
            AND ($5::uuid IS NULL OR f.id = $5::uuid)
        ),
        days AS (
          SELECT generate_series(
            date(timezone($2, $3::timestamptz)),
            date(timezone($2, $4::timestamptz)),
            interval '1 day'
          )::date AS local_day
        ),
        facility_days AS (
          SELECT
            fs.id AS facility_id,
            fs.name AS facility_name,
            d.local_day,
            ((split_part(fs.config->>'closeTime', ':', 1)::int * 60 + split_part(fs.config->>'closeTime', ':', 2)::int) -
             (split_part(fs.config->>'openTime', ':', 1)::int * 60 + split_part(fs.config->>'openTime', ':', 2)::int)
            )::int AS operating_minutes,
            (d.local_day::timestamp AT TIME ZONE $2) AS day_start_utc,
            ((d.local_day + interval '1 day')::timestamp AT TIME ZONE $2) AS day_end_utc
          FROM facilities_scope fs
          CROSS JOIN days d
        )
        SELECT
          fd.facility_id AS "facilityId",
          fd.facility_name AS "facilityName",
          fd.local_day::text AS "date",
          fd.operating_minutes AS "availableMinutes",
          COALESCE(
            SUM(
              GREATEST(
                EXTRACT(
                  EPOCH FROM (
                    LEAST(b."endTime", fd.day_end_utc, $4::timestamptz) -
                    GREATEST(b."startTime", fd.day_start_utc, $3::timestamptz)
                  )
                ) / 60,
                0
              )
            ),
            0
          )::numeric AS "occupiedMinutes",
          COUNT(DISTINCT b.id)::int AS "bookingCount"
        FROM facility_days fd
        LEFT JOIN bookings b
          ON b."facilityId" = fd.facility_id
         AND b.status::text = ANY($6::text[])
         AND b."startTime" < fd.day_end_utc
         AND b."endTime" > fd.day_start_utc
         AND b."startTime" < $4::timestamptz
         AND b."endTime" > $3::timestamptz
        GROUP BY fd.facility_id, fd.facility_name, fd.local_day, fd.operating_minutes
        ORDER BY fd.facility_name ASC, fd.local_day ASC
      `,
      [
        resolvedTenantId,
        timeZone,
        range.from.toISOString(),
        range.to.toISOString(),
        query.facilityId ?? null,
        OCCUPIED_STATUSES,
      ]
    );

    const facilityMap = new Map<string, AnalyticsOccupancyFacilityDto>();
    let totalOccupied = 0;
    let totalAvailable = 0;

    for (const row of rows as OccupancyRow[]) {
      const facilityId = row.facilityId;
      const availableMinutes = Math.max(this.toNumber(row.availableMinutes), 0);
      const occupiedMinutes = Math.max(this.toNumber(row.occupiedMinutes), 0);
      const bookingCount = Math.max(this.toNumber(row.bookingCount), 0);
      const dayOccupancyRate =
        availableMinutes === 0
          ? 0
          : this.round((occupiedMinutes / availableMinutes) * 100);

      const existing = facilityMap.get(facilityId);
      if (!existing) {
        facilityMap.set(facilityId, {
          facilityId,
          facilityName: row.facilityName,
          occupiedMinutes: 0,
          availableMinutes: 0,
          occupancyRate: 0,
          daily: [],
        });
      }

      const target = facilityMap.get(facilityId);
      if (!target) continue;

      target.daily.push({
        date: row.date,
        occupiedMinutes: this.round(occupiedMinutes),
        availableMinutes: this.round(availableMinutes),
        occupancyRate: dayOccupancyRate,
        bookingCount,
      });

      target.occupiedMinutes = this.round(
        target.occupiedMinutes + occupiedMinutes
      );
      target.availableMinutes = this.round(
        target.availableMinutes + availableMinutes
      );
      target.occupancyRate =
        target.availableMinutes === 0
          ? 0
          : this.round(
              (target.occupiedMinutes / target.availableMinutes) * 100
            );

      totalOccupied += occupiedMinutes;
      totalAvailable += availableMinutes;
    }

    const response: AnalyticsOccupancyResponseDto = {
      facilities: [...facilityMap.values()],
      overallOccupancyRate:
        totalAvailable === 0
          ? 0
          : this.round((totalOccupied / totalAvailable) * 100),
    };

    this.appLogger.info(
      LOG_EVENTS.ANALYTICS_QUERY_SUCCESS,
      'Analytics occupancy fetched',
      {
        tenantId: resolvedTenantId,
        facilityId: query.facilityId ?? null,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        timeZone,
      }
    );

    return response;
  }

  async getRevenue(
    query: RevenueQueryDto,
    tenantId: string
  ): Promise<AnalyticsRevenueResponseDto> {
    const resolvedTenantId = this.requireTenantId(tenantId);
    const timeZone = this.resolveTimeZone(query.timeZone);
    const range = this.parseRange(query.from, query.to);

    if (query.facilityId) {
      await this.ensureFacilityInTenant(query.facilityId, resolvedTenantId);
    }

    const trendRows = await this.dataSource.query(
      `
        SELECT
          (date_trunc($6, timezone($2, b."startTime")) AT TIME ZONE $2) AS "periodStart",
          to_char(
            date_trunc($6, timezone($2, b."startTime")),
            CASE
              WHEN $6 = 'day' THEN 'YYYY-MM-DD'
              WHEN $6 = 'week' THEN 'IYYY-"W"IW'
              ELSE 'YYYY-MM'
            END
          ) AS "periodLabel",
          COUNT(*)::int AS "bookings",
          COALESCE(
            SUM(
              CASE
                WHEN b.status::text = ANY($7::text[]) THEN b."totalAmount"::numeric
                ELSE 0
              END
            ),
            0
          )::numeric AS "revenue"
        FROM bookings b
        INNER JOIN facilities f ON f.id = b."facilityId"
        WHERE f."tenantId" = $1
          AND b."startTime" >= $3::timestamptz
          AND b."startTime" <= $4::timestamptz
          AND ($5::uuid IS NULL OR f.id = $5::uuid)
        GROUP BY 1, 2
        ORDER BY 1 ASC
      `,
      [
        resolvedTenantId,
        timeZone,
        range.from.toISOString(),
        range.to.toISOString(),
        query.facilityId ?? null,
        query.groupBy,
        REVENUE_STATUSES,
      ]
    );

    const performanceRows = await this.dataSource.query(
      `
        WITH facilities_scope AS (
          SELECT f.id, f.name, f.config
          FROM facilities f
          WHERE f."tenantId" = $1
            AND f."isActive" = true
            AND ($5::uuid IS NULL OR f.id = $5::uuid)
        )
        SELECT
          fs.id AS "facilityId",
          fs.name AS "facilityName",
          COUNT(b.id)::int AS "totalBookings",
          COUNT(*) FILTER (WHERE b.status = 'CANCELLED')::int AS "totalCancellations",
          COALESCE(
            SUM(
              CASE
                WHEN b.status::text = ANY($6::text[]) THEN b."totalAmount"::numeric
                ELSE 0
              END
            ),
            0
          )::numeric AS "revenue",
          CASE
            WHEN ((split_part(fs.config->>'closeTime', ':', 1)::int * 60 + split_part(fs.config->>'closeTime', ':', 2)::int) -
              (split_part(fs.config->>'openTime', ':', 1)::int * 60 + split_part(fs.config->>'openTime', ':', 2)::int))
              <= 0
            THEN 0
            ELSE
              (
                COALESCE(
                  SUM(
                    CASE
                      WHEN b.status::text = ANY($7::text[]) THEN
                        GREATEST(
                          EXTRACT(
                            EPOCH FROM (
                              LEAST(b."endTime", $4::timestamptz) -
                              GREATEST(b."startTime", $3::timestamptz)
                            )
                          ) / 60,
                          0
                        )
                      ELSE 0
                    END
                  ),
                  0
                )
                /
                (
                  ((split_part(fs.config->>'closeTime', ':', 1)::int * 60 + split_part(fs.config->>'closeTime', ':', 2)::int) -
                   (split_part(fs.config->>'openTime', ':', 1)::int * 60 + split_part(fs.config->>'openTime', ':', 2)::int))
                  *
                  GREATEST((date(timezone($2, $4::timestamptz)) - date(timezone($2, $3::timestamptz)) + 1), 1)
                )::numeric
              ) * 100
          END AS "occupancyRate"
        FROM facilities_scope fs
        LEFT JOIN bookings b
          ON b."facilityId" = fs.id
         AND b."startTime" <= $4::timestamptz
         AND b."endTime" >= $3::timestamptz
        GROUP BY fs.id, fs.name, fs.config
        ORDER BY fs.name ASC
      `,
      [
        resolvedTenantId,
        timeZone,
        range.from.toISOString(),
        range.to.toISOString(),
        query.facilityId ?? null,
        REVENUE_STATUSES,
        OCCUPIED_STATUSES,
      ]
    );

    const trend: RevenueTrendPointDto[] = (trendRows as RevenueTrendRow[]).map(
      (row) => ({
        periodStart: new Date(row.periodStart).toISOString(),
        periodLabel: row.periodLabel,
        bookings: this.toNumber(row.bookings),
        revenue: this.round(this.toNumber(row.revenue)),
      })
    );

    const facilityPerformance: FacilityPerformanceRowDto[] = (
      performanceRows as FacilityPerformanceRawRow[]
    ).map((row) => {
      const totalBookings = this.toNumber(row.totalBookings);
      const totalCancellations = this.toNumber(row.totalCancellations);
      return {
        facilityId: row.facilityId,
        facilityName: row.facilityName,
        totalBookings,
        revenue: this.round(this.toNumber(row.revenue)),
        occupancyRate: this.round(this.toNumber(row.occupancyRate)),
        cancellationRate:
          totalBookings === 0
            ? 0
            : this.round((totalCancellations / totalBookings) * 100),
      };
    });

    const response: AnalyticsRevenueResponseDto = {
      groupBy: query.groupBy as AnalyticsGroupBy,
      trend,
      facilityPerformance,
    };

    this.appLogger.info(
      LOG_EVENTS.ANALYTICS_QUERY_SUCCESS,
      'Analytics revenue fetched',
      {
        tenantId: resolvedTenantId,
        facilityId: query.facilityId ?? null,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        groupBy: query.groupBy,
        timeZone,
      }
    );

    return response;
  }

  async getPeakHours(
    query: AnalyticsQueryDto,
    tenantId: string
  ): Promise<AnalyticsPeakHoursResponseDto> {
    const resolvedTenantId = this.requireTenantId(tenantId);
    const timeZone = this.resolveTimeZone(query.timeZone);
    const range = this.parseRange(query.from, query.to);

    if (query.facilityId) {
      await this.ensureFacilityInTenant(query.facilityId, resolvedTenantId);
    }

    const hourlyRows = await this.dataSource.query(
      `
        WITH scoped AS (
          SELECT
            b.id,
            b."startTime",
            b."endTime",
            f.name AS facility_name
          FROM bookings b
          INNER JOIN facilities f ON f.id = b."facilityId"
          WHERE f."tenantId" = $1
            AND b.status::text = ANY($6::text[])
            AND b."startTime" < $4::timestamptz
            AND b."endTime" > $3::timestamptz
            AND ($5::uuid IS NULL OR f.id = $5::uuid)
        )
        SELECT
          EXTRACT(HOUR FROM gs.local_hour)::int AS "hourOfDay",
          COUNT(*)::int AS "bookingCount"
        FROM scoped s
        CROSS JOIN LATERAL generate_series(
          date_trunc('hour', timezone($2::text, GREATEST(s."startTime", $3::timestamptz))),
          date_trunc('hour', timezone($2::text, LEAST(s."endTime", $4::timestamptz) - interval '1 second')),
          interval '1 hour'
        ) AS gs(local_hour)
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      [
        resolvedTenantId,
        timeZone,
        range.from.toISOString(),
        range.to.toISOString(),
        query.facilityId ?? null,
        OCCUPIED_STATUSES,
      ]
    );

    const facilityRows = await this.dataSource.query(
      `
        SELECT
          f.name AS "facilityName",
          COUNT(*)::int AS "bookingCount"
        FROM bookings b
        INNER JOIN facilities f ON f.id = b."facilityId"
        WHERE f."tenantId" = $1
          AND b.status::text = ANY($5::text[])
          AND b."startTime" < $3::timestamptz
          AND b."endTime" > $2::timestamptz
          AND ($4::uuid IS NULL OR f.id = $4::uuid)
        GROUP BY f.name
        ORDER BY "bookingCount" DESC, f.name ASC
        LIMIT 1
      `,
      [
        resolvedTenantId,
        range.from.toISOString(),
        range.to.toISOString(),
        query.facilityId ?? null,
        OCCUPIED_STATUSES,
      ]
    );

    const hourCounts = Array<number>(MINUTES_PER_DAY / 60).fill(0);
    for (const row of hourlyRows as HourlyRow[]) {
      const hour = this.toNumber(row.hourOfDay);
      if (hour >= 0 && hour <= 23) {
        hourCounts[hour] = this.toNumber(row.bookingCount);
      }
    }

    let bestStartHour = -1;
    let bestCount = 0;
    for (let hour = 0; hour < 24; hour += 1) {
      const next = (hour + 1) % 24;
      const count = hourCounts[hour] + hourCounts[next];
      if (count > bestCount) {
        bestCount = count;
        bestStartHour = hour;
      }
    }

    const peakTimeRange =
      bestStartHour >= 0 && bestCount > 0
        ? `${this.padHour(bestStartHour)}:00-${this.padHour(
            (bestStartHour + 2) % 24
          )}:00`
        : null;

    const mostBookedFacility =
      (facilityRows as MostBookedFacilityRow[])[0]?.facilityName ?? null;

    const response: AnalyticsPeakHoursResponseDto = {
      peakTimeRange,
      mostBookedFacility,
      mostBookedCourt: null,
    };

    this.appLogger.info(
      LOG_EVENTS.ANALYTICS_QUERY_SUCCESS,
      'Analytics peak hours fetched',
      {
        tenantId: resolvedTenantId,
        facilityId: query.facilityId ?? null,
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        timeZone,
      }
    );

    return response;
  }

  private async fetchSummaryAggregate(
    tenantId: string,
    range: DateRange,
    facilityId?: string
  ): Promise<SummaryAggregateRow> {
    const rows = await this.dataSource.query(
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
  }

  private getPreviousRange(range: DateRange): DateRange {
    const previousTo = new Date(range.from.getTime() - 1);
    const previousFrom = new Date(previousTo.getTime() - range.durationMs + 1);
    return {
      from: previousFrom,
      to: previousTo,
      durationMs: range.durationMs,
    };
  }

  private parseRange(fromRaw?: string, toRaw?: string): DateRange {
    const from = fromRaw ? new Date(fromRaw) : null;
    const to = toRaw ? new Date(toRaw) : null;

    if (
      !from ||
      !to ||
      Number.isNaN(from.getTime()) ||
      Number.isNaN(to.getTime())
    ) {
      throw new BadRequestException(INVALID_RANGE_MESSAGE);
    }

    if (from.getTime() > to.getTime()) {
      throw new BadRequestException(INVALID_RANGE_MESSAGE);
    }

    const durationMs = to.getTime() - from.getTime() + 1;
    const maxRangeMs = MAX_RANGE_DAYS * MINUTES_PER_DAY * 60 * 1000;
    if (durationMs > maxRangeMs) {
      throw new BadRequestException(INVALID_RANGE_MESSAGE);
    }

    return { from, to, durationMs };
  }

  private resolveTimeZone(timeZone?: string): string {
    const normalized = timeZone?.trim();
    if (!normalized) {
      return 'UTC';
    }

    try {
      Intl.DateTimeFormat('en-US', { timeZone: normalized }).format(new Date());
      return normalized;
    } catch {
      throw new BadRequestException('Invalid timeZone value.');
    }
  }

  private requireTenantId(tenantId?: string): string {
    const normalized = tenantId?.trim();
    if (!normalized) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }
    return normalized;
  }

  private async ensureFacilityInTenant(
    facilityId: string,
    tenantId: string
  ): Promise<void> {
    const rows = await this.dataSource.query(
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
  }

  private calculatePercentageChange(current: number, previous: number): number {
    if (previous === 0) {
      return current === 0 ? 0 : 100;
    }
    return ((current - previous) / Math.abs(previous)) * 100;
  }

  private round(value: number): number {
    return Number(value.toFixed(2));
  }

  private toNumber(value: string | number | null | undefined): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }

  private padHour(hour: number): string {
    return String(hour).padStart(2, '0');
  }
}
