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
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { InviteUserResponseDto, UserDto, UserRole } from '@khana/shared-dtos';
import { User } from '@khana/data-access';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { TenantId } from '../auth/decorators/tenant-id.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { InviteUserDto, UpdateUserRoleDto, UpdateUserStatusDto } from './dto';
import { UsersService } from './users.service';
import {
  ApiJwtAuth,
  ApiStandardErrorResponses,
  ApiUuidParam,
} from '../swagger/swagger.decorators';
import { InviteUserResponseDoc, UserDoc } from './swagger/users-doc.models';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller({
  path: 'users',
  version: '1',
})
@ApiTags('Users')
@ApiJwtAuth()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  @ApiOperation({
    summary: 'List tenant users',
  })
  @ApiOkResponse({
    description: 'Users visible to the current owner or manager.',
    type: UserDoc,
    isArray: true,
  })
  @ApiStandardErrorResponses(401, 403)
  findAll(
    @TenantId() tenantId: string,
    @CurrentUser() user: User
  ): Promise<UserDto[]> {
    return this.usersService.listUsers(tenantId, user);
  }

  @Patch(':id/role')
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update a user role',
  })
  @ApiUuidParam('id', 'User identifier whose role will be updated.')
  @ApiOkResponse({
    description: 'Updated user with the new role.',
    type: UserDoc,
  })
  @ApiStandardErrorResponses(400, 401, 403, 404, 409)
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
  @ApiOperation({
    summary: 'Update a user active status',
  })
  @ApiUuidParam('id', 'User identifier whose status will be updated.')
  @ApiOkResponse({
    description: 'Updated user with the new active status.',
    type: UserDoc,
  })
  @ApiStandardErrorResponses(400, 401, 403, 404, 409)
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
  @ApiOperation({
    summary: 'Invite a user to the current tenant',
  })
  @ApiCreatedResponse({
    description: 'Invitation created and invitation response returned.',
    type: InviteUserResponseDoc,
  })
  @ApiStandardErrorResponses(400, 401, 403, 409)
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
