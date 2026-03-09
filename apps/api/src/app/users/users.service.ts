import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  AuditLog,
  PasswordResetToken,
  RefreshToken,
  User,
} from '@khana/data-access';
import { InviteUserResponseDto, UserDto } from '@khana/shared-dtos';
import { EmailService } from '@khana/notifications';
import { Repository } from 'typeorm';
import { AppLoggerService } from '../logging';
import { PasswordService } from '../auth/services/password.service';
import { InviteUserDto, UpdateUserRoleDto, UpdateUserStatusDto } from './dto';
import { Actor, UsersDependencies } from './internal/users.internal';
import {
  inviteUserWorkflow,
  updateUserRoleWorkflow,
  updateUserStatusWorkflow,
} from './internal/users.mutation';
import { listUsersWorkflow } from './internal/users.query';

@Injectable()
export class UsersService {
  private readonly deps: UsersDependencies;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    @InjectRepository(PasswordResetToken)
    private readonly passwordResetTokenRepository: Repository<PasswordResetToken>,
    private readonly passwordService: PasswordService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly appLogger: AppLoggerService
  ) {
    this.deps = {
      userRepository,
      auditLogRepository,
      refreshTokenRepository,
      passwordResetTokenRepository,
      passwordService,
      emailService,
      configService,
      appLogger,
    };
  }

  async listUsers(tenantId: string, actor: Actor): Promise<UserDto[]> {
    return listUsersWorkflow(this.deps, tenantId, actor);
  }

  async updateUserRole(
    id: string,
    dto: UpdateUserRoleDto,
    tenantId: string,
    actor: Actor,
    ipAddress?: string,
    userAgent?: string
  ): Promise<UserDto> {
    return updateUserRoleWorkflow(
      this.deps,
      id,
      dto,
      tenantId,
      actor,
      ipAddress,
      userAgent
    );
  }

  async updateUserStatus(
    id: string,
    dto: UpdateUserStatusDto,
    tenantId: string,
    actor: Actor,
    ipAddress?: string,
    userAgent?: string
  ): Promise<UserDto> {
    return updateUserStatusWorkflow(
      this.deps,
      id,
      dto,
      tenantId,
      actor,
      ipAddress,
      userAgent
    );
  }

  async inviteUser(
    dto: InviteUserDto,
    tenantId: string,
    actor: Actor,
    ipAddress?: string,
    userAgent?: string
  ): Promise<InviteUserResponseDto> {
    return inviteUserWorkflow(
      this.deps,
      dto,
      tenantId,
      actor,
      ipAddress,
      userAgent
    );
  }
}
