import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
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
import {
  ApiExampleOkResponse,
  ApiJwtAuth,
  ApiStandardErrorResponses,
} from '../swagger/swagger.decorators';
import {
  AnalyticsOccupancyResponseDoc,
  AnalyticsPeakHoursResponseDoc,
  AnalyticsRevenueResponseDoc,
  AnalyticsSummaryResponseDoc,
} from './swagger/analytics-doc.models';
import {
  SWAGGER_ANALYTICS_OCCUPANCY_RESPONSE_EXAMPLE,
  SWAGGER_ANALYTICS_PEAK_HOURS_RESPONSE_EXAMPLE,
  SWAGGER_ANALYTICS_REVENUE_RESPONSE_EXAMPLE,
  SWAGGER_ANALYTICS_SUMMARY_RESPONSE_EXAMPLE,
} from '../swagger/swagger.examples';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({
  path: 'analytics',
  version: '1',
})
@ApiTags('Analytics')
@ApiJwtAuth()
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('summary')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.VIEWER)
  @ApiOperation({
    summary: 'Get analytics summary metrics',
  })
  @ApiExampleOkResponse(
    AnalyticsSummaryResponseDoc,
    'Summary analytics for the requested date range and facility scope.',
    SWAGGER_ANALYTICS_SUMMARY_RESPONSE_EXAMPLE
  )
  @ApiStandardErrorResponses(400, 401, 403)
  getSummary(
    @Query() query: AnalyticsQueryDto,
    @TenantId() tenantId: string
  ): Promise<AnalyticsSummaryResponseDto> {
    return this.analyticsService.getSummary(query, tenantId);
  }

  @Get('occupancy')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.VIEWER)
  @ApiOperation({
    summary: 'Get occupancy analytics',
  })
  @ApiExampleOkResponse(
    AnalyticsOccupancyResponseDoc,
    'Occupancy analytics for the requested date range and facility scope.',
    SWAGGER_ANALYTICS_OCCUPANCY_RESPONSE_EXAMPLE
  )
  @ApiStandardErrorResponses(400, 401, 403)
  getOccupancy(
    @Query() query: AnalyticsQueryDto,
    @TenantId() tenantId: string
  ): Promise<AnalyticsOccupancyResponseDto> {
    return this.analyticsService.getOccupancy(query, tenantId);
  }

  @Get('revenue')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.VIEWER)
  @ApiOperation({
    summary: 'Get revenue analytics',
  })
  @ApiExampleOkResponse(
    AnalyticsRevenueResponseDoc,
    'Revenue analytics for the requested date range and facility scope.',
    SWAGGER_ANALYTICS_REVENUE_RESPONSE_EXAMPLE
  )
  @ApiStandardErrorResponses(400, 401, 403)
  getRevenue(
    @Query() query: RevenueQueryDto,
    @TenantId() tenantId: string
  ): Promise<AnalyticsRevenueResponseDto> {
    return this.analyticsService.getRevenue(query, tenantId);
  }

  @Get('peak-hours')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.VIEWER)
  @ApiOperation({
    summary: 'Get peak-hours analytics',
  })
  @ApiExampleOkResponse(
    AnalyticsPeakHoursResponseDoc,
    'Peak-hour analytics for the requested date range and facility scope.',
    SWAGGER_ANALYTICS_PEAK_HOURS_RESPONSE_EXAMPLE
  )
  @ApiStandardErrorResponses(400, 401, 403)
  getPeakHours(
    @Query() query: AnalyticsQueryDto,
    @TenantId() tenantId: string
  ): Promise<AnalyticsPeakHoursResponseDto> {
    return this.analyticsService.getPeakHours(query, tenantId);
  }
}
