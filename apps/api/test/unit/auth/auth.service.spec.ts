import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import {
  User,
  Tenant,
  AuditLog,
  AuditAction,
  RefreshToken,
  PasswordResetToken,
} from '@khana/data-access';
import { AuthService } from '../../../src/app/auth/auth.service';
import { PasswordService } from '../../../src/app/auth/services/password.service';
import { JwtTokenService } from '../../../src/app/auth/services/jwt.service';
import { DataSource } from 'typeorm';
import { EmailService } from '@khana/notifications';
import { MetricsService } from '../../../src/app/auth/services/metrics.service';
import { createHmac } from 'crypto';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: any;
  let auditLogRepository: any;
  let refreshTokenRepository: any;
  let passwordResetTokenRepository: any;
  let tenantRepository: any;
  let dataSource: any;
  let passwordService: PasswordService;
  let jwtTokenService: JwtTokenService;
  let emailService: EmailService;
  let metricsService: MetricsService;

  const MOCK_TENANT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    phone: '+1234567890',
    passwordHash: '$2b$10$hashedpassword',
    role: 'STAFF',
    isActive: true,
    tenantId: MOCK_TENANT_ID,
    lastLoginAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    tenant: { id: MOCK_TENANT_ID, name: 'Test Tenant' },
  };

  const mockTokens = {
    accessToken: 'mock-access-token',
    refreshToken: 'mock-refresh-token',
    expiresIn: 900000,
  };

  const hashToken = (token: string) =>
    createHmac('sha256', process.env.REFRESH_TOKEN_HMAC_SECRET || '')
      .update(token)
      .digest('hex');

  beforeAll(() => {
    process.env.REFRESH_TOKEN_HMAC_SECRET = 'test-hmac-secret';
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PasswordService,
          useValue: {
            hash: jest.fn().mockResolvedValue('$2b$10$hashedpassword'),
            verify: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: JwtTokenService,
          useValue: {
            generateTokenPair: jest.fn().mockReturnValue(mockTokens),
            verifyRefreshToken: jest.fn().mockReturnValue({
              sub: 'user-123',
              email: 'test@example.com',
              role: 'STAFF',
              tenantId: MOCK_TENANT_ID,
              typ: 'refresh',
              jti: 'token-123',
              sid: 'session-123',
            }),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AuditLog),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            count: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(RefreshToken),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(PasswordResetToken),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Tenant),
          useValue: {
            find: jest.fn(),
            exists: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            sendSecurityAlert: jest.fn(),
            sendPasswordChangedNotification: jest.fn(),
            sendPasswordResetNotification: jest.fn(),
          },
        },
        {
          provide: MetricsService,
          useValue: {
            trackReuseDetection: jest.fn(),
            trackFailedRefresh: jest.fn(),
            trackTokenRotation: jest.fn(),
            trackActiveSessions: jest.fn(),
            trackSecurityEscalation: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'REFRESH_TOKEN_TTL_DAYS') return '7';
              if (key === 'REFRESH_TOKEN_HMAC_SECRET')
                return 'test-hmac-secret';
              if (key === 'FRONTEND_URL') return 'http://localhost:4200';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get(getRepositoryToken(User));
    auditLogRepository = module.get(getRepositoryToken(AuditLog));
    refreshTokenRepository = module.get(getRepositoryToken(RefreshToken));
    passwordResetTokenRepository = module.get(
      getRepositoryToken(PasswordResetToken)
    );
    tenantRepository = module.get(getRepositoryToken(Tenant));
    dataSource = module.get(DataSource);
    passwordService = module.get<PasswordService>(PasswordService);
    jwtTokenService = module.get<JwtTokenService>(JwtTokenService);
    emailService = module.get<EmailService>(EmailService);
    metricsService = module.get<MetricsService>(MetricsService);

    tenantRepository.exists.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    const registerDto = {
      email: 'newuser@example.com',
      password: 'Password123',
      name: 'New User',
      phone: '+1234567890',
    };
    const tenantId = MOCK_TENANT_ID;

    it('should register a new user successfully', async () => {
      userRepository.findOne.mockResolvedValue(null);
      userRepository.count.mockResolvedValue(0);
      userRepository.create.mockReturnValue({ ...mockUser, ...registerDto });
      userRepository.save.mockResolvedValue({ ...mockUser, ...registerDto });
      auditLogRepository.create.mockReturnValue({});
      auditLogRepository.save.mockResolvedValue({});

      const result = await service.register(registerDto, tenantId);

      expect(result).toHaveProperty('accessToken', mockTokens.accessToken);
      expect(result).toHaveProperty('refreshToken', mockTokens.refreshToken);
      expect(result).toHaveProperty('expiresIn', mockTokens.expiresIn);
      expect(result.user).toHaveProperty('email', registerDto.email);
      expect(result.user).toHaveProperty('name', registerDto.name);
      expect(result.user).not.toHaveProperty('password');
      expect(result.user).not.toHaveProperty('passwordHash');
      expect(passwordService.hash).toHaveBeenCalledWith(registerDto.password);
      expect(userRepository.create).toHaveBeenCalled();
      expect(userRepository.save).toHaveBeenCalled();
      expect(auditLogRepository.save).toHaveBeenCalled();
      expect(refreshTokenRepository.save).toHaveBeenCalled();
    });

    it('should assign OWNER role to first user', async () => {
      userRepository.findOne.mockResolvedValue(null);
      userRepository.count.mockResolvedValue(0);
      const createdUser = { ...mockUser, ...registerDto, role: 'OWNER' };
      userRepository.create.mockReturnValue(createdUser);
      userRepository.save.mockResolvedValue(createdUser);
      auditLogRepository.create.mockReturnValue({});
      auditLogRepository.save.mockResolvedValue({});

      const result = await service.register(registerDto, tenantId);

      expect(userRepository.count).toHaveBeenCalledWith({
        where: { tenantId },
      });
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'OWNER',
        })
      );
    });

    it('should assign STAFF role to subsequent users', async () => {
      userRepository.findOne.mockResolvedValue(null);
      userRepository.count.mockResolvedValue(1);
      const createdUser = { ...mockUser, ...registerDto, role: 'STAFF' };
      userRepository.create.mockReturnValue(createdUser);
      userRepository.save.mockResolvedValue(createdUser);
      auditLogRepository.create.mockReturnValue({});
      auditLogRepository.save.mockResolvedValue({});

      await service.register(registerDto, tenantId);

      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'STAFF',
        })
      );
    });

    it('should ignore role from payload for non-first users', async () => {
      userRepository.findOne.mockResolvedValue(null);
      userRepository.count.mockResolvedValue(1);
      const dtoWithRole = {
        ...registerDto,
        role: 'OWNER',
      } as typeof registerDto & { role: 'OWNER' };
      const createdUser = { ...mockUser, ...dtoWithRole, role: 'STAFF' };
      userRepository.create.mockReturnValue(createdUser);
      userRepository.save.mockResolvedValue(createdUser);
      auditLogRepository.create.mockReturnValue({});
      auditLogRepository.save.mockResolvedValue({});

      await service.register(dtoWithRole as any, tenantId);

      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: 'STAFF',
        })
      );
    });

    it('should require tenant id for registration', async () => {
      await expect(
        service.register(registerDto as any, undefined)
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.register(registerDto as any, undefined)
      ).rejects.toThrow('Tenant ID is required');
    });

    it('should reject unknown tenant id for registration', async () => {
      tenantRepository.exists.mockResolvedValue(false);

      await expect(
        service.register(registerDto as any, tenantId)
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.register(registerDto as any, tenantId)
      ).rejects.toThrow('Invalid tenant ID');
    });

    it('should throw ConflictException if email exists', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.register(registerDto, tenantId)).rejects.toThrow(
        ConflictException
      );
      await expect(service.register(registerDto, tenantId)).rejects.toThrow(
        `Email ${registerDto.email} already registered in this tenant`
      );
    });

    it('should throw BadRequestException for weak password (too short)', async () => {
      const weakDto = { ...registerDto, password: 'weak' };

      await expect(service.register(weakDto, tenantId)).rejects.toThrow(
        BadRequestException
      );
      await expect(service.register(weakDto, tenantId)).rejects.toThrow(
        'Password must be at least 8 characters long'
      );
    });

    it('should throw BadRequestException for password without uppercase', async () => {
      const weakDto = { ...registerDto, password: 'password123' };

      await expect(service.register(weakDto, tenantId)).rejects.toThrow(
        BadRequestException
      );
      await expect(service.register(weakDto, tenantId)).rejects.toThrow(
        'Password must contain uppercase, lowercase, and numbers'
      );
    });

    it('should throw BadRequestException for password without lowercase', async () => {
      const weakDto = { ...registerDto, password: 'PASSWORD123' };

      await expect(service.register(weakDto, tenantId)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should throw BadRequestException for password without numbers', async () => {
      const weakDto = { ...registerDto, password: 'Password' };

      await expect(service.register(weakDto, tenantId)).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('login', () => {
    const loginDto = {
      email: 'test@example.com',
      password: 'Password123',
    };
    const tenantId = MOCK_TENANT_ID;

    it('should login user and return tokens', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.update.mockResolvedValue({});
      auditLogRepository.create.mockReturnValue({});
      auditLogRepository.save.mockResolvedValue({});

      const result = await service.login(loginDto, tenantId);

      expect(result).toHaveProperty('accessToken', mockTokens.accessToken);
      expect(result).toHaveProperty('refreshToken', mockTokens.refreshToken);
      expect(result).toHaveProperty('expiresIn', mockTokens.expiresIn);
      expect(result).toHaveProperty('user');
      expect(result.user).toHaveProperty('email', mockUser.email);
      expect(passwordService.verify).toHaveBeenCalledWith(
        loginDto.password,
        mockUser.passwordHash
      );
      expect(jwtTokenService.generateTokenPair).toHaveBeenCalled();
    });

    it('should update lastLoginAt on successful login', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.update.mockResolvedValue({});
      auditLogRepository.create.mockReturnValue({});
      auditLogRepository.save.mockResolvedValue({});

      await service.login(loginDto, tenantId);

      expect(userRepository.update).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          lastLoginAt: expect.any(Date),
        })
      );
    });

    it('should store refresh token record', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.update.mockResolvedValue({});
      refreshTokenRepository.save.mockResolvedValue({});
      auditLogRepository.create.mockReturnValue({});
      auditLogRepository.save.mockResolvedValue({});

      await service.login(loginDto, tenantId);

      expect(refreshTokenRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          tokenHash: hashToken(mockTokens.refreshToken),
          sessionId: expect.any(String),
          id: expect.any(String),
        })
      );
    });

    it('should log audit event on login', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.update.mockResolvedValue({});
      auditLogRepository.create.mockReturnValue({});
      auditLogRepository.save.mockResolvedValue({});

      await service.login(loginDto, tenantId);

      expect(auditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.LOGIN,
          entityType: 'User',
          entityId: mockUser.id,
        })
      );
      expect(auditLogRepository.save).toHaveBeenCalled();
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.login(loginDto, tenantId)).rejects.toThrow(
        UnauthorizedException
      );
      await expect(service.login(loginDto, tenantId)).rejects.toThrow(
        'Invalid email or password'
      );
    });

    it('should throw UnauthorizedException for inactive user', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      userRepository.findOne.mockResolvedValue(inactiveUser);

      await expect(service.login(loginDto, tenantId)).rejects.toThrow(
        UnauthorizedException
      );
      await expect(service.login(loginDto, tenantId)).rejects.toThrow(
        'User account is inactive'
      );
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      (passwordService.verify as jest.Mock).mockResolvedValue(false);

      await expect(service.login(loginDto, tenantId)).rejects.toThrow(
        UnauthorizedException
      );
      await expect(service.login(loginDto, tenantId)).rejects.toThrow(
        'Invalid email or password'
      );
    });
  });

  describe('refreshToken', () => {
    const refreshToken = 'valid-refresh-token';

    const makeTokenRecord = (overrides: Partial<RefreshToken> = {}) => ({
      id: 'token-123',
      userId: mockUser.id,
      sessionId: 'session-123',
      tokenHash: hashToken(refreshToken),
      issuedAt: new Date(Date.now() - 1000),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
      revokedAt: null,
      user: mockUser,
      ...overrides,
    });

    it('should refresh token successfully', async () => {
      refreshTokenRepository.findOne.mockResolvedValue(makeTokenRecord());
      dataSource.transaction.mockImplementation(
        async (_level: string, cb: any) =>
          cb({
            update: jest.fn().mockResolvedValue({ affected: 1 }),
            save: jest.fn().mockResolvedValue({}),
          })
      );

      const result = await service.refreshToken(refreshToken);

      expect(result).toHaveProperty('accessToken', mockTokens.accessToken);
      expect(result).toHaveProperty('refreshToken', mockTokens.refreshToken);
      expect(result).toHaveProperty('expiresIn', mockTokens.expiresIn);
      expect(jwtTokenService.verifyRefreshToken).toHaveBeenCalledWith(
        refreshToken
      );
      expect(dataSource.transaction).toHaveBeenCalled();
    });

    it('should reject expired refresh token record', async () => {
      refreshTokenRepository.findOne.mockResolvedValue(
        makeTokenRecord({ expiresAt: new Date(Date.now() - 1000) })
      );

      await expect(service.refreshToken(refreshToken)).rejects.toThrow(
        'Refresh token expired'
      );
    });

    it('should reject revoked token and trigger reuse handling', async () => {
      refreshTokenRepository.findOne.mockResolvedValue(
        makeTokenRecord({ revokedAt: new Date() })
      );
      auditLogRepository.create.mockReturnValue({});
      auditLogRepository.save.mockResolvedValue({});
      auditLogRepository.count.mockResolvedValue(0);

      await expect(service.refreshToken(refreshToken)).rejects.toThrow(
        'Session revoked due to security policy'
      );
      expect(emailService.sendSecurityAlert).toHaveBeenCalled();
      expect(refreshTokenRepository.update).toHaveBeenCalled();
    });

    it('should reject token when hash does not match', async () => {
      refreshTokenRepository.findOne.mockResolvedValue(
        makeTokenRecord({ tokenHash: hashToken('different-token') })
      );

      await expect(service.refreshToken(refreshToken)).rejects.toThrow(
        UnauthorizedException
      );
    });

    it('should detect concurrent refresh and revoke session', async () => {
      refreshTokenRepository.findOne.mockResolvedValue(makeTokenRecord());
      auditLogRepository.create.mockReturnValue({});
      auditLogRepository.save.mockResolvedValue({});
      auditLogRepository.count.mockResolvedValue(0);
      dataSource.transaction.mockImplementation(
        async (_level: string, cb: any) =>
          cb({
            update: jest.fn().mockResolvedValue({ affected: 0 }),
            save: jest.fn().mockResolvedValue({}),
          })
      );

      await expect(service.refreshToken(refreshToken)).rejects.toThrow(
        'Concurrent token use detected'
      );
      expect(refreshTokenRepository.update).toHaveBeenCalled();
    });

    it('should reject refresh token if user is soft-deleted', async () => {
      const deletedUser = { ...mockUser, deletedAt: new Date() } as any;
      refreshTokenRepository.findOne.mockResolvedValue(
        makeTokenRecord({ user: deletedUser })
      );

      await expect(service.refreshToken(refreshToken)).rejects.toThrow(
        UnauthorizedException
      );
      await expect(service.refreshToken(refreshToken)).rejects.toThrow(
        'User account has been deleted'
      );
      expect(metricsService.trackFailedRefresh).toHaveBeenCalledWith(
        'user_deleted'
      );
    });
  });

  describe('logout', () => {
    it('should logout user by revoking refresh tokens', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      refreshTokenRepository.update.mockResolvedValue({});
      auditLogRepository.create.mockReturnValue({});
      auditLogRepository.save.mockResolvedValue({});

      await service.logout(mockUser.id);

      expect(refreshTokenRepository.update).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
        }),
        expect.objectContaining({
          revokedAt: expect.any(Date),
        })
      );
    });

    it('should log audit event on logout', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      refreshTokenRepository.update.mockResolvedValue({});
      auditLogRepository.create.mockReturnValue({});
      auditLogRepository.save.mockResolvedValue({});

      await service.logout(mockUser.id);

      expect(auditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.LOGOUT,
          entityType: 'User',
        })
      );
    });

    it('should succeed silently if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.logout('non-existent-id')).resolves.toBeUndefined();
    });
  });

  describe('getCurrentUser', () => {
    it('should return current user', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.getCurrentUser(mockUser.id);

      expect(result).toHaveProperty('email', mockUser.email);
      expect(result).toHaveProperty('name', mockUser.name);
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.getCurrentUser('non-existent-id')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('changePassword', () => {
    const userId = mockUser.id;
    const oldPassword = 'OldPassword123';
    const newPassword = 'NewPassword123';

    it('should change password successfully', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.update.mockResolvedValue({});
      auditLogRepository.create.mockReturnValue({});
      auditLogRepository.save.mockResolvedValue({});

      await service.changePassword(userId, oldPassword, newPassword);

      expect(passwordService.verify).toHaveBeenCalledWith(
        oldPassword,
        mockUser.passwordHash
      );
      expect(passwordService.hash).toHaveBeenCalledWith(newPassword);
      expect(userRepository.update).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({
          passwordHash: '$2b$10$hashedpassword',
        })
      );
      expect(refreshTokenRepository.update).toHaveBeenCalled();
    });

    it('should invalidate all sessions on password change', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.update.mockResolvedValue({});
      refreshTokenRepository.update.mockResolvedValue({});
      auditLogRepository.create.mockReturnValue({});
      auditLogRepository.save.mockResolvedValue({});

      await service.changePassword(userId, oldPassword, newPassword);

      expect(refreshTokenRepository.update).toHaveBeenCalled();
    });

    it('should log audit event on password change', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      userRepository.update.mockResolvedValue({});
      auditLogRepository.create.mockReturnValue({});
      auditLogRepository.save.mockResolvedValue({});

      await service.changePassword(userId, oldPassword, newPassword);

      expect(auditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.UPDATE,
          entityType: 'User',
        })
      );
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.changePassword(userId, oldPassword, newPassword)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw UnauthorizedException if old password is incorrect', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      (passwordService.verify as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword(userId, oldPassword, newPassword)
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.changePassword(userId, oldPassword, newPassword)
      ).rejects.toThrow('Current password is incorrect');
    });

    it('should throw BadRequestException for weak new password', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);

      await expect(
        service.changePassword(userId, oldPassword, 'weak')
      ).rejects.toThrow(BadRequestException);
    });

    // Edge case: null/empty oldPassword (defensive guard)
    it('should throw BadRequestException if oldPassword is empty string', async () => {
      await expect(
        service.changePassword(userId, '', newPassword)
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.changePassword(userId, '', newPassword)
      ).rejects.toThrow('Current password is required');
    });

    it('should throw BadRequestException if oldPassword is whitespace only', async () => {
      await expect(
        service.changePassword(userId, '   ', newPassword)
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.changePassword(userId, '   ', newPassword)
      ).rejects.toThrow('Current password is required');
    });

    it('should throw BadRequestException if oldPassword is null (defensive)', async () => {
      // Note: ValidationPipe should prevent this, but service has defensive guard
      await expect(
        service.changePassword(userId, null as any, newPassword)
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if oldPassword is undefined (defensive)', async () => {
      // Note: ValidationPipe should prevent this, but service has defensive guard
      await expect(
        service.changePassword(userId, undefined as any, newPassword)
      ).rejects.toThrow(BadRequestException);
    });

    it('should NOT call userRepository.findOne if oldPassword is invalid', async () => {
      await expect(
        service.changePassword(userId, '', newPassword)
      ).rejects.toThrow(BadRequestException);

      // Verify findOne was never called (early return before DB query)
      expect(userRepository.findOne).not.toHaveBeenCalled();
    });

    it('should return 400 error, not 500, for empty oldPassword', async () => {
      const error = await service
        .changePassword(userId, '', newPassword)
        .catch((e) => e);

      expect(error).toBeInstanceOf(BadRequestException);
      expect(error.getStatus()).toBe(400); // Verify it's 400, not 500
    });
  });

  describe('forgotPassword', () => {
    const email = 'test@example.com';
    const tenantId = MOCK_TENANT_ID;

    it('should scope user lookup by tenant id', async () => {
      userRepository.findOne.mockResolvedValue({
        id: mockUser.id,
        email,
        tenantId,
        isActive: true,
      });
      passwordResetTokenRepository.update.mockResolvedValue({});
      passwordResetTokenRepository.save.mockResolvedValue({});
      auditLogRepository.create.mockReturnValue({});
      auditLogRepository.save.mockResolvedValue({});
      (
        emailService.sendPasswordResetNotification as jest.Mock
      ).mockResolvedValue({});

      const result = await service.forgotPassword(email, tenantId);

      expect(result).toEqual({
        message: 'If that email exists, a reset link has been sent',
      });
      expect(userRepository.findOne).toHaveBeenCalled();
      const findCallArgs = userRepository.findOne.mock.calls[0][0];
      expect(findCallArgs.where.email).toBe(email);
      expect(findCallArgs.where.tenantId).toBe(tenantId);
      expect(emailService.sendPasswordResetNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          resetUrl: expect.stringContaining(
            'http://localhost:4200/reset-password?token='
          ),
        })
      );
    });

    it('should require tenant id for forgot password', async () => {
      await expect(service.forgotPassword(email)).rejects.toThrow(
        BadRequestException
      );
      await expect(service.forgotPassword(email)).rejects.toThrow(
        'Tenant ID is required'
      );
    });

    it('should return generic response when user is missing in tenant', async () => {
      userRepository.findOne.mockResolvedValue(null);

      const result = await service.forgotPassword(email, tenantId);

      expect(result).toEqual({
        message: 'If that email exists, a reset link has been sent',
      });
      expect(passwordResetTokenRepository.save).not.toHaveBeenCalled();
      expect(emailService.sendPasswordResetNotification).not.toHaveBeenCalled();
    });
  });

  describe('getTenantContext', () => {
    it('should return tenant context when exactly one tenant exists', async () => {
      tenantRepository.find.mockResolvedValue([
        {
          id: MOCK_TENANT_ID,
          name: 'Elite Padel',
          createdAt: new Date(),
        },
      ]);

      const result = await service.getTenantContext();

      expect(result).toEqual({
        id: MOCK_TENANT_ID,
        name: 'Elite Padel',
      });
    });

    it('should throw when no tenant exists', async () => {
      tenantRepository.find.mockResolvedValue([]);

      await expect(service.getTenantContext()).rejects.toThrow(
        NotFoundException
      );
      await expect(service.getTenantContext()).rejects.toThrow(
        'No tenant is configured'
      );
    });

    it('should throw when multiple tenants exist', async () => {
      tenantRepository.find.mockResolvedValue([
        { id: 'tenant-1', name: 'Tenant 1', createdAt: new Date() },
        { id: 'tenant-2', name: 'Tenant 2', createdAt: new Date() },
      ]);

      await expect(service.getTenantContext()).rejects.toThrow(
        BadRequestException
      );
      await expect(service.getTenantContext()).rejects.toThrow(
        'Tenant ID is required'
      );
    });
  });
});
