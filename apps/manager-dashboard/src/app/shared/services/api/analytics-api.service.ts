import { Injectable, inject } from '@angular/core';
import {
  AnalyticsBaseQueryDto,
  AnalyticsGroupBy,
  AnalyticsOccupancyResponseDto,
  AnalyticsPeakHoursResponseDto,
  AnalyticsRevenueResponseDto,
  AnalyticsSummaryResponseDto,
} from '@khana/shared-dtos';
import { Observable } from 'rxjs';
import { buildAnalyticsParams } from './api-params';
import type {
  AnalyticsGetOccupancyParams,
  AnalyticsGetPeakHoursParams,
  AnalyticsGetRevenueParams,
  AnalyticsGetSummaryParams,
} from './generated/model';
import { AnalyticsService as GeneratedAnalyticsService } from './generated/analytics/analytics.service';

@Injectable({ providedIn: 'root' })
export class AnalyticsApiService {
  private readonly generatedApi = inject(GeneratedAnalyticsService);

  getAnalyticsSummary(
    query: AnalyticsBaseQueryDto
  ): Observable<AnalyticsSummaryResponseDto> {
    return this.generatedApi.analyticsGetSummary<AnalyticsSummaryResponseDto>(
      buildAnalyticsParams(query) as AnalyticsGetSummaryParams
    );
  }

  getAnalyticsOccupancy(
    query: AnalyticsBaseQueryDto
  ): Observable<AnalyticsOccupancyResponseDto> {
    return this.generatedApi.analyticsGetOccupancy<AnalyticsOccupancyResponseDto>(
      buildAnalyticsParams(query) as AnalyticsGetOccupancyParams
    );
  }

  getAnalyticsRevenue(
    query: AnalyticsBaseQueryDto & { groupBy: AnalyticsGroupBy }
  ): Observable<AnalyticsRevenueResponseDto> {
    return this.generatedApi.analyticsGetRevenue<AnalyticsRevenueResponseDto>(
      buildAnalyticsParams(query) as AnalyticsGetRevenueParams
    );
  }

  getAnalyticsPeakHours(
    query: AnalyticsBaseQueryDto
  ): Observable<AnalyticsPeakHoursResponseDto> {
    return this.generatedApi.analyticsGetPeakHours<AnalyticsPeakHoursResponseDto>(
      buildAnalyticsParams(query) as AnalyticsGetPeakHoursParams
    );
  }
}
