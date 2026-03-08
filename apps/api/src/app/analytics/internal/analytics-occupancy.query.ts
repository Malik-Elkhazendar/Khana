import {
  AnalyticsOccupancyFacilityDto,
  AnalyticsOccupancyResponseDto,
} from '@khana/shared-dtos';
import { AnalyticsQueryDto } from '../dto';
import {
  AnalyticsDependencies,
  OCCUPIED_STATUSES,
  OccupancyRow,
  ensureFacilityInTenant,
  getTenantTimeZone,
  logAnalyticsIntegrityWarning,
  logAnalyticsSuccess,
  parseRange,
  requireTenantId,
  round,
  toNumber,
} from './analytics.internal';

export const getAnalyticsOccupancy = async (
  deps: AnalyticsDependencies,
  query: AnalyticsQueryDto,
  tenantId: string
): Promise<AnalyticsOccupancyResponseDto> => {
  const resolvedTenantId = requireTenantId(tenantId);
  const timeZone = await getTenantTimeZone(deps, resolvedTenantId);
  const range = await parseRange(deps, query.from, query.to, timeZone);

  if (query.facilityId) {
    await ensureFacilityInTenant(deps, query.facilityId, resolvedTenantId);
  }

  const rows = await deps.dataSource.query(
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
          GREATEST(operating_window.close_minutes - operating_window.open_minutes, 0)::int AS operating_minutes,
          CASE
            WHEN operating_window.close_minutes > operating_window.open_minutes
            THEN (d.local_day::timestamp + make_interval(mins => operating_window.open_minutes)) AT TIME ZONE $2
            ELSE NULL
          END AS operating_start_utc,
          CASE
            WHEN operating_window.close_minutes > operating_window.open_minutes
            THEN (d.local_day::timestamp + make_interval(mins => operating_window.close_minutes)) AT TIME ZONE $2
            ELSE NULL
          END AS operating_end_utc
        FROM facilities_scope fs
        CROSS JOIN days d
        CROSS JOIN LATERAL (
          SELECT
            (split_part(fs.config->>'openTime', ':', 1)::int * 60 + split_part(fs.config->>'openTime', ':', 2)::int) AS open_minutes,
            (split_part(fs.config->>'closeTime', ':', 1)::int * 60 + split_part(fs.config->>'closeTime', ':', 2)::int) AS close_minutes
        ) operating_window
      )
      SELECT
        fd.facility_id AS "facilityId",
        fd.facility_name AS "facilityName",
        fd.local_day::text AS "date",
        fd.operating_minutes AS "availableMinutes",
        COALESCE(SUM(booking_overlap.overlap_minutes), 0)::numeric AS "occupiedMinutes",
        (
          COUNT(DISTINCT booking_overlap.booking_id)
          FILTER (WHERE booking_overlap.overlap_minutes > 0)
        )::int AS "bookingCount"
      FROM facility_days fd
      LEFT JOIN LATERAL (
        SELECT
          b.id AS booking_id,
          GREATEST(
            EXTRACT(
              EPOCH FROM (
                LEAST(b."endTime", fd.operating_end_utc, $4::timestamptz) -
                GREATEST(b."startTime", fd.operating_start_utc, $3::timestamptz)
              )
            ) / 60,
            0
          )::numeric AS overlap_minutes
        FROM bookings b
        WHERE fd.operating_start_utc IS NOT NULL
          AND fd.operating_end_utc IS NOT NULL
          AND b."facilityId" = fd.facility_id
          AND b.status::text = ANY($6::text[])
          AND b."startTime" < LEAST(fd.operating_end_utc, $4::timestamptz)
          AND b."endTime" > GREATEST(fd.operating_start_utc, $3::timestamptz)
      ) booking_overlap ON true
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
    const availableMinutes = Math.max(toNumber(row.availableMinutes), 0);
    const occupiedMinutes = Math.max(toNumber(row.occupiedMinutes), 0);
    const bookingCount = Math.max(toNumber(row.bookingCount), 0);
    if (bookingCount === 0 && occupiedMinutes > 0) {
      logAnalyticsIntegrityWarning(deps, {
        tenantId: resolvedTenantId,
        facilityId,
        date: row.date,
        occupiedMinutes,
        bookingCount,
        availableMinutes,
      });
    }
    const dayOccupancyRate =
      availableMinutes === 0
        ? 0
        : round((occupiedMinutes / availableMinutes) * 100);

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
      occupiedMinutes: round(occupiedMinutes),
      availableMinutes: round(availableMinutes),
      occupancyRate: dayOccupancyRate,
      bookingCount,
    });

    target.occupiedMinutes = round(target.occupiedMinutes + occupiedMinutes);
    target.availableMinutes = round(target.availableMinutes + availableMinutes);
    target.occupancyRate =
      target.availableMinutes === 0
        ? 0
        : round((target.occupiedMinutes / target.availableMinutes) * 100);

    totalOccupied += occupiedMinutes;
    totalAvailable += availableMinutes;
  }

  const response: AnalyticsOccupancyResponseDto = {
    facilities: [...facilityMap.values()],
    overallOccupancyRate:
      totalAvailable === 0 ? 0 : round((totalOccupied / totalAvailable) * 100),
  };

  logAnalyticsSuccess(deps, 'Analytics occupancy fetched', {
    tenantId: resolvedTenantId,
    facilityId: query.facilityId ?? null,
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    timeZone,
  });

  return response;
};
