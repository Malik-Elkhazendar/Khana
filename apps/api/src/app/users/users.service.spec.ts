import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { AuditAction, PasswordResetToken, User } from '@khana/data-access';
import { UserRole } from '@khana/shared-dtos';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '@khana/notifications';
import { PasswordService } from '../auth/services/password.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  const tenantId = 'tenant-1';
  const now = new Date('2026-02-28T10:00:00.000Z');

  let service: UsersService;
  let userRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
  };
  let auditLogRepository: {
    create: jest.Mock;
    save: jest.Mock;
  };
  let refreshTokenRepository: {
    update: jest.Mock;
  };
  let passwordResetTokenRepository: {
    update: jest.Mock;
    save: jest.Mock;
  };
  let passwordService: jest.Mocked<PasswordService>;
  let emailService: jest.Mocked<EmailService>;
  let configService: jest.Mocked<ConfigService>;

  const appLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const ownerUser = {
    id: 'owner-1',
    role: UserRole.OWNER,
    tenantId,
    email: 'owner@khana.dev',
    name: 'Owner User',
  } as unknown as User;

  const managerUser = {
    id: 'manager-1',
    role: UserRole.MANAGER,
    tenantId,
    email: 'manager@khana.dev',
    name: 'Manager User',
  } as unknown as User;

  const staffUser = {
    id: 'staff-1',
    role: UserRole.STAFF,
    tenantId,
    email: 'staff@khana.dev',
    name: 'Staff User',
  } as unknown as User;

  const buildUser = (overrides: Partial<User> = {}, id = 'user-1'): User => {
    return {
      id,
      tenantId,
      tenant: { id: tenantId } as never,
      email: 'staff@khana.dev',
      name: 'Staff User',
      role: UserRole.STAFF,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    } as unknown as User;
  };

  beforeEach(() => {
    userRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn((payload: Partial<User>) => ({ ...payload })),
      save: jest.fn(async (payload: Partial<User>) => ({
        ...buildUser(),
        ...payload,
        id: payload.id ?? 'invited-1',
        tenant: payload.tenant ?? ({ id: tenantId } as never),
      })),
    };

    auditLogRepository = {
      create: jest.fn((payload: Record<string, unknown>) => payload),
      save: jest.fn(async (payload: Record<string, unknown>) => payload),
    };

    refreshTokenRepository = {
      update: jest.fn(),
    };

    passwordResetTokenRepository = {
      update: jest.fn(),
      save: jest.fn(async (payload: Partial<PasswordResetToken>) => payload),
    };

    passwordService = {
      hash: jest.fn(async () => 'hashed-password'),
      verify: jest.fn(),
    } as unknown as jest.Mocked<PasswordService>;

    emailService = {
      sendSecurityAlert: jest.fn(),
      sendSecurityAlertStrict: jest.fn(),
      sendPasswordChangedNotification: jest.fn(),
      sendBookingConfirmation: jest.fn(),
      sendPaymentReceipt: jest.fn(),
      sendCancellationNotification: jest.fn(),
      sendRefundNotification: jest.fn(),
      sendPasswordResetNotification: jest.fn(),
      sendNewBookingAlert: jest.fn(),
      sendTeamInviteNotification: jest.fn(),
    } as unknown as jest.Mocked<EmailService>;

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'REFRESH_TOKEN_HMAC_SECRET') return 'test-secret';
        if (key === 'FRONTEND_URL') return 'http://localhost:4200';
        return undefined;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    service = new UsersService(
      userRepository as never,
      auditLogRepository as never,
      refreshTokenRepository as never,
      passwordResetTokenRepository as never,
      passwordService,
      emailService,
      configService,
      appLogger as never
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('allows owner/manager to list users in tenant', async () => {
    const users = [buildUser({}, 'user-1'), buildUser({}, 'user-2')];
    userRepository.find.mockResolvedValue(users);

    const result = await service.listUsers(tenantId, managerUser);

    expect(userRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId } })
    );
    expect(result).toHaveLength(2);
  });

  it('rejects list for staff role', async () => {
    await expect(service.listUsers(tenantId, staffUser)).rejects.toThrow(
      ForbiddenException
    );
  });

  it('updates role from STAFF to MANAGER for owner', async () => {
    const targetUser = buildUser({ email: 'target@khana.dev' }, 'user-2');
    userRepository.findOne.mockResolvedValue(targetUser);

    const result = await service.updateUserRole(
      targetUser.id,
      { role: UserRole.MANAGER },
      tenantId,
      ownerUser
    );

    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: targetUser.id, role: UserRole.MANAGER })
    );
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.UPDATE,
        entityType: 'User',
        entityId: targetUser.id,
      })
    );
    expect(result.role).toBe(UserRole.MANAGER);
  });

  it('rejects assigning OWNER role through update endpoint', async () => {
    const targetUser = buildUser({}, 'user-4');
    userRepository.findOne.mockResolvedValue(targetUser);

    await expect(
      service.updateUserRole(
        targetUser.id,
        { role: UserRole.OWNER },
        tenantId,
        ownerUser
      )
    ).rejects.toThrow(BadRequestException);
  });

  it('deactivates user and revokes refresh tokens', async () => {
    const targetUser = buildUser({ email: 'inactive@khana.dev' }, 'user-5');
    userRepository.findOne.mockResolvedValue(targetUser);

    const result = await service.updateUserStatus(
      targetUser.id,
      { isActive: false },
      tenantId,
      ownerUser
    );

    expect(userRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: targetUser.id, isActive: false })
    );
    expect(refreshTokenRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ userId: targetUser.id }),
      expect.objectContaining({ revokedAt: expect.any(Date) })
    );
    expect(result.isActive).toBe(false);
  });

  it('rejects deactivating own account', async () => {
    const targetOwnerRecord = buildUser(
      {
        id: ownerUser.id,
        email: ownerUser.email,
        role: UserRole.OWNER,
      },
      ownerUser.id
    );
    userRepository.findOne.mockResolvedValue(targetOwnerRecord);

    await expect(
      service.updateUserStatus(
        ownerUser.id,
        { isActive: false },
        tenantId,
        ownerUser
      )
    ).rejects.toThrow(BadRequestException);
  });

  it('invites a new user and sends team invitation email', async () => {
    userRepository.findOne.mockResolvedValue(null);

    const result = await service.inviteUser(
      {
        email: 'new.manager@khana.dev',
        role: UserRole.MANAGER,
      },
      tenantId,
      ownerUser
    );

    expect(passwordService.hash).toHaveBeenCalled();
    expect(passwordResetTokenRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'invited-1',
        tokenHash: expect.any(String),
        expiresAt: expect.any(Date),
      })
    );
    expect(emailService.sendTeamInviteNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: 'new.manager@khana.dev',
        role: UserRole.MANAGER,
        inviteUrl: expect.stringContaining('/reset-password?token='),
      })
    );
    expect(auditLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: AuditAction.CREATE,
        entityType: 'User',
      })
    );
    expect(result.message).toBe('Invitation sent successfully.');
  });

  it('rejects duplicate invite email in same tenant', async () => {
    userRepository.findOne.mockResolvedValue(buildUser({}, 'existing-1'));

    await expect(
      service.inviteUser(
        {
          email: 'staff@khana.dev',
          role: UserRole.STAFF,
        },
        tenantId,
        ownerUser
      )
    ).rejects.toThrow(ConflictException);
  });
});
