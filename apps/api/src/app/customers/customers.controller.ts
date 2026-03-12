import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { User } from '@khana/data-access';
import { CustomerSummaryDto, UserRole } from '@khana/shared-dtos';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { TenantId } from '../auth/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpdateCustomerTagsDto } from './dto';
import { CustomersService } from './customers.service';
import {
  ApiJwtAuth,
  ApiStandardErrorResponses,
  ApiUuidParam,
} from '../swagger/swagger.decorators';
import { CustomerSummaryDoc } from './swagger/customers-doc.models';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({
  path: 'customers',
  version: '1',
})
@ApiTags('Customers')
@ApiJwtAuth()
@ApiExtraModels(CustomerSummaryDoc)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get('lookup')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({
    summary: 'Lookup a customer by phone number',
  })
  @ApiQuery({
    name: 'phone',
    required: true,
    description: 'Customer phone number to normalize and search.',
  })
  @ApiOkResponse({
    description: 'Customer summary for the provided phone number, or null.',
    schema: {
      type: 'object',
      nullable: true,
      allOf: [{ $ref: getSchemaPath(CustomerSummaryDoc) }],
    },
  })
  @ApiStandardErrorResponses(401, 403)
  async lookupByPhone(
    @TenantId() tenantId: string,
    @CurrentUser() _user: User,
    @Query('phone') phone?: string
  ): Promise<CustomerSummaryDto | null> {
    void _user;
    if (!phone?.trim()) {
      return null;
    }

    const customer = await this.customersService.lookupByPhone(tenantId, phone);
    return customer ? await this.customersService.toSummaryDto(customer) : null;
  }

  @Patch(':id/tags')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update customer tags',
  })
  @ApiUuidParam('id', 'Customer identifier whose tags will be updated.')
  @ApiOkResponse({
    description: 'Updated customer summary with the new tenant tags.',
    type: CustomerSummaryDoc,
  })
  @ApiStandardErrorResponses(400, 401, 403, 404)
  async updateCustomerTags(
    @TenantId() tenantId: string,
    @CurrentUser() _user: User,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateCustomerTagsDto
  ): Promise<CustomerSummaryDto> {
    void _user;
    const customer = await this.customersService.updateTags(
      tenantId,
      id,
      dto.tags
    );
    return this.customersService.toSummaryDto(customer);
  }

  @Get('tags')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({
    summary: 'List tenant customer tags',
  })
  @ApiOkResponse({
    description: 'Distinct customer tags configured for the current tenant.',
  })
  @ApiStandardErrorResponses(401, 403)
  getTenantTags(
    @TenantId() tenantId: string,
    @CurrentUser() _user: User
  ): Promise<string[]> {
    void _user;
    return this.customersService.getTenantTags(tenantId);
  }
}
