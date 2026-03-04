import { GoalMilestoneDto, GoalProgressDto } from './goals.dto';
export type AnalyticsGroupBy = 'day' | 'week' | 'month';

export interface AnalyticsBaseQueryDto {
  from: string;
  to: string;
  facilityId?: string;
  timeZone?: string;
}

export interface PeriodComparisonDto {
  currentPeriodValue: number;
  previousPeriodValue: number;
  percentageChange: number;
}

export interface AnalyticsSummaryResponseDto {
  totalBookings: number;
  totalRevenue: number;
  totalCancellations: number;
  cancellationRate: number;
  avgBookingValue: number;
  revenueComparison: PeriodComparisonDto;
  bookingsComparison: PeriodComparisonDto;
  goalProgress: GoalProgressDto;
  goalMilestones: GoalMilestoneDto[];
}

export interface OccupancyDayPointDto {
  date: string;
  occupiedMinutes: number;
  availableMinutes: number;
  occupancyRate: number;
  bookingCount: number;
}

export interface AnalyticsOccupancyFacilityDto {
  facilityId: string;
  facilityName: string;
  occupiedMinutes: number;
  availableMinutes: number;
  occupancyRate: number;
  daily: OccupancyDayPointDto[];
}

export interface AnalyticsOccupancyResponseDto {
  facilities: AnalyticsOccupancyFacilityDto[];
  overallOccupancyRate: number;
}

export interface RevenueTrendPointDto {
  periodStart: string;
  periodLabel: string;
  revenue: number;
  bookings: number;
}

export interface FacilityPerformanceRowDto {
  facilityId: string;
  facilityName: string;
  totalBookings: number;
  revenue: number;
  occupancyRate: number;
  cancellationRate: number;
}

export interface AnalyticsRevenueResponseDto {
  groupBy: AnalyticsGroupBy;
  trend: RevenueTrendPointDto[];
  facilityPerformance: FacilityPerformanceRowDto[];
}

export interface AnalyticsPeakHoursResponseDto {
  peakTimeRange: string | null;
  mostBookedFacility: string | null;
  mostBookedCourt: string | null;
}
