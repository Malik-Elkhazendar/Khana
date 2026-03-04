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
import { User } from '@khana/data-access';
import { CustomerSummaryDto, UserRole } from '@khana/shared-dtos';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { TenantId } from '../auth/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UpdateCustomerTagsDto } from './dto';
import { CustomersService } from './customers.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({
  path: 'customers',
  version: '1',
})
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get('lookup')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
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
  getTenantTags(
    @TenantId() tenantId: string,
    @CurrentUser() _user: User
  ): Promise<string[]> {
    void _user;
    return this.customersService.getTenantTags(tenantId);
  }
}
