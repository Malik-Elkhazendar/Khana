import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PeriodComparisonDoc {
  @ApiProperty({ example: 12000 })
  currentPeriodValue!: number;

  @ApiProperty({ example: 11000 })
  previousPeriodValue!: number;

  @ApiProperty({ example: 9.09 })
  percentageChange!: number;
}

export class GoalProgressMetricDoc {
  @ApiPropertyOptional({ nullable: true, example: 25000 })
  target!: number | null;

  @ApiProperty({ example: 18400 })
  actual!: number;

  @ApiPropertyOptional({ nullable: true, example: 73.6 })
  pct!: number | null;

  @ApiProperty({ example: false })
  reached!: boolean;
}

export class GoalProgressPeriodDoc {
  @ApiProperty({ example: '2026-03-01T00:00:00.000Z' })
  monthStart!: string;

  @ApiProperty({ example: '2026-03-31T23:59:59.999Z' })
  monthEnd!: string;

  @ApiProperty({ example: 'Asia/Riyadh' })
  timeZone!: string;
}

export class GoalProgressDoc {
  @ApiProperty({ type: () => GoalProgressPeriodDoc })
  period!: GoalProgressPeriodDoc;

  @ApiProperty({ type: () => GoalProgressMetricDoc })
  revenue!: GoalProgressMetricDoc;

  @ApiProperty({ type: () => GoalProgressMetricDoc })
  occupancy!: GoalProgressMetricDoc;
}

export class GoalMilestoneDoc {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: ['REVENUE', 'OCCUPANCY'], example: 'REVENUE' })
  metric!: 'REVENUE' | 'OCCUPANCY';

  @ApiProperty({ example: '2026-03-01' })
  periodMonth!: string;

  @ApiProperty({ example: 25000 })
  target!: number;

  @ApiProperty({ example: 25040 })
  actualAtReach!: number;

  @ApiProperty({ type: String, format: 'date-time' })
  reachedAt!: string;
}

export class AnalyticsSummaryResponseDoc {
  @ApiProperty({ example: 120 })
  totalBookings!: number;

  @ApiProperty({ example: 18400 })
  totalRevenue!: number;

  @ApiProperty({ example: 8 })
  totalCancellations!: number;

  @ApiProperty({ example: 6.67 })
  cancellationRate!: number;

  @ApiProperty({ example: 153.33 })
  avgBookingValue!: number;

  @ApiProperty({ type: () => PeriodComparisonDoc })
  revenueComparison!: PeriodComparisonDoc;

  @ApiProperty({ type: () => PeriodComparisonDoc })
  bookingsComparison!: PeriodComparisonDoc;

  @ApiProperty({ type: () => GoalProgressDoc })
  goalProgress!: GoalProgressDoc;

  @ApiProperty({ type: () => GoalMilestoneDoc, isArray: true })
  goalMilestones!: GoalMilestoneDoc[];
}

export class OccupancyDayPointDoc {
  @ApiProperty({ example: '2026-03-11' })
  date!: string;

  @ApiProperty({ example: 360 })
  occupiedMinutes!: number;

  @ApiProperty({ example: 720 })
  availableMinutes!: number;

  @ApiProperty({ example: 50 })
  occupancyRate!: number;

  @ApiProperty({ example: 6 })
  bookingCount!: number;
}

export class AnalyticsOccupancyFacilityDoc {
  @ApiProperty({ format: 'uuid' })
  facilityId!: string;

  @ApiProperty({ example: 'Court 1' })
  facilityName!: string;

  @ApiProperty({ example: 360 })
  occupiedMinutes!: number;

  @ApiProperty({ example: 720 })
  availableMinutes!: number;

  @ApiProperty({ example: 50 })
  occupancyRate!: number;

  @ApiProperty({ type: () => OccupancyDayPointDoc, isArray: true })
  daily!: OccupancyDayPointDoc[];
}

export class AnalyticsOccupancyResponseDoc {
  @ApiProperty({ type: () => AnalyticsOccupancyFacilityDoc, isArray: true })
  facilities!: AnalyticsOccupancyFacilityDoc[];

  @ApiProperty({ example: 62.4 })
  overallOccupancyRate!: number;
}

export class RevenueTrendPointDoc {
  @ApiProperty({ example: '2026-03-01T00:00:00.000Z' })
  periodStart!: string;

  @ApiProperty({ example: 'Mar 1' })
  periodLabel!: string;

  @ApiProperty({ example: 4200 })
  revenue!: number;

  @ApiProperty({ example: 24 })
  bookings!: number;
}

export class FacilityPerformanceRowDoc {
  @ApiProperty({ format: 'uuid' })
  facilityId!: string;

  @ApiProperty({ example: 'Court 1' })
  facilityName!: string;

  @ApiProperty({ example: 42 })
  totalBookings!: number;

  @ApiProperty({ example: 8400 })
  revenue!: number;

  @ApiProperty({ example: 68.4 })
  occupancyRate!: number;

  @ApiProperty({ example: 3.2 })
  cancellationRate!: number;
}

export class AnalyticsRevenueResponseDoc {
  @ApiProperty({ enum: ['day', 'week', 'month'], example: 'day' })
  groupBy!: 'day' | 'week' | 'month';

  @ApiProperty({ type: () => RevenueTrendPointDoc, isArray: true })
  trend!: RevenueTrendPointDoc[];

  @ApiProperty({ type: () => FacilityPerformanceRowDoc, isArray: true })
  facilityPerformance!: FacilityPerformanceRowDoc[];
}

export class AnalyticsPeakHoursResponseDoc {
  @ApiPropertyOptional({ nullable: true, example: '18:00-19:00' })
  peakTimeRange!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Padel Hall' })
  mostBookedFacility!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Court 1' })
  mostBookedCourt!: string | null;
}
