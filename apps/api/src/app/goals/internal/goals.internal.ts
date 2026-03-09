import { NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  AuditLog,
  GoalMetric,
  GoalMilestone,
  Tenant,
  User,
} from '@khana/data-access';
import {
  BookingStatus,
  DEFAULT_TENANT_TIMEZONE,
  GoalSettingsResponseDto,
} from '@khana/shared-dtos';
import { DataSource, Repository } from 'typeorm';
import { AppLoggerService } from '../../logging';

export const RESOURCE_NOT_FOUND_MESSAGE = 'Resource not found';

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

export type MonthWindow = {
  monthStartUtc: Date;
  nextMonthStartUtc: Date;
  monthEndUtc: Date;
  periodMonth: string;
  timeZone: string;
};

export type GoalsDependencies = {
  tenantRepository: Repository<Tenant>;
  goalMilestoneRepository: Repository<GoalMilestone>;
  auditLogRepository: Repository<AuditLog>;
  dataSource: DataSource;
  appLogger: AppLoggerService;
};

export const getTenantOrThrow = async (
  deps: GoalsDependencies,
  tenantId: string
): Promise<Tenant> => {
  const tenant = await deps.tenantRepository.findOne({
    where: { id: tenantId },
  });

  if (!tenant) {
    throw new NotFoundException(RESOURCE_NOT_FOUND_MESSAGE);
  }

  return tenant;
};

export const toSettingsSnapshot = (tenant: Tenant) => {
  return {
    monthlyRevenueTarget: toNullableNumber(tenant.monthlyRevenueTarget),
    monthlyOccupancyTarget: toNullableNumber(tenant.monthlyOccupancyTarget),
    goalsNudgeShownAt: tenant.goalsNudgeShownAt?.toISOString() ?? null,
    goalsNudgeDismissedAt: tenant.goalsNudgeDismissedAt?.toISOString() ?? null,
  };
};

export const toSettingsResponse = (tenant: Tenant): GoalSettingsResponseDto => {
  const monthlyRevenueTarget = toNullableNumber(tenant.monthlyRevenueTarget);
  const monthlyOccupancyTarget = toNullableNumber(
    tenant.monthlyOccupancyTarget
  );
  const goalsNudgeShownAt = tenant.goalsNudgeShownAt?.toISOString() ?? null;
  const goalsNudgeDismissedAt =
    tenant.goalsNudgeDismissedAt?.toISOString() ?? null;

  return {
    monthlyRevenueTarget,
    monthlyOccupancyTarget,
    goalsNudgeShownAt,
    goalsNudgeDismissedAt,
    shouldShowNudge:
      !goalsNudgeShownAt &&
      !goalsNudgeDismissedAt &&
      monthlyRevenueTarget === null &&
      monthlyOccupancyTarget === null,
    updatedAt: tenant.updatedAt.toISOString(),
  };
};

export const resolveTimeZone = (timeZone?: string): string => {
  if (!timeZone) return DEFAULT_TENANT_TIMEZONE;
  try {
    Intl.DateTimeFormat(undefined, { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return DEFAULT_TENANT_TIMEZONE;
  }
};

export const resolveCurrentMonthWindow = async (
  deps: GoalsDependencies,
  timeZone: string
): Promise<MonthWindow> => {
  const [row] = await deps.dataSource.query(
    `
      SELECT
        (date_trunc('month', timezone($1, now())) AT TIME ZONE $1) AS "monthStartUtc",
        ((date_trunc('month', timezone($1, now())) + interval '1 month') AT TIME ZONE $1) AS "nextMonthStartUtc",
        to_char(date_trunc('month', timezone($1, now())), 'YYYY-MM-DD') AS "periodMonth"
    `,
    [timeZone]
  );

  const monthStartUtc = new Date(row.monthStartUtc);
  const nextMonthStartUtc = new Date(row.nextMonthStartUtc);
  const monthEndUtc = new Date(nextMonthStartUtc.getTime() - 1);

  return {
    monthStartUtc,
    nextMonthStartUtc,
    monthEndUtc,
    periodMonth: row.periodMonth,
    timeZone,
  };
};

export const calculateRevenueActual = async (
  deps: GoalsDependencies,
  tenantId: string,
  window: MonthWindow
): Promise<number> => {
  const [row] = await deps.dataSource.query(
    `
      SELECT COALESCE(
        SUM(
          CASE
            WHEN b.status::text = ANY($4::text[]) THEN b."totalAmount"::numeric
            ELSE 0
          END
        ),
        0
      )::numeric AS "revenue"
      FROM bookings b
      INNER JOIN facilities f ON f.id = b."facilityId"
      WHERE f."tenantId" = $1
        AND b."startTime" >= $2::timestamptz
        AND b."startTime" < $3::timestamptz
    `,
    [
      tenantId,
      window.monthStartUtc.toISOString(),
      window.nextMonthStartUtc.toISOString(),
      REVENUE_STATUSES,
    ]
  );

  return round(toNumber(row?.revenue), 2);
};

export const calculateOccupancyActual = async (
  deps: GoalsDependencies,
  tenantId: string,
  window: MonthWindow
): Promise<number> => {
  const [row] = await deps.dataSource.query(
    `
      WITH facilities_scope AS (
        SELECT f.id, f.config
        FROM facilities f
        WHERE f."tenantId" = $1
          AND f."isActive" = true
      ),
      days AS (
        SELECT generate_series(
          date(timezone($2, $3::timestamptz)),
          date(timezone($2, ($4::timestamptz - interval '1 millisecond'))),
          interval '1 day'
        )::date AS local_day
      ),
      facility_days AS (
        SELECT
          fs.id AS facility_id,
          ((split_part(fs.config->>'closeTime', ':', 1)::int * 60 + split_part(fs.config->>'closeTime', ':', 2)::int) -
           (split_part(fs.config->>'openTime', ':', 1)::int * 60 + split_part(fs.config->>'openTime', ':', 2)::int)
          )::int AS operating_minutes,
          (d.local_day::timestamp AT TIME ZONE $2) AS day_start_utc,
          ((d.local_day + interval '1 day')::timestamp AT TIME ZONE $2) AS day_end_utc
        FROM facilities_scope fs
        CROSS JOIN days d
      )
      SELECT
        COALESCE(SUM(fd.operating_minutes), 0)::numeric AS "availableMinutes",
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
        )::numeric AS "occupiedMinutes"
      FROM facility_days fd
      LEFT JOIN bookings b
        ON b."facilityId" = fd.facility_id
       AND b.status::text = ANY($5::text[])
       AND b."startTime" < fd.day_end_utc
       AND b."endTime" > fd.day_start_utc
       AND b."startTime" < $4::timestamptz
       AND b."endTime" > $3::timestamptz
    `,
    [
      tenantId,
      window.timeZone,
      window.monthStartUtc.toISOString(),
      window.nextMonthStartUtc.toISOString(),
      OCCUPIED_STATUSES,
    ]
  );

  const available = toNumber(row?.availableMinutes);
  const occupied = toNumber(row?.occupiedMinutes);
  if (available <= 0) return 0;
  return round((occupied / available) * 100, 2);
};

export const computePct = (
  actual: number,
  target: number | null
): number | null => {
  if (target === null) return null;
  if (target <= 0) return null;
  return round((actual / target) * 100, 2);
};

export const toNumber = (value: unknown): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export const toNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  return toNumber(value);
};

export const round = (value: number, precision = 2): number => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};
