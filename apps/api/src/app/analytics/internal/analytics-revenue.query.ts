import {
  AnalyticsGroupBy,
  AnalyticsRevenueResponseDto,
  FacilityPerformanceRowDto,
  RevenueTrendPointDto,
} from '@khana/shared-dtos';
import { RevenueQueryDto } from '../dto';
import {
  AnalyticsDependencies,
  FacilityPerformanceRawRow,
  OCCUPIED_STATUSES,
  REVENUE_STATUSES,
  RevenueTrendRow,
  ensureFacilityInTenant,
  getTenantTimeZone,
  logAnalyticsSuccess,
  parseRange,
  requireTenantId,
  toFacilityPerformanceRow,
  toTrendPoint,
} from './analytics.internal';

export const getAnalyticsRevenue = async (
  deps: AnalyticsDependencies,
  query: RevenueQueryDto,
  tenantId: string
): Promise<AnalyticsRevenueResponseDto> => {
  const resolvedTenantId = requireTenantId(tenantId);
  const timeZone = await getTenantTimeZone(deps, resolvedTenantId);
  const range = await parseRange(deps, query.from, query.to, timeZone);

  if (query.facilityId) {
    await ensureFacilityInTenant(deps, query.facilityId, resolvedTenantId);
  }

  const trendRows = await deps.dataSource.query(
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

  const performanceRows = await deps.dataSource.query(
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
    toTrendPoint
  );

  const facilityPerformance: FacilityPerformanceRowDto[] = (
    performanceRows as FacilityPerformanceRawRow[]
  ).map(toFacilityPerformanceRow);

  const response: AnalyticsRevenueResponseDto = {
    groupBy: query.groupBy as AnalyticsGroupBy,
    trend,
    facilityPerformance,
  };

  logAnalyticsSuccess(deps, 'Analytics revenue fetched', {
    tenantId: resolvedTenantId,
    facilityId: query.facilityId ?? null,
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    groupBy: query.groupBy,
    timeZone,
  });

  return response;
};
