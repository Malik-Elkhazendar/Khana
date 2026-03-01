import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomBytes } from 'crypto';
import {
  AuditAction,
  AuditLog,
  PasswordResetToken,
  RefreshToken,
  User,
} from '@khana/data-access';
import { InviteUserResponseDto, UserDto, UserRole } from '@khana/shared-dtos';
import { IsNull, Repository } from 'typeorm';
import { EmailService } from '@khana/notifications';
import { AppLoggerService } from '../logging';
import { PasswordService } from '../auth/services/password.service';
import { InviteUserDto, UpdateUserRoleDto, UpdateUserStatusDto } from './dto';

const ACCESS_DENIED_MESSAGE =
  'Access denied: You do not have permission to access this resource.';
const RESOURCE_NOT_FOUND_MESSAGE = 'Resource not found';
const OWNER_PROTECTED_MESSAGE =
  'Owner accounts cannot be modified through this endpoint.';
const EMAIL_EXISTS_MESSAGE =
  'A user with this email already exists in this tenant.';

const ASSIGNABLE_ROLES = new Set<UserRole>([
  UserRole.MANAGER,
  UserRole.STAFF,
  UserRole.VIEWER,
]);

const INVITE_TOKEN_TTL_MS = 48 * 60 * 60 * 1000;
const WORKSPACE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type Actor = Pick<User, 'id' | 'role' | 'tenantId' | 'email' | 'name'>;

