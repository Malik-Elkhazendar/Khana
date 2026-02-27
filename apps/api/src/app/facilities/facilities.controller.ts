import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { FacilityManagementItemDto, UserRole } from '@khana/shared-dtos';
import { User } from '@khana/data-access';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { TenantId } from '../auth/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateFacilityDto, UpdateFacilityDto } from './dto';
import { FacilitiesService } from './facilities.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({
  path: 'facilities',
  version: '1',
})
export class FacilitiesController {
  constructor(private readonly facilitiesService: FacilitiesService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  findAll(
    @TenantId() tenantId: string,
    @CurrentUser() user: User,
    @Query('includeInactive') includeInactive?: string
  ): Promise<FacilityManagementItemDto[]> {
    const shouldIncludeInactive =
      typeof includeInactive === 'string' &&
      includeInactive.toLowerCase() === 'true';

    return this.facilitiesService.listFacilities(
      tenantId,
      user,
      shouldIncludeInactive
    );
  }

  @Get(':id')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  findOne(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: User
  ): Promise<FacilityManagementItemDto> {
    return this.facilitiesService.getFacilityById(id, tenantId, user);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() dto: CreateFacilityDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: User,
    @Ip() ipAddress?: string,
    @Headers('user-agent') userAgent?: string
  ): Promise<FacilityManagementItemDto> {
    return this.facilitiesService.createFacility(
      dto,
      tenantId,
      user,
      ipAddress,
      userAgent
    );
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  update(
    @Param('id') id: string,
    @Body() dto: UpdateFacilityDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: User,
    @Ip() ipAddress?: string,
    @Headers('user-agent') userAgent?: string
  ): Promise<FacilityManagementItemDto> {
    return this.facilitiesService.updateFacility(
      id,
      dto,
      tenantId,
      user,
      ipAddress,
      userAgent
    );
  }

  @Delete(':id')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  deactivate(
    @Param('id') id: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: User,
    @Ip() ipAddress?: string,
    @Headers('user-agent') userAgent?: string
  ): Promise<FacilityManagementItemDto> {
    return this.facilitiesService.deactivateFacility(
      id,
      tenantId,
      user,
      ipAddress,
      userAgent
    );
  }
}
