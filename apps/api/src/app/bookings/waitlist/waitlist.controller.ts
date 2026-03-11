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
  ExpireWaitlistEntryResponseDto,
  JoinWaitlistResponseDto,
  NotifyNextWaitlistResponseDto,
  UserRole,
  WaitlistListResponseDto,
  WaitlistStatusResponseDto,
} from '@khana/shared-dtos';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { Roles } from '../../auth/decorators/roles.decorator';
import { TenantId } from '../../auth/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import {
  JoinWaitlistDto,
  NotifyNextWaitlistDto,
  WaitlistListQueryDto,
  WaitlistStatusQueryDto,
} from './dto';
import { WaitlistService } from './waitlist.service';
import {
  ApiJwtAuth,
  ApiStandardErrorResponses,
  ApiUuidParam,
} from '../../swagger/swagger.decorators';
import {
  ExpireWaitlistEntryResponseDoc,
  JoinWaitlistResponseDoc,
  NotifyNextWaitlistResponseDoc,
  WaitlistListResponseDoc,
  WaitlistStatusResponseDoc,
} from './swagger/waitlist-doc.models';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({
  path: 'bookings/waitlist',
  version: '1',
})
@ApiTags('Waitlist')
@ApiJwtAuth()
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Post()
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Join the waitlist for a booking slot',
  })
  @ApiCreatedResponse({
    description: 'Waitlist entry created successfully.',
    type: JoinWaitlistResponseDoc,
  })
  @ApiStandardErrorResponses(400, 401, 403, 409)
  joinWaitlist(
    @Body() dto: JoinWaitlistDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: User
  ): Promise<JoinWaitlistResponseDto> {
    return this.waitlistService.joinWaitlist(dto, tenantId, user);
  }

  @Get('status')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({
    summary: 'Get waitlist status for a slot',
  })
  @ApiOkResponse({
    description:
      'Waitlist status and current eligibility for the requested slot.',
    type: WaitlistStatusResponseDoc,
  })
  @ApiStandardErrorResponses(400, 401, 403, 404)
  getWaitlistStatus(
    @Query() query: WaitlistStatusQueryDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: User
  ): Promise<WaitlistStatusResponseDto> {
    return this.waitlistService.getStatus(query, tenantId, user);
  }

  @Get()
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @ApiOperation({
    summary: 'List waitlist entries',
  })
  @ApiOkResponse({
    description: 'Waitlist entries visible to the current staff member.',
    type: WaitlistListResponseDoc,
  })
  @ApiStandardErrorResponses(400, 401, 403)
  listWaitlistEntries(
    @Query() query: WaitlistListQueryDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: User
  ): Promise<WaitlistListResponseDto> {
    return this.waitlistService.listEntries(query, tenantId, user);
  }

  @Post('notify-next')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Notify the next waitlist entry for a slot',
  })
  @ApiOkResponse({
    description: 'Next eligible waitlist entry was notified.',
    type: NotifyNextWaitlistResponseDoc,
  })
  @ApiStandardErrorResponses(400, 401, 403, 404, 409)
  notifyNext(
    @Body() dto: NotifyNextWaitlistDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: User
  ): Promise<NotifyNextWaitlistResponseDto> {
    return this.waitlistService.notifyNextForSlot(dto, tenantId, user);
  }

  @Patch(':entryId/expire')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Expire a waitlist entry',
  })
  @ApiUuidParam('entryId', 'Waitlist entry identifier to expire.')
  @ApiOkResponse({
    description: 'Waitlist entry expired successfully.',
    type: ExpireWaitlistEntryResponseDoc,
  })
  @ApiStandardErrorResponses(401, 403, 404)
  expireEntry(
    @Param('entryId', new ParseUUIDPipe()) entryId: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: User
  ): Promise<ExpireWaitlistEntryResponseDto> {
    return this.waitlistService.expireEntry(entryId, tenantId, user);
  }
}
