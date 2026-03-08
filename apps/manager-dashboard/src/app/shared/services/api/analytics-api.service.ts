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
import { ApiRequestService } from './api-request.service';

@Injectable({ providedIn: 'root' })
export class AnalyticsApiService {
  private readonly api = inject(ApiRequestService);

  getAnalyticsSummary(
    query: AnalyticsBaseQueryDto
  ): Observable<AnalyticsSummaryResponseDto> {
    return this.api.get('/v1/analytics/summary', 'load analytics summary', {
      params: buildAnalyticsParams(query),
    });
  }

  getAnalyticsOccupancy(
    query: AnalyticsBaseQueryDto
  ): Observable<AnalyticsOccupancyResponseDto> {
    return this.api.get('/v1/analytics/occupancy', 'load analytics occupancy', {
      params: buildAnalyticsParams(query),
    });
  }

  getAnalyticsRevenue(
    query: AnalyticsBaseQueryDto & { groupBy: AnalyticsGroupBy }
  ): Observable<AnalyticsRevenueResponseDto> {
    return this.api.get('/v1/analytics/revenue', 'load analytics revenue', {
      params: buildAnalyticsParams(query),
    });
  }

  getAnalyticsPeakHours(
    query: AnalyticsBaseQueryDto
  ): Observable<AnalyticsPeakHoursResponseDto> {
    return this.api.get(
      '/v1/analytics/peak-hours',
      'load analytics peak hours',
      {
        params: buildAnalyticsParams(query),
      }
    );
  }
}
