import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { User } from '@khana/data-access';
import { TodaySnapshotDto, UserRole } from '@khana/shared-dtos';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { TenantId } from '../auth/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DashboardService } from './dashboard.service';
import {
  ApiExampleOkResponse,
  ApiJwtAuth,
  ApiStandardErrorResponses,
} from '../swagger/swagger.decorators';
import { TodaySnapshotDoc } from './swagger/dashboard-doc.models';
import { SWAGGER_DASHBOARD_SNAPSHOT_RESPONSE_EXAMPLE } from '../swagger/swagger.examples';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({
  path: 'dashboard',
  version: '1',
})
@ApiTags('Dashboard')
@ApiJwtAuth()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('today-snapshot')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'Get the today snapshot used by the dashboard',
  })
  @ApiQuery({
    name: 'facilityId',
    required: false,
    description: 'Optional facility filter for the dashboard snapshot.',
    example: '33333333-3333-4333-8333-333333333333',
  })
  @ApiExampleOkResponse(
    TodaySnapshotDoc,
    'Dashboard today snapshot for the tenant and optional facility.',
    SWAGGER_DASHBOARD_SNAPSHOT_RESPONSE_EXAMPLE
  )
  @ApiStandardErrorResponses(401, 403)
  getTodaySnapshot(
    @TenantId() tenantId: string,
    @CurrentUser() _user: User,
    @Query('facilityId') facilityId?: string
  ): Promise<TodaySnapshotDto> {
    return this.dashboardService.getTodaySnapshot(tenantId, facilityId);
  }
}
