import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Ip,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { InviteUserResponseDto, UserDto, UserRole } from '@khana/shared-dtos';
import { User } from '@khana/data-access';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { TenantId } from '../auth/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { InviteUserDto, UpdateUserRoleDto, UpdateUserStatusDto } from './dto';
import { UsersService } from './users.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({
  path: 'users',
  version: '1',
})
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  findAll(
    @TenantId() tenantId: string,
    @CurrentUser() user: User
  ): Promise<UserDto[]> {
    return this.usersService.listUsers(tenantId, user);
  }

  @Patch(':id/role')
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.OK)
  updateRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: User,
    @Ip() ipAddress?: string,
    @Headers('user-agent') userAgent?: string
  ): Promise<UserDto> {
    return this.usersService.updateUserRole(
      id,
      dto,
      tenantId,
      user,
      ipAddress,
      userAgent
    );
  }

  @Patch(':id/status')
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.OK)
  updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: User,
    @Ip() ipAddress?: string,
    @Headers('user-agent') userAgent?: string
  ): Promise<UserDto> {
    return this.usersService.updateUserStatus(
      id,
      dto,
      tenantId,
      user,
      ipAddress,
      userAgent
    );
  }

  @Post('invite')
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.CREATED)
  invite(
    @Body() dto: InviteUserDto,
    @TenantId() tenantId: string,
    @CurrentUser() user: User,
    @Ip() ipAddress?: string,
    @Headers('user-agent') userAgent?: string
  ): Promise<InviteUserResponseDto> {
    return this.usersService.inviteUser(
      dto,
      tenantId,
      user,
      ipAddress,
      userAgent
    );
  }
}
