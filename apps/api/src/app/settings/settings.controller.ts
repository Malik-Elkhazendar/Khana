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
import { ApiExtraModels, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  ApiExampleOkResponse,
  ApiExampleRequestBody,
  ApiJwtAuth,
  ApiStandardErrorResponses,
} from '../swagger/swagger.decorators';
import {
  GoalSettingsResponseDoc,
  NotificationPreferencesDoc,
  TenantSettingsResponseDoc,
} from './swagger/settings-doc.models';
import {
  SWAGGER_GOAL_SETTINGS_RESPONSE_EXAMPLE,
  SWAGGER_TENANT_SETTINGS_RESPONSE_EXAMPLE,
  SWAGGER_UPDATE_GOALS_REQUEST_EXAMPLE,
  SWAGGER_UPDATE_SETTINGS_REQUEST_EXAMPLE,
} from '../swagger/swagger.examples';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({
  path: 'settings',
  version: '1',
})
@ApiTags('Settings')
@ApiJwtAuth()
@ApiExtraModels(NotificationPreferencesDoc)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get tenant settings',
  })
  @ApiExampleOkResponse(
    TenantSettingsResponseDoc,
    'Current tenant settings payload.',
    SWAGGER_TENANT_SETTINGS_RESPONSE_EXAMPLE
  )
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
  @ApiExampleRequestBody(
    UpdateSettingsDto,
    'Tenant settings update payload including nested notification preferences.',
    SWAGGER_UPDATE_SETTINGS_REQUEST_EXAMPLE
  )
  @ApiExampleOkResponse(
    TenantSettingsResponseDoc,
    'Updated tenant settings payload.',
    SWAGGER_TENANT_SETTINGS_RESPONSE_EXAMPLE
  )
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
  @ApiExampleOkResponse(
    GoalSettingsResponseDoc,
    'Current goal settings for the tenant.',
    SWAGGER_GOAL_SETTINGS_RESPONSE_EXAMPLE
  )
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
  @ApiExampleRequestBody(
    UpdateGoalsDto,
    'Goal configuration payload for dashboard nudges and monthly targets.',
    SWAGGER_UPDATE_GOALS_REQUEST_EXAMPLE
  )
  @ApiExampleOkResponse(
    GoalSettingsResponseDoc,
    'Updated goal settings for the tenant.',
    SWAGGER_GOAL_SETTINGS_RESPONSE_EXAMPLE
  )
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
