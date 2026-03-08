import { AnalyticsSummaryResponseDto } from '@khana/shared-dtos';
import { AnalyticsQueryDto } from '../dto';
import {
  AnalyticsDependencies,
  calculatePercentageChange,
  ensureFacilityInTenant,
  fetchSummaryAggregate,
  getPreviousRange,
  getTenantTimeZone,
  logAnalyticsSuccess,
  parseRange,
  requireTenantId,
  round,
  toNumber,
} from './analytics.internal';

export const getAnalyticsSummary = async (
  deps: AnalyticsDependencies,
  query: AnalyticsQueryDto,
  tenantId: string
): Promise<AnalyticsSummaryResponseDto> => {
  const resolvedTenantId = requireTenantId(tenantId);
  const timeZone = await getTenantTimeZone(deps, resolvedTenantId);
  const range = await parseRange(deps, query.from, query.to, timeZone);

  if (query.facilityId) {
    await ensureFacilityInTenant(deps, query.facilityId, resolvedTenantId);
  }

  const current = await fetchSummaryAggregate(
    deps,
    resolvedTenantId,
    range,
    query.facilityId
  );
  const previous = await fetchSummaryAggregate(
    deps,
    resolvedTenantId,
    getPreviousRange(range),
    query.facilityId
  );

  const totalBookings = toNumber(current.totalBookings);
  const totalCancellations = toNumber(current.totalCancellations);
  const totalRevenue = toNumber(current.totalRevenue);
  const previousBookings = toNumber(previous.totalBookings);
  const previousRevenue = toNumber(previous.totalRevenue);

  const [goalProgress, goalMilestones] = await Promise.all([
    deps.goalsService.getGoalProgress(resolvedTenantId, timeZone),
    deps.goalsService.listMilestones(resolvedTenantId, 6),
  ]);

  const response: AnalyticsSummaryResponseDto = {
    totalBookings,
    totalRevenue: round(totalRevenue),
    totalCancellations,
    cancellationRate:
      totalBookings === 0
        ? 0
        : round((totalCancellations / totalBookings) * 100),
    avgBookingValue:
      totalBookings === 0 ? 0 : round(totalRevenue / totalBookings),
    revenueComparison: {
      currentPeriodValue: round(totalRevenue),
      previousPeriodValue: round(previousRevenue),
      percentageChange: round(
        calculatePercentageChange(totalRevenue, previousRevenue)
      ),
    },
    bookingsComparison: {
      currentPeriodValue: totalBookings,
      previousPeriodValue: previousBookings,
      percentageChange: round(
        calculatePercentageChange(totalBookings, previousBookings)
      ),
    },
    goalProgress,
    goalMilestones,
  };

  logAnalyticsSuccess(deps, 'Analytics summary fetched', {
    tenantId: resolvedTenantId,
    facilityId: query.facilityId ?? null,
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    timeZone,
  });

  return response;
};
