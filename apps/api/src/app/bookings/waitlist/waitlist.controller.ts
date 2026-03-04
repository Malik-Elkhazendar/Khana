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

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({
  path: 'bookings/waitlist',
  version: '1',
})
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  @Post()
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  @HttpCode(HttpStatus.CREATED)
  joinWaitlist(
    @Body() dto: JoinWaitlistDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: User
  ): Promise<JoinWaitlistResponseDto> {
    return this.waitlistService.joinWaitlist(dto, tenantId, user);
  }

  @Get('status')
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
  getWaitlistStatus(
    @Query() query: WaitlistStatusQueryDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: User
  ): Promise<WaitlistStatusResponseDto> {
    return this.waitlistService.getStatus(query, tenantId, user);
  }

  @Get()
  @Roles(UserRole.OWNER, UserRole.MANAGER, UserRole.STAFF)
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
  expireEntry(
    @Param('entryId', new ParseUUIDPipe()) entryId: string,
    @TenantId() tenantId: string,
    @CurrentUser() user: User
  ): Promise<ExpireWaitlistEntryResponseDto> {
    return this.waitlistService.expireEntry(entryId, tenantId, user);
  }
}
