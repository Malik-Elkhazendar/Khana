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
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
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
import {
  ApiJwtAuth,
  ApiStandardErrorResponses,
  ApiUuidParam,
} from '../swagger/swagger.decorators';
import {
  PromoCodeItemDoc,
  PromoCodeListResponseDoc,
} from './swagger/promo-codes-doc.models';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({
  path: 'promo-codes',
  version: '1',
})
@ApiTags('Promo Codes')
@ApiJwtAuth()
export class PromoCodesController {
  constructor(private readonly promoCodesService: PromoCodesService) {}

  @Post()
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a promo code',
  })
  @ApiCreatedResponse({
    description: 'Promo code created successfully.',
    type: PromoCodeItemDoc,
  })
  @ApiStandardErrorResponses(400, 401, 403, 409)
  createPromoCode(
    @Body() dto: CreatePromoCodeDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: User
  ): Promise<PromoCodeItemDto> {
    return this.promoCodesService.createPromoCode(dto, tenantId, user);
  }

  @Get()
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'List promo codes',
  })
  @ApiOkResponse({
    description: 'Paginated promo code list for the current tenant.',
    type: PromoCodeListResponseDoc,
  })
  @ApiStandardErrorResponses(400, 401, 403)
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
  @ApiOperation({
    summary: 'Update a promo code',
  })
  @ApiUuidParam('id', 'Promo code identifier to update.')
  @ApiOkResponse({
    description: 'Promo code updated successfully.',
    type: PromoCodeItemDoc,
  })
  @ApiStandardErrorResponses(400, 401, 403, 404, 409)
  updatePromoCode(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePromoCodeDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: User
  ): Promise<PromoCodeItemDto> {
    return this.promoCodesService.updatePromoCode(id, dto, tenantId, user);
  }
}
