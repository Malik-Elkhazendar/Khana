import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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
  GoalMilestoneDto,
  GoalProgressDto,
  GoalSettingsResponseDto,
  UpdateGoalsRequestDto,
} from '@khana/shared-dtos';
import { DataSource, Repository } from 'typeorm';
import { AppLoggerService, LOG_EVENTS } from '../logging';

const RESOURCE_NOT_FOUND_MESSAGE = 'Resource not found';

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

type MonthWindow = {
  monthStartUtc: Date;
  nextMonthStartUtc: Date;
  monthEndUtc: Date;
  periodMonth: string;
  timeZone: string;
};

@Injectable()
export class GoalsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(GoalMilestone)
    private readonly goalMilestoneRepository: Repository<GoalMilestone>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    private readonly dataSource: DataSource,
    private readonly appLogger: AppLoggerService
  ) {}

  async getGoalSettings(tenantId: string): Promise<GoalSettingsResponseDto> {
    const tenant = await this.getTenantOrThrow(tenantId);
    return this.toSettingsResponse(tenant);
  }

  async updateGoalSettings(
    tenantId: string,
    dto: UpdateGoalsRequestDto,
    actor: User,
    ipAddress?: string,
    userAgent?: string
  ): Promise<GoalSettingsResponseDto> {
    const tenant = await this.getTenantOrThrow(tenantId);
    const before = this.toSettingsSnapshot(tenant);
    let changed = false;

    if (Object.prototype.hasOwnProperty.call(dto, 'monthlyRevenueTarget')) {
      tenant.monthlyRevenueTarget =
        dto.monthlyRevenueTarget === null
          ? null
          : Number(dto.monthlyRevenueTarget);
      changed = true;
    }

    if (Object.prototype.hasOwnProperty.call(dto, 'monthlyOccupancyTarget')) {
      tenant.monthlyOccupancyTarget =
        dto.monthlyOccupancyTarget === null
          ? null
          : Number(dto.monthlyOccupancyTarget);
      changed = true;
    }

    if (dto.markNudgeShown && !tenant.goalsNudgeShownAt) {
      tenant.goalsNudgeShownAt = new Date();
      changed = true;
    }

    if (dto.dismissNudge) {
      tenant.goalsNudgeDismissedAt = new Date();
      changed = true;
    }

    if (changed) {
      await this.tenantRepository.save(tenant);

      const after = this.toSettingsSnapshot(tenant);
      await this.auditLogRepository.save(
        this.auditLogRepository.create({
          tenantId: tenant.id,
          userId: actor.id,
          action: AuditAction.UPDATE,
          entityType: 'TenantGoals',
          entityId: tenant.id,
          changes: { before, after },
          ipAddress,
          userAgent,
          description: 'Tenant goals settings updated',
        })
      );

      this.appLogger.info(
        LOG_EVENTS.GOALS_SETTINGS_UPDATED,
        'Tenant goals settings updated',
        {
          tenantId: tenant.id,
          actorUserId: actor.id,
        }
      );
    }

    await this.syncMilestonesForCurrentMonth(
      tenant.id,
      DEFAULT_TENANT_TIMEZONE
    );

    const updated = await this.getTenantOrThrow(tenant.id);
    return this.toSettingsResponse(updated);
  }

  async getGoalProgress(
    tenantId: string,
    timeZone?: string
  ): Promise<GoalProgressDto> {
    const tenant = await this.getTenantOrThrow(tenantId);
    const resolvedTimeZone = this.resolveTimeZone(timeZone);
    const window = await this.resolveCurrentMonthWindow(resolvedTimeZone);

    const revenueActual = await this.calculateRevenueActual(tenant.id, window);
    const occupancyActual = await this.calculateOccupancyActual(
      tenant.id,
      window
    );

    const revenueTarget = this.toNullableNumber(tenant.monthlyRevenueTarget);
    const occupancyTarget = this.toNullableNumber(
      tenant.monthlyOccupancyTarget
    );

    return {
      period: {
        monthStart: window.monthStartUtc.toISOString(),
        monthEnd: window.monthEndUtc.toISOString(),
        timeZone: resolvedTimeZone,
      },
      revenue: {
        target: revenueTarget,
        actual: revenueActual,
        pct: this.computePct(revenueActual, revenueTarget),
        reached: revenueTarget !== null && revenueActual >= revenueTarget,
      },
      occupancy: {
        target: occupancyTarget,
        actual: occupancyActual,
        pct: this.computePct(occupancyActual, occupancyTarget),
        reached: occupancyTarget !== null && occupancyActual >= occupancyTarget,
      },
    };
  }

  async listMilestones(
    tenantId: string,
    limit = 6
  ): Promise<GoalMilestoneDto[]> {
    const rows = await this.goalMilestoneRepository.find({
      where: { tenantId },
      order: { reachedAt: 'DESC' },
      take: Math.max(1, Math.min(limit, 30)),
    });

    return rows.map((row) => ({
      id: row.id,
      metric: row.metric,
      periodMonth: row.periodMonth,
      target: this.toNumber(row.target),
      actualAtReach: this.toNumber(row.actualAtReach),
      reachedAt: row.reachedAt.toISOString(),
    }));
  }

  async syncMilestonesForCurrentMonth(
    tenantId: string,
    timeZone?: string
  ): Promise<void> {
    const tenant = await this.getTenantOrThrow(tenantId);
    const progress = await this.getGoalProgress(tenant.id, timeZone);
    const periodMonth = progress.period.monthStart.slice(0, 10);

    const candidates: Array<{
      metric: GoalMetric;
      target: number | null;
      actual: number;
    }> = [
      {
        metric: GoalMetric.REVENUE,
        target: progress.revenue.target,
        actual: progress.revenue.actual,
      },
      {
        metric: GoalMetric.OCCUPANCY,
        target: progress.occupancy.target,
        actual: progress.occupancy.actual,
      },
    ];

    for (const candidate of candidates) {
      if (candidate.target === null || candidate.actual < candidate.target) {
        continue;
      }

      const insertResult = await this.goalMilestoneRepository
        .createQueryBuilder()
        .insert()
        .values({
          tenantId: tenant.id,
          metric: candidate.metric,
          periodMonth,
          target: candidate.target,
          actualAtReach: this.round(candidate.actual, 2),
          reachedAt: new Date(),
        })
        .orIgnore()
        .returning(['id'])
        .execute();

      if ((insertResult.raw as Array<{ id: string }>).length > 0) {
        this.appLogger.info(
          LOG_EVENTS.GOALS_MILESTONE_REACHED,
          'Goal milestone reached',
          {
            tenantId: tenant.id,
            metric: candidate.metric,
            periodMonth,
          }
        );
      }
    }
  }

  private async getTenantOrThrow(tenantId: string): Promise<Tenant> {
    const tenant = await this.tenantRepository.findOne({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException(RESOURCE_NOT_FOUND_MESSAGE);
    }

    return tenant;
  }

  private toSettingsSnapshot(tenant: Tenant) {
    return {
      monthlyRevenueTarget: this.toNullableNumber(tenant.monthlyRevenueTarget),
      monthlyOccupancyTarget: this.toNullableNumber(
        tenant.monthlyOccupancyTarget
      ),
      goalsNudgeShownAt: tenant.goalsNudgeShownAt?.toISOString() ?? null,
      goalsNudgeDismissedAt:
        tenant.goalsNudgeDismissedAt?.toISOString() ?? null,
    };
  }

  private toSettingsResponse(tenant: Tenant): GoalSettingsResponseDto {
    const monthlyRevenueTarget = this.toNullableNumber(
      tenant.monthlyRevenueTarget
    );
    const monthlyOccupancyTarget = this.toNullableNumber(
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
  }

  private resolveTimeZone(timeZone?: string): string {
    if (!timeZone) return DEFAULT_TENANT_TIMEZONE;
    try {
      Intl.DateTimeFormat(undefined, { timeZone }).format(new Date());
      return timeZone;
    } catch {
      return DEFAULT_TENANT_TIMEZONE;
    }
  }

  private async resolveCurrentMonthWindow(
    timeZone: string
  ): Promise<MonthWindow> {
    const [row] = await this.dataSource.query(
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
  }

  private async calculateRevenueActual(
    tenantId: string,
    window: MonthWindow
  ): Promise<number> {
    const [row] = await this.dataSource.query(
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

    return this.round(this.toNumber(row?.revenue), 2);
  }

  private async calculateOccupancyActual(
    tenantId: string,
    window: MonthWindow
  ): Promise<number> {
    const [row] = await this.dataSource.query(
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

    const available = this.toNumber(row?.availableMinutes);
    const occupied = this.toNumber(row?.occupiedMinutes);
    if (available <= 0) return 0;
    return this.round((occupied / available) * 100, 2);
  }

  private computePct(actual: number, target: number | null): number | null {
    if (target === null) return null;
    if (target <= 0) return null;
    return this.round((actual / target) * 100, 2);
  }

  private toNumber(value: unknown): number {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : 0;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }

  private toNullableNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    return this.toNumber(value);
  }

  private round(value: number, precision = 2): number {
    const factor = 10 ** precision;
    return Math.round(value * factor) / factor;
  }
}
