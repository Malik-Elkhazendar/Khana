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
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { User } from '@khana/data-access';
import {
  GoalSettingsResponseDto,
  TenantSettingsResponseDto,
  UserRole,
} from '@khana/shared-dtos';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { TenantId } from '../auth/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpdateGoalsDto, UpdateSettingsDto } from './dto';
import { SettingsService } from './settings.service';
import {
  ApiJwtAuth,
  ApiStandardErrorResponses,
} from '../swagger/swagger.decorators';
import {
  GoalSettingsResponseDoc,
  TenantSettingsResponseDoc,
} from './swagger/settings-doc.models';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({
  path: 'settings',
  version: '1',
})
@ApiTags('Settings')
@ApiJwtAuth()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get tenant settings',
  })
  @ApiOkResponse({
    description: 'Current tenant settings payload.',
    type: TenantSettingsResponseDoc,
  })
  @ApiStandardErrorResponses(401, 403)
  getSettings(
    @TenantId() tenantId: string
  ): Promise<TenantSettingsResponseDto> {
    return this.settingsService.getSettings(tenantId);
  }

  @Patch()
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update tenant settings',
  })
  @ApiOkResponse({
    description: 'Updated tenant settings payload.',
    type: TenantSettingsResponseDoc,
  })
  @ApiStandardErrorResponses(400, 401, 403, 409)
  updateSettings(
    @Body() dto: UpdateSettingsDto,
    @TenantId() tenantId: string
  ): Promise<TenantSettingsResponseDto> {
    return this.settingsService.updateSettings(tenantId, dto);
  }

  @Get('goals')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get tenant goal settings',
  })
  @ApiOkResponse({
    description: 'Current goal settings for the tenant.',
    type: GoalSettingsResponseDoc,
  })
  @ApiStandardErrorResponses(401, 403)
  getGoals(@TenantId() tenantId: string): Promise<GoalSettingsResponseDto> {
    return this.settingsService.getGoals(tenantId);
  }

  @Patch('goals')
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update tenant goal settings',
  })
  @ApiOkResponse({
    description: 'Updated goal settings for the tenant.',
    type: GoalSettingsResponseDoc,
  })
  @ApiStandardErrorResponses(400, 401, 403, 409)
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