@Injectable()
export class UsersService {
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
  ) {}

  async listUsers(tenantId: string, actor: Actor): Promise<UserDto[]> {
    const resolvedTenantId = this.requireTenantId(tenantId);
    const actorRole = this.requireUserRole(actor.role);

    if (actorRole !== UserRole.OWNER && actorRole !== UserRole.MANAGER) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }

    const users = await this.userRepository.find({
      where: { tenantId: resolvedTenantId },
      relations: ['tenant'],
      order: { createdAt: 'ASC' },
    });

    return users.map((user) => this.toUserDto(user));
  }

  async updateUserRole(
    id: string,
    dto: UpdateUserRoleDto,
    tenantId: string,
    actor: Actor,
    ipAddress?: string,
    userAgent?: string
  ): Promise<UserDto> {
    const resolvedTenantId = this.requireTenantId(tenantId);
    this.assertOwnerRole(this.requireUserRole(actor.role));

    const user = await this.requireTenantUser(id, resolvedTenantId);
    if (user.id === actor.id) {
      throw new BadRequestException('You cannot change your own role.');
    }
    if (user.role === UserRole.OWNER) {
      throw new BadRequestException(OWNER_PROTECTED_MESSAGE);
    }

    const nextRole = this.normalizeAssignableRole(dto.role);
    if (user.role === nextRole) {
      return this.toUserDto(user);
    }

    const beforeRole = user.role;
    user.role = nextRole;
    const saved = await this.userRepository.save(user);

    await this.logAudit({
      tenantId: resolvedTenantId,
      userId: actor.id,
      action: AuditAction.UPDATE,
      entityType: 'User',
      entityId: saved.id,
      description: `User role changed: ${saved.email}`,
      changes: {
        before: { role: beforeRole },
        after: { role: saved.role },
      },
      ipAddress,
      userAgent,
    });

    this.appLogger.info('user.role.update.success', 'User role updated', {
      tenantId: resolvedTenantId,
      actorUserId: actor.id,
      targetUserId: saved.id,
      role: saved.role,
    });

    return this.toUserDto(saved);
  }

  async updateUserStatus(
    id: string,
    dto: UpdateUserStatusDto,
    tenantId: string,
    actor: Actor,
    ipAddress?: string,
    userAgent?: string
  ): Promise<UserDto> {
    const resolvedTenantId = this.requireTenantId(tenantId);
    this.assertOwnerRole(this.requireUserRole(actor.role));

    const user = await this.requireTenantUser(id, resolvedTenantId);
    if (user.id === actor.id && dto.isActive === false) {
      throw new BadRequestException('You cannot deactivate your own account.');
    }
    if (user.role === UserRole.OWNER) {
      throw new BadRequestException(OWNER_PROTECTED_MESSAGE);
    }

    if (user.isActive === dto.isActive) {
      return this.toUserDto(user);
    }

    const beforeStatus = user.isActive;
    user.isActive = dto.isActive;
    const saved = await this.userRepository.save(user);

    if (!saved.isActive) {
      await this.refreshTokenRepository.update(
        { userId: saved.id, revokedAt: IsNull() },
        { revokedAt: new Date() }
      );
    }

    await this.logAudit({
      tenantId: resolvedTenantId,
      userId: actor.id,
      action: AuditAction.UPDATE,
      entityType: 'User',
      entityId: saved.id,
      description: `User status changed: ${saved.email}`,
      changes: {
        before: { isActive: beforeStatus },
        after: { isActive: saved.isActive },
      },
      ipAddress,
      userAgent,
    });

    this.appLogger.info('user.status.update.success', 'User status updated', {
      tenantId: resolvedTenantId,
      actorUserId: actor.id,
      targetUserId: saved.id,
      isActive: saved.isActive,
    });

    return this.toUserDto(saved);
  }

  async inviteUser(
    dto: InviteUserDto,
    tenantId: string,
    actor: Actor,
    ipAddress?: string,
    userAgent?: string
  ): Promise<InviteUserResponseDto> {
    const resolvedTenantId = this.requireTenantId(tenantId);
    this.assertOwnerRole(this.requireUserRole(actor.role));

    const email = dto.email.trim().toLowerCase();
    const role = this.normalizeAssignableRole(dto.role);

    const existingUser = await this.userRepository.findOne({
      where: { email, tenantId: resolvedTenantId },
    });

    if (existingUser) {
      throw new ConflictException(EMAIL_EXISTS_MESSAGE);
    }

    const name = this.deriveNameFromEmail(email);
    const passwordHash = await this.passwordService.hash(
      this.generateTemporaryPassword()
    );

    const user = this.userRepository.create({
      email,
      name,
      role,
      isActive: true,
      passwordHash,
      tenantId: resolvedTenantId,
    });
    const savedUser = await this.userRepository.save(user);
    const savedUserWithTenant =
      (await this.userRepository.findOne({
        where: { id: savedUser.id, tenantId: resolvedTenantId },
        relations: ['tenant'],
      })) ?? savedUser;

    const invitation = await this.createInvitationToken(
      savedUser.id,
      ipAddress,
      userAgent
    );

    await this.emailService.sendTeamInviteNotification({
      recipientEmail: savedUser.email,
      recipientName: savedUser.name,
      invitedByName: actor.name || actor.email || 'Owner',
      role: savedUser.role,
      inviteUrl: this.buildInviteUrl(
        invitation.rawToken,
        savedUserWithTenant.tenant?.slug
      ),
      inviteToken: invitation.rawToken,
      expiresAt: invitation.expiresAt,
    });

    await this.logAudit({
      tenantId: resolvedTenantId,
      userId: actor.id,
      action: AuditAction.CREATE,
      entityType: 'User',
      entityId: savedUser.id,
      description: `User invited: ${savedUser.email}`,
      changes: {
        after: {
          id: savedUser.id,
          email: savedUser.email,
          role: savedUser.role,
          isActive: savedUser.isActive,
        },
      },
      ipAddress,
      userAgent,
    });

    this.appLogger.info('user.invite.success', 'User invited', {
      tenantId: resolvedTenantId,
      actorUserId: actor.id,
      invitedUserId: savedUser.id,
      role: savedUser.role,
    });

    return {
      message: 'Invitation sent successfully.',
      user: this.toUserDto(savedUserWithTenant),
    };
  }

  private requireTenantId(tenantId?: string): string {
    const normalized = tenantId?.trim();
    if (!normalized) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }
    return normalized;
  }

  private requireUserRole(role?: string): UserRole {
    if (
      role === UserRole.OWNER ||
      role === UserRole.MANAGER ||
      role === UserRole.STAFF ||
      role === UserRole.VIEWER
    ) {
      return role;
    }
    throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
  }

  private assertOwnerRole(role: UserRole): void {
    if (role !== UserRole.OWNER) {
      throw new ForbiddenException(ACCESS_DENIED_MESSAGE);
    }
  }

  private async requireTenantUser(id: string, tenantId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id, tenantId },
      relations: ['tenant'],
    });

    if (!user) {
      throw new NotFoundException(RESOURCE_NOT_FOUND_MESSAGE);
    }

    return user;
  }

  private normalizeAssignableRole(role: UserRole): UserRole {
    if (!ASSIGNABLE_ROLES.has(role)) {
      throw new BadRequestException('Role is invalid for this operation.');
    }

    return role;
  }

  private deriveNameFromEmail(email: string): string {
    const localPart = email.split('@')[0] ?? 'Team Member';
    const readable = localPart.replace(/[._-]+/g, ' ').trim();
    if (!readable) {
      return 'Team Member';
    }

    return readable
      .split(' ')
      .filter(Boolean)
      .map((chunk) => chunk[0].toUpperCase() + chunk.slice(1))
      .join(' ');
  }

  private generateTemporaryPassword(): string {
    const randomSegment = randomBytes(12).toString('hex');
    return `Invite-${randomSegment}-Aa1`;
  }

  private async createInvitationToken(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<{ rawToken: string; expiresAt: Date }> {
    await this.passwordResetTokenRepository.update(
      { userId, usedAt: IsNull() },
      { usedAt: new Date() }
    );

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHmac('sha256', this.getHmacSecret())
      .update(rawToken)
      .digest('hex');
    const expiresAt = new Date(Date.now() + INVITE_TOKEN_TTL_MS);

    await this.passwordResetTokenRepository.save({
      userId,
      tokenHash,
      expiresAt,
      ipAddress,
      userAgent,
    });

    return { rawToken, expiresAt };
  }

  private buildInviteUrl(
    rawToken: string,
    workspaceSlug?: string
  ): string | undefined {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const frontendBase = frontendUrl?.replace(/\/+$/, '');

    if (!frontendBase) {
      return undefined;
    }

    const params = new URLSearchParams({
      token: rawToken,
    });

    const normalizedWorkspaceSlug = workspaceSlug?.trim().toLowerCase();
    if (
      normalizedWorkspaceSlug &&
      WORKSPACE_SLUG_PATTERN.test(normalizedWorkspaceSlug)
    ) {
      params.set('workspace', normalizedWorkspaceSlug);
    }

    return `${frontendBase}/reset-password?${params.toString()}`;
  }

  private getHmacSecret(): string {
    const secret = this.configService.get<string>('REFRESH_TOKEN_HMAC_SECRET');
    if (!secret) {
      throw new Error('REFRESH_TOKEN_HMAC_SECRET is not set');
    }

    return secret;
  }

  private toUserDto(user: User): UserDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role as UserRole,
      isActive: user.isActive,
      onboardingCompleted: user.tenant?.onboardingCompleted ?? false,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      tenantId: user.tenantId || user.tenant?.id || 'unknown',
    };
  }

  private async logAudit(params: {
    tenantId: string;
    userId?: string;
    action: AuditAction;
    entityType: string;
    entityId: string;
    description?: string;
    changes?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    const auditLog = this.auditLogRepository.create({
      tenantId: params.tenantId,
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      description: params.description,
      changes: params.changes,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
    });

    await this.auditLogRepository.save(auditLog);
  }
}
