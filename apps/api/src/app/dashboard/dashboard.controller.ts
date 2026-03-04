import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { User } from '@khana/data-access';
import { TodaySnapshotDto, UserRole } from '@khana/shared-dtos';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { TenantId } from '../auth/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { DashboardService } from './dashboard.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({
  path: 'dashboard',
  version: '1',
})
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('today-snapshot')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  getTodaySnapshot(
    @TenantId() tenantId: string,
    @CurrentUser() _user: User,
    @Query('facilityId') facilityId?: string
  ): Promise<TodaySnapshotDto> {
    return this.dashboardService.getTodaySnapshot(tenantId, facilityId);
  }
}
