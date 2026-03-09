import { GoalMetric } from '@khana/data-access';
import {
  GoalMilestoneDto,
  GoalProgressDto,
  GoalSettingsResponseDto,
} from '@khana/shared-dtos';
import {
  calculateOccupancyActual,
  calculateRevenueActual,
  computePct,
  getTenantOrThrow,
  GoalsDependencies,
  resolveCurrentMonthWindow,
  resolveTimeZone,
  toNullableNumber,
  toNumber,
  toSettingsResponse,
} from './goals.internal';

export const getGoalSettingsWorkflow = async (
  deps: GoalsDependencies,
  tenantId: string
): Promise<GoalSettingsResponseDto> => {
  const tenant = await getTenantOrThrow(deps, tenantId);
  return toSettingsResponse(tenant);
};

export const getGoalProgressWorkflow = async (
  deps: GoalsDependencies,
  tenantId: string,
  timeZone?: string
): Promise<GoalProgressDto> => {
  const tenant = await getTenantOrThrow(deps, tenantId);
  const resolvedTimeZone = resolveTimeZone(timeZone);
  const window = await resolveCurrentMonthWindow(deps, resolvedTimeZone);

  const revenueActual = await calculateRevenueActual(deps, tenant.id, window);
  const occupancyActual = await calculateOccupancyActual(
    deps,
    tenant.id,
    window
  );

  const revenueTarget = toNullableNumber(tenant.monthlyRevenueTarget);
  const occupancyTarget = toNullableNumber(tenant.monthlyOccupancyTarget);

  return {
    period: {
      monthStart: window.monthStartUtc.toISOString(),
      monthEnd: window.monthEndUtc.toISOString(),
      timeZone: resolvedTimeZone,
    },
    revenue: {
      target: revenueTarget,
      actual: revenueActual,
      pct: computePct(revenueActual, revenueTarget),
      reached: revenueTarget !== null && revenueActual >= revenueTarget,
    },
    occupancy: {
      target: occupancyTarget,
      actual: occupancyActual,
      pct: computePct(occupancyActual, occupancyTarget),
      reached: occupancyTarget !== null && occupancyActual >= occupancyTarget,
    },
  };
};

export const listMilestonesWorkflow = async (
  deps: GoalsDependencies,
  tenantId: string,
  limit = 6
): Promise<GoalMilestoneDto[]> => {
  const rows = await deps.goalMilestoneRepository.find({
    where: { tenantId },
    order: { reachedAt: 'DESC' },
    take: Math.max(1, Math.min(limit, 30)),
  });

  return rows.map((row) => ({
    id: row.id,
    metric: row.metric as GoalMetric,
    periodMonth: row.periodMonth,
    target: toNumber(row.target),
    actualAtReach: toNumber(row.actualAtReach),
    reachedAt: row.reachedAt.toISOString(),
  }));
};
