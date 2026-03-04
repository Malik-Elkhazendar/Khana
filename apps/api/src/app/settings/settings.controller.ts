import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { User } from '@khana/data-access';
import { GoalSettingsResponseDto, UserRole } from '@khana/shared-dtos';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { TenantId } from '../auth/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpdateGoalsDto } from './dto';
import { SettingsService } from './settings.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({
  path: 'settings',
  version: '1',
})
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('goals')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  getGoals(@TenantId() tenantId: string): Promise<GoalSettingsResponseDto> {
    return this.settingsService.getGoals(tenantId);
  }

  @Patch('goals')
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.OK)
  updateGoals(
    @Body() dto: UpdateGoalsDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: User,
    @Ip() ipAddress?: string,
    @Headers('user-agent') userAgent?: string
  ): Promise<GoalSettingsResponseDto> {
    return this.settingsService.updateGoals(
      tenantId,
      dto,
      user,
      ipAddress,
      userAgent
    );
  }
}
