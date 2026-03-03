import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { User } from '@khana/data-access';
import {
  PromoCodeItemDto,
  PromoCodeListResponseDto,
  UserRole,
} from '@khana/shared-dtos';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { TenantId } from '../auth/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CreatePromoCodeDto,
  ListPromoCodesQueryDto,
  UpdatePromoCodeDto,
} from './dto';
import { PromoCodesService } from './promo-codes.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({
  path: 'promo-codes',
  version: '1',
})
export class PromoCodesController {
  constructor(private readonly promoCodesService: PromoCodesService) {}

  @Post()
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  createPromoCode(
    @Body() dto: CreatePromoCodeDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: User
  ): Promise<PromoCodeItemDto> {
    return this.promoCodesService.createPromoCode(dto, tenantId, user);
  }

  @Get()
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  listPromoCodes(
    @Query() query: ListPromoCodesQueryDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: User
  ): Promise<PromoCodeListResponseDto> {
    return this.promoCodesService.listPromoCodes(query, tenantId, user);
  }

  @Patch(':id')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  updatePromoCode(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePromoCodeDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: User
  ): Promise<PromoCodeItemDto> {
    return this.promoCodesService.updatePromoCode(id, dto, tenantId, user);
  }
}
