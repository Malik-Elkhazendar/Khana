import { AnalyticsPeakHoursResponseDto } from '@khana/shared-dtos';
import { AnalyticsQueryDto } from '../dto';
import {
  AnalyticsDependencies,
  HourlyRow,
  MINUTES_PER_DAY,
  MostBookedFacilityRow,
  OCCUPIED_STATUSES,
  ensureFacilityInTenant,
  getTenantTimeZone,
  logAnalyticsSuccess,
  padHour,
  parseRange,
  requireTenantId,
  toNumber,
} from './analytics.internal';

export const getAnalyticsPeakHours = async (
  deps: AnalyticsDependencies,
  query: AnalyticsQueryDto,
  tenantId: string
): Promise<AnalyticsPeakHoursResponseDto> => {
  const resolvedTenantId = requireTenantId(tenantId);
  const timeZone = await getTenantTimeZone(deps, resolvedTenantId);
  const range = await parseRange(deps, query.from, query.to, timeZone);

  if (query.facilityId) {
    await ensureFacilityInTenant(deps, query.facilityId, resolvedTenantId);
  }

  const hourlyRows = await deps.dataSource.query(
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

  const facilityRows = await deps.dataSource.query(
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
    const hour = toNumber(row.hourOfDay);
    if (hour >= 0 && hour <= 23) {
      hourCounts[hour] = toNumber(row.bookingCount);
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
      ? `${padHour(bestStartHour)}:00-${padHour((bestStartHour + 2) % 24)}:00`
      : null;

  const mostBookedFacility =
    (facilityRows as MostBookedFacilityRow[])[0]?.facilityName ?? null;

  const response: AnalyticsPeakHoursResponseDto = {
    peakTimeRange,
    mostBookedFacility,
    mostBookedCourt: null,
  };

  logAnalyticsSuccess(deps, 'Analytics peak hours fetched', {
    tenantId: resolvedTenantId,
    facilityId: query.facilityId ?? null,
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    timeZone,
  });

  return response;
};
