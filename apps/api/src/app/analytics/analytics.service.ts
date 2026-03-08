import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Tenant } from '@khana/data-access';
import {
  AnalyticsOccupancyResponseDto,
  AnalyticsPeakHoursResponseDto,
  AnalyticsRevenueResponseDto,
  AnalyticsSummaryResponseDto,
} from '@khana/shared-dtos';
import { DataSource, Repository } from 'typeorm';
import { AppLoggerService } from '../logging';
import { GoalsService } from '../goals/goals.service';
import { AnalyticsQueryDto, RevenueQueryDto } from './dto';
import { getAnalyticsOccupancy } from './internal/analytics-occupancy.query';
import { AnalyticsDependencies } from './internal/analytics.internal';
import { getAnalyticsPeakHours } from './internal/analytics-peak-hours.query';
import { getAnalyticsRevenue } from './internal/analytics-revenue.query';
import { getAnalyticsSummary } from './internal/analytics-summary.query';

@Injectable()
export class AnalyticsService {
  private readonly deps: AnalyticsDependencies;

  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    private readonly dataSource: DataSource,
    private readonly appLogger: AppLoggerService,
    private readonly goalsService: GoalsService
  ) {
    this.deps = {
      tenantRepository,
      dataSource,
      appLogger,
      goalsService,
    };
  }

  async getSummary(
    query: AnalyticsQueryDto,
    tenantId: string
  ): Promise<AnalyticsSummaryResponseDto> {
    return getAnalyticsSummary(this.deps, query, tenantId);
  }

  async getOccupancy(
    query: AnalyticsQueryDto,
    tenantId: string
  ): Promise<AnalyticsOccupancyResponseDto> {
    return getAnalyticsOccupancy(this.deps, query, tenantId);
  }

  async getRevenue(
    query: RevenueQueryDto,
    tenantId: string
  ): Promise<AnalyticsRevenueResponseDto> {
    return getAnalyticsRevenue(this.deps, query, tenantId);
  }

  async getPeakHours(
    query: AnalyticsQueryDto,
    tenantId: string
  ): Promise<AnalyticsPeakHoursResponseDto> {
    return getAnalyticsPeakHours(this.deps, query, tenantId);
  }
}
