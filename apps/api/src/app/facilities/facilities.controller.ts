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
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FacilityManagementItemDto, UserRole } from '@khana/shared-dtos';
import { User } from '@khana/data-access';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { TenantId } from '../auth/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateFacilityDto, UpdateFacilityDto } from './dto';
import { FacilitiesService } from './facilities.service';
import {
  ApiExampleArrayOkResponse,
  ApiExampleCreatedResponse,
  ApiExampleOkResponse,
  ApiExampleRequestBody,
  ApiJwtAuth,
  ApiStandardErrorResponses,
  ApiUuidParam,
} from '../swagger/swagger.decorators';
import { FacilityManagementItemDoc } from './swagger/facility-doc.models';
import {
  SWAGGER_CREATE_FACILITY_REQUEST_EXAMPLE,
  SWAGGER_FACILITY_ITEM_EXAMPLE,
  SWAGGER_UPDATE_FACILITY_REQUEST_EXAMPLE,
} from '../swagger/swagger.examples';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({
  path: 'facilities',
  version: '1',
})
@ApiTags('Facilities')
@ApiJwtAuth()
export class FacilitiesController {
  constructor(private readonly facilitiesService: FacilitiesService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({
    summary: 'List facilities for the current tenant',
  })
  @ApiQuery({
    name: 'includeInactive',
    required: false,
    description: 'When true, include inactive facilities in the result.',
    example: 'true',
  })
  @ApiExampleArrayOkResponse(
    FacilityManagementItemDoc,
    'Facility management list for the current tenant.',
    [SWAGGER_FACILITY_ITEM_EXAMPLE]
  )
  @ApiStandardErrorResponses(401, 403)
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
  @ApiOperation({
    summary: 'Get a facility by id',
  })
  @ApiUuidParam('id', 'Facility identifier to fetch.')
  @ApiExampleOkResponse(
    FacilityManagementItemDoc,
    'Single facility for the current tenant.',
    SWAGGER_FACILITY_ITEM_EXAMPLE
  )
  @ApiStandardErrorResponses(401, 403, 404)
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
  @ApiOperation({
    summary: 'Create a facility',
  })
  @ApiExampleRequestBody(
    CreateFacilityDto,
    'Facility creation payload with pricing and operating hours.',
    SWAGGER_CREATE_FACILITY_REQUEST_EXAMPLE
  )
  @ApiExampleCreatedResponse(
    FacilityManagementItemDoc,
    'Facility created successfully.',
    SWAGGER_FACILITY_ITEM_EXAMPLE
  )
  @ApiStandardErrorResponses(400, 401, 403, 409)
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
  @ApiOperation({
    summary: 'Update a facility',
  })
  @ApiUuidParam('id', 'Facility identifier to update.')
  @ApiExampleRequestBody(
    UpdateFacilityDto,
    'Facility update payload with optional active-state changes.',
    SWAGGER_UPDATE_FACILITY_REQUEST_EXAMPLE
  )
  @ApiExampleOkResponse(
    FacilityManagementItemDoc,
    'Facility updated successfully.',
    {
      ...SWAGGER_FACILITY_ITEM_EXAMPLE,
      name: 'Court 1 - VIP',
      config: {
        pricePerHour: 200,
        openTime: '09:00',
        closeTime: '22:00',
      },
      updatedAt: '2030-06-12T09:30:00.000Z',
    }
  )
  @ApiStandardErrorResponses(400, 401, 403, 404, 409)
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
  @ApiOperation({
    summary: 'Deactivate a facility',
  })
  @ApiUuidParam('id', 'Facility identifier to deactivate.')
  @ApiExampleOkResponse(
    FacilityManagementItemDoc,
    'Facility deactivated successfully.',
    {
      ...SWAGGER_FACILITY_ITEM_EXAMPLE,
      isActive: false,
      updatedAt: '2030-06-12T09:45:00.000Z',
    }
  )
  @ApiStandardErrorResponses(401, 403, 404, 409)
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
