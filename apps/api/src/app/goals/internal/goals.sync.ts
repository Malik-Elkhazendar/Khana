import { AuditAction, GoalMetric, User } from '@khana/data-access';
import {
  DEFAULT_TENANT_TIMEZONE,
  GoalSettingsResponseDto,
  UpdateGoalsRequestDto,
} from '@khana/shared-dtos';
import { LOG_EVENTS } from '../../logging';
import {
  getTenantOrThrow,
  GoalsDependencies,
  round,
  toSettingsResponse,
  toSettingsSnapshot,
} from './goals.internal';
import { getGoalProgressWorkflow } from './goals.query';

export const updateGoalSettingsWorkflow = async (
  deps: GoalsDependencies,
  tenantId: string,
  dto: UpdateGoalsRequestDto,
  actor: User,
  ipAddress?: string,
  userAgent?: string
): Promise<GoalSettingsResponseDto> => {
  const tenant = await getTenantOrThrow(deps, tenantId);
  const before = toSettingsSnapshot(tenant);
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
    await deps.tenantRepository.save(tenant);

    const after = toSettingsSnapshot(tenant);
    await deps.auditLogRepository.save(
      deps.auditLogRepository.create({
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

    deps.appLogger.info(
      LOG_EVENTS.GOALS_SETTINGS_UPDATED,
      'Tenant goals settings updated',
      {
        tenantId: tenant.id,
        actorUserId: actor.id,
      }
    );
  }

  await syncMilestonesForCurrentMonthWorkflow(
    deps,
    tenant.id,
    DEFAULT_TENANT_TIMEZONE
  );

  const updated = await getTenantOrThrow(deps, tenant.id);
  return toSettingsResponse(updated);
};

export const syncMilestonesForCurrentMonthWorkflow = async (
  deps: GoalsDependencies,
  tenantId: string,
  timeZone?: string
): Promise<void> => {
  const tenant = await getTenantOrThrow(deps, tenantId);
  const progress = await getGoalProgressWorkflow(deps, tenant.id, timeZone);
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

    const insertResult = await deps.goalMilestoneRepository
      .createQueryBuilder()
      .insert()
      .values({
        tenantId: tenant.id,
        metric: candidate.metric,
        periodMonth,
        target: candidate.target,
        actualAtReach: round(candidate.actual, 2),
        reachedAt: new Date(),
      })
      .orIgnore()
      .returning(['id'])
      .execute();

    if ((insertResult.raw as Array<{ id: string }>).length > 0) {
      deps.appLogger.info(
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
};
