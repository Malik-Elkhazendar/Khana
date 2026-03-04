import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  AnalyticsOccupancyResponseDto,
  AnalyticsPeakHoursResponseDto,
  AnalyticsRevenueResponseDto,
  AnalyticsSummaryResponseDto,
  UserRole,
} from '@khana/shared-dtos';
import { TenantId } from '../auth/decorators/tenant-id.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AnalyticsService } from './analytics.service';
import { AnalyticsQueryDto, RevenueQueryDto } from './dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({
  path: 'analytics',
  version: '1',
})
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.VIEWER)
  getSummary(
    @Query() query: AnalyticsQueryDto,
    @TenantId() tenantId: string
  ): Promise<AnalyticsSummaryResponseDto> {
    return this.analyticsService.getSummary(query, tenantId);
  }

  @Get('occupancy')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.VIEWER)
  getOccupancy(
    @Query() query: AnalyticsQueryDto,
    @TenantId() tenantId: string
  ): Promise<AnalyticsOccupancyResponseDto> {
    return this.analyticsService.getOccupancy(query, tenantId);
  }

  @Get('revenue')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.VIEWER)
  getRevenue(
    @Query() query: RevenueQueryDto,
    @TenantId() tenantId: string
  ): Promise<AnalyticsRevenueResponseDto> {
    return this.analyticsService.getRevenue(query, tenantId);
  }

  @Get('peak-hours')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.VIEWER)
  getPeakHours(
    @Query() query: AnalyticsQueryDto,
    @TenantId() tenantId: string
  ): Promise<AnalyticsPeakHoursResponseDto> {
    return this.analyticsService.getPeakHours(query, tenantId);
  }
}
