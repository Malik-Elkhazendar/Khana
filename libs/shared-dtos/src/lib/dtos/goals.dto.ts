export type GoalMetric = 'REVENUE' | 'OCCUPANCY';

export interface GoalProgressMetricDto {
  target: number | null;
  actual: number;
  pct: number | null;
  reached: boolean;
}

export interface GoalProgressPeriodDto {
  monthStart: string;
  monthEnd: string;
  timeZone: string;
}

export interface GoalProgressDto {
  period: GoalProgressPeriodDto;
  revenue: GoalProgressMetricDto;
  occupancy: GoalProgressMetricDto;
}

export interface GoalMilestoneDto {
  id: string;
  metric: GoalMetric;
  periodMonth: string;
  target: number;
  actualAtReach: number;
  reachedAt: string;
}

export interface GoalSettingsResponseDto {
  monthlyRevenueTarget: number | null;
  monthlyOccupancyTarget: number | null;
  goalsNudgeShownAt: string | null;
  goalsNudgeDismissedAt: string | null;
  shouldShowNudge: boolean;
  updatedAt: string;
}

export interface UpdateGoalsRequestDto {
  monthlyRevenueTarget?: number | null;
  monthlyOccupancyTarget?: number | null;
  markNudgeShown?: boolean;
  dismissNudge?: boolean;
}
