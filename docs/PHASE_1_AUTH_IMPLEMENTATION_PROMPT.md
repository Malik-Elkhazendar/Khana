# Phase 1: Complete Authentication System Implementation Prompt

**Status**: BLOCKER-1 (Critical - Blocks All Features)
**Priority**: 🔴 CRITICAL
**Estimated Effort**: 20-30 hours (Full-time developer: 2-3 weeks)
**Target Completion**: End of current sprint
**Authority**: Principal Architect | Created: 2026-01-23

---

## EXECUTIVE SUMMARY

This document provides a complete, detailed implementation blueprint for Phase 1 Authentication—the critical blocker preventing all user-facing features from shipping to production.

### Why This Matters

Per DECISION_FRAMEWORK.md Constraint 1: **No Auth = No Production**

Currently:

- ❌ No authentication system exists
- ❌ No user database
- ❌ No permission system
- ❌ All features are shipping without user identification

**Result**: Data privacy violations, GDPR non-compliance, security critical risk.

### What This Implementation Delivers

After completing Phase 1:

- ✅ Users can register and log in
- ✅ JWT tokens issued with refresh rotation
- ✅ All API routes protected by guards
- ✅ Role-based access control (OWNER, MANAGER, STAFF, VIEWER)
- ✅ Audit logging for compliance
- ✅ Multi-tenant data isolation
- ✅ Production-ready security posture

### Unblocks

- booking-calendar, booking-preview, booking-list
- User profile features, Admin dashboard
- Phase 2 Feature Integration
- Phase 3 Payment Integration
- **Production deployment**

---

## PART 1: BACKEND IMPLEMENTATION (NestJS)

### 1.1 Database & Entity Design

#### 1.1.1 User Entity (`libs/data-access/src/lib/entities/user.entity.ts`)

**Design Principles**:

- TypeORM entity with UUID primary key (matches tenant/facility pattern)
- Tenant scoping for multi-tenancy
- Password stored as bcrypt hash (never plaintext)
- Soft delete support for GDPR compliance
- Audit timestamps (createdAt, updatedAt, lastLoginAt)
- Role assignment at user level (no separate role table initially)

```typescript
import { Column, CreateDateColumn, DeleteDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn, Unique, Index } from 'typeorm';
import { UserRole } from '@khana/shared-dtos';
import { Tenant } from './tenant.entity';
import { Booking } from './booking.entity';
import { AuditLog } from './audit-log.entity';

/**
 * User Entity
 *
 * Represents staff/admin users (not customers).
 * Scoped to tenant for multi-tenancy.
 * Password hashed with bcrypt.
 */
@Entity({ name: 'users' })
@Unique('users_email_tenant_unique', ['email', 'tenant'])
@Index('users_tenant_idx', ['tenant'])
@Index('users_email_idx', ['email'])
@Index('users_is_active_idx', ['isActive'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  // Foreign key to tenant (multi-tenancy)
  @ManyToOne(() => Tenant, { eager: true, nullable: false, onDelete: 'CASCADE' })
  tenant!: Tenant;

  @Column({ type: 'varchar', length: 255 })
  email!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phone?: string;

  // Bcrypt hashed password (never expose)
  @Column({ type: 'varchar', length: 255, select: false })
  password!: string;

  // Role-based access control
  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.STAFF,
  })
  role!: UserRole;

  // User status
  @Column({ type: 'boolean', default: true })
  isActive!: boolean;

  // Last login tracking (optional, for analytics)
  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt?: Date;

  // Refresh token storage (for token rotation)
  @Column({ type: 'varchar', nullable: true, select: false })
  refreshToken?: string;

  // Soft delete for GDPR compliance
  @DeleteDateColumn({ nullable: true })
  deletedAt?: Date;

  // Audit timestamps
  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // Relations (optional, depends on usage)
  @OneToMany(() => Booking, (booking) => booking.user)
  bookings?: Booking[];

  @OneToMany(() => AuditLog, (log) => log.user)
  auditLogs?: AuditLog[];
}
```

**Key Decisions**:

- `@Unique('users_email_tenant_unique')`: Email unique per tenant (allows email reuse across tenants)
- `password` has `select: false` to prevent accidental exposure in queries
- `refreshToken` has `select: false` for security
- `lastLoginAt` nullable for users who haven't logged in yet
- Soft delete via `DeleteDateColumn` for GDPR compliance
- Foreign key to Tenant (multi-tenancy foundation)

#### 1.1.2 Update Booking Entity

**Current State**: Booking exists in `libs/data-access/src/lib/entities/booking.entity.ts` without user reference.

**Required Change**: Add user relationship

```typescript
import { User } from './user.entity';

@Entity({ name: 'bookings' })
export class Booking {
  // ... existing fields ...

  // NEW: Foreign key to user (ownership tracking)
  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  user!: User;

  // ... rest of entity ...
}
```

**Why**: Every booking must be scoped to a user. This is non-negotiable for multi-tenancy.

#### 1.1.3 AuditLog Entity (`libs/data-access/src/lib/entities/audit-log.entity.ts`)

**Design**: Immutable audit trail for compliance

```typescript
import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, Index } from 'typeorm';
import { User } from './user.entity';
import { Tenant } from './tenant.entity';

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
}

@Entity({ name: 'audit_logs' })
@Index('audit_logs_tenant_idx', ['tenant'])
@Index('audit_logs_user_idx', ['user'])
@Index('audit_logs_created_at_idx', ['createdAt'])
@Index('audit_logs_action_idx', ['action'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Tenant, { nullable: false, onDelete: 'CASCADE' })
  tenant!: Tenant;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  user?: User;

  @Column({ type: 'enum', enum: AuditAction })
  action!: AuditAction;

  @Column({ type: 'varchar', length: 100 })
  entityType!: string; // e.g., 'Booking', 'User'

  @Column({ type: 'uuid' })
  entityId!: string;

  @Column({ type: 'jsonb', nullable: true })
  changes?: Record<string, unknown>; // Before/after values

  @Column({ type: 'varchar', nullable: true })
  description?: string;

  @CreateDateColumn()
  createdAt!: Date;
}
```

**Key Decisions**:

- Immutable: only CREATE operations, never UPDATE/DELETE
- JSONB for flexible change tracking
- Indexed by tenant, user, date, action for fast querying
- Soft-safe: User can be deleted, but audit entry remains (SET NULL)

---

### 1.2 Authentication Module Structure

#### 1.2.1 Module Organization

```
apps/api/src/app/auth/
├── auth.module.ts
├── auth.service.ts
├── auth.controller.ts
├── strategies/
│   ├── jwt.strategy.ts          # JWT validation
│   └── local.strategy.ts        # Optional: username/password
├── guards/
│   ├── jwt-auth.guard.ts        # @UseGuards(JwtAuthGuard)
│   ├── roles.guard.ts           # @UseGuards(RolesGuard)
│   └── optional-jwt.guard.ts    # For public endpoints
├── decorators/
│   ├── current-user.decorator.ts # @CurrentUser()
│   ├── roles.decorator.ts       # @Roles(UserRole.ADMIN)
│   ├── public.decorator.ts      # @Public()
│   └── auth.decorators.ts       # Combined exports
├── services/
│   ├── password.service.ts      # Bcrypt hashing
│   └── jwt.service.ts           # Token management
├── dto/
│   ├── auth.dto.ts              # RegisterDto, LoginDto, etc.
│   └── index.ts
└── __tests__/
    ├── auth.service.spec.ts
    ├── jwt.strategy.spec.ts
    ├── auth.controller.spec.ts
    └── guards.spec.ts
```

**Rationale**: Mirrors NestJS best practices; auth concerns isolated; easy to test; guards/decorators reusable across app.

#### 1.2.2 Dependencies to Install

```bash
npm install @nestjs/passport @nestjs/jwt passport passport-jwt passport-local bcrypt

npm install --save-dev @types/bcrypt @types/passport-jwt
```

**Why Each**:

- `@nestjs/passport`: NestJS passport integration
- `@nestjs/jwt`: JWT token management
- `passport`: Authentication middleware library
- `passport-jwt`: JWT strategy
- `passport-local`: Optional: basic auth strategy
- `bcrypt`: Industry-standard password hashing

---

### 1.3 Authentication Service Implementation

#### 1.3.1 Password Service (`auth/services/password.service.ts`)

```typescript
import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PasswordService {
  private readonly SALT_ROUNDS = 10;

  /**
   * Hash a plaintext password with bcrypt
   *
   * Cost: ~100-150ms on modern hardware (intentional slowness defeats brute force)
   */
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.SALT_ROUNDS);
  }

  /**
   * Verify plaintext password against bcrypt hash
   *
   * Returns true if password matches, false otherwise.
   */
  async verify(plaintext: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plaintext, hash);
  }
}
```

**Key Points**:

- SALT_ROUNDS = 10 is OWASP-recommended balance between security and performance
- Never store plaintext passwords
- Never concatenate salt (bcrypt handles it internally)
- Compare time: ~100-150ms (acceptable overhead)

#### 1.3.2 JWT Service (`auth/services/jwt.service.ts`)

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService as NestJwtService } from '@nestjs/jwt';

export interface JwtPayload {
  sub: string; // User ID
  email: string;
  role: string;
  tenantId: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class JwtService {
  constructor(private readonly jwtService: NestJwtService) {}

  /**
   * Generate access token (short-lived, 15 minutes)
   */
  generateAccessToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload, {
      expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m',
    });
  }

  /**
   * Generate refresh token (long-lived, 7 days)
   *
   * Used to issue new access tokens without re-login.
   */
  generateRefreshToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d',
      secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    });
  }

  /**
   * Generate both tokens for login response
   */
  generateTokenPair(payload: JwtPayload): TokenResponse {
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);
    const decoded = this.jwtService.decode(accessToken) as { exp?: number };
    const expiresIn = decoded?.exp ? decoded.exp * 1000 - Date.now() : 900000; // 15 min default

    return {
      accessToken,
      refreshToken,
      expiresIn,
    };
  }

  /**
   * Verify and decode access token
   */
  verifyAccessToken(token: string): JwtPayload {
    try {
      return this.jwtService.verify(token) as JwtPayload;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  /**
   * Verify and decode refresh token
   */
  verifyRefreshToken(token: string): JwtPayload {
    try {
      return this.jwtService.verify(token, {
        secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      }) as JwtPayload;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }
}
```

**Key Decisions**:

- Access token: 15 minutes (short-lived, reduces exposure window)
- Refresh token: 7 days (long-lived, allows token rotation)
- Separate secrets optional (best practice: different secrets)
- All tokens include tenantId (multi-tenancy enforcement)

#### 1.3.3 Auth Service (`auth/auth.service.ts`)

```typescript
import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@khana/data-access';
import { UserDto, UserRole, CreateUserDto, LoginDto } from '@khana/shared-dtos';
import { PasswordService } from './password.service';
import { JwtService, JwtPayload } from './jwt.service';

/**
 * Authentication Service
 *
 * Responsibilities:
 * - User registration with validation
 * - Login with credential verification
 * - Token refresh for rotation
 * - User lookup by email (multi-tenant aware)
 * - Password changes
 */
@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly passwordService: PasswordService,
    private readonly jwtService: JwtService
  ) {}

  /**
   * Register a new user
   *
   * Validation:
   * - Email must be unique within tenant
   * - Password must meet requirements
   * - First user becomes OWNER (no explicit role assignment)
   */
  async register(dto: CreateUserDto, tenantId: string): Promise<UserDto> {
    // Validate password strength
    this.validatePasswordStrength(dto.password);

    // Check email uniqueness within tenant
    const existingUser = await this.userRepository.findOne({
      where: { email: dto.email, tenant: { id: tenantId } },
    });

    if (existingUser) {
      throw new ConflictException(`Email ${dto.email} already registered in this tenant`);
    }

    // Hash password
    const hashedPassword = await this.passwordService.hash(dto.password);

    // Determine initial role (first user = OWNER, others = STAFF)
    const userCount = await this.userRepository.count({
      where: { tenant: { id: tenantId } },
    });
    const initialRole = userCount === 0 ? UserRole.OWNER : UserRole.STAFF;

    // Create user
    const user = this.userRepository.create({
      email: dto.email,
      name: dto.name,
      phone: dto.phone,
      password: hashedPassword,
      role: dto.role || initialRole,
      tenant: { id: tenantId },
      isActive: true,
    });

    const saved = await this.userRepository.save(user);

    // Return DTO (never expose password)
    return this.toUserDto(saved);
  }

  /**
   * Login user with email and password
   *
   * Returns JWT tokens and user info
   */
  async login(dto: LoginDto, tenantId: string) {
    // Find user by email within tenant
    const user = await this.userRepository.findOne({
      where: { email: dto.email, tenant: { id: tenantId } },
      select: ['id', 'email', 'name', 'password', 'role', 'isActive', 'tenant'],
    });

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    // Verify password
    const passwordValid = await this.passwordService.verify(dto.password, user.password);

    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // Update last login
    await this.userRepository.update(user.id, {
      lastLoginAt: new Date(),
    });

    // Generate tokens
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenant.id,
    };

    const tokens = this.jwtService.generateTokenPair(payload);

    // Store refresh token in DB (for revocation support)
    await this.userRepository.update(user.id, {
      refreshToken: tokens.refreshToken,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      user: this.toUserDto(user),
    };
  }

  /**
   * Refresh access token using refresh token
   *
   * Pattern: Token Rotation (refresh token used once, new pair issued)
   */
  async refreshToken(refreshToken: string, userId: string) {
    // Verify refresh token
    const payload = this.jwtService.verifyRefreshToken(refreshToken);

    // Ensure token belongs to user
    if (payload.sub !== userId) {
      throw new UnauthorizedException('Token user mismatch');
    }

    // Verify refresh token in DB (check it wasn't revoked)
    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'refreshToken', 'role', 'email', 'isActive', 'tenant'],
    });

    if (!user || user.refreshToken !== refreshToken) {
      throw new UnauthorizedException('Refresh token invalid or revoked');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    // Issue new token pair
    const newPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenant.id,
    };

    const newTokens = this.jwtService.generateTokenPair(newPayload);

    // Store new refresh token
    await this.userRepository.update(user.id, {
      refreshToken: newTokens.refreshToken,
    });

    return {
      accessToken: newTokens.accessToken,
      refreshToken: newTokens.refreshToken,
      expiresIn: newTokens.expiresIn,
    };
  }

  /**
   * Logout user by invalidating refresh token
   */
  async logout(userId: string): Promise<void> {
    await this.userRepository.update(userId, {
      refreshToken: null,
    });
  }

  /**
   * Get user by ID (for current user info)
   */
  async getCurrentUser(userId: string): Promise<UserDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toUserDto(user);
  }

  /**
   * Change user password
   *
   * Requires old password verification
   */
  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    this.validatePasswordStrength(newPassword);

    const user = await this.userRepository.findOne({
      where: { id: userId },
      select: ['id', 'password'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const oldPasswordValid = await this.passwordService.verify(oldPassword, user.password);

    if (!oldPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const hashedPassword = await this.passwordService.hash(newPassword);
    await this.userRepository.update(userId, {
      password: hashedPassword,
      refreshToken: null, // Invalidate all sessions
    });
  }

  // Private helpers

  private validatePasswordStrength(password: string): void {
    if (!password || password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters long');
    }

    const hasNumber = /\d/.test(password);
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);

    if (!hasNumber || !hasUpperCase || !hasLowerCase) {
      throw new BadRequestException('Password must contain uppercase, lowercase, and numbers');
    }
  }

  private toUserDto(user: User): UserDto {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      tenantId: user.tenant?.id || 'unknown',
    };
  }
}
```

**Key Patterns**:

- Password hashing on registration and change (never stored plaintext)
- Refresh token rotation: new token issued, old revoked
- Multi-tenant scoping: all queries filtered by tenant
- Clear error messages without exposing data (e.g., "Invalid email or password", not "email not found")
- LastLoginAt tracking (optional analytics)

---

### 1.4 JWT Strategy & Passport Integration

#### 1.4.1 JWT Strategy (`auth/strategies/jwt.strategy.ts`)

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '@khana/data-access';
import { JwtPayload } from '../services/jwt.service';

/**
 * JWT Strategy
 *
 * Validates JWT tokens on protected routes.
 * Called automatically by @UseGuards(AuthGuard('jwt'))
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET,
    });
  }

  /**
   * Validate token payload
   *
   * Called by Passport after signature verification.
   * Attach user to request.user
   */
  async validate(payload: JwtPayload): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    return user;
  }
}
```

**Key Points**:

- `ExtractJwt.fromAuthHeaderAsBearerToken()`: Reads "Authorization: Bearer <token>"
- `ignoreExpiration: false`: Reject expired tokens
- `validate()`: Double-check user exists and is active (handles user deletion/deactivation after token issue)

---

### 1.5 Guards & Decorators

#### 1.5.1 JWT Auth Guard (`auth/guards/jwt-auth.guard.ts`)

```typescript
import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * JWT Auth Guard
 *
 * Usage: @UseGuards(JwtAuthGuard)
 *
 * Blocks unauthenticated requests unless endpoint marked with @Public()
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // Check if endpoint is marked @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);

    if (isPublic) {
      return true;
    }

    // Require JWT
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Authentication required');
    }
    return user;
  }
}
```

**Key Feature**: `@Public()` decorator allows exempting endpoints (login, register) from auth.

#### 1.5.2 Roles Guard (`auth/guards/roles.guard.ts`)

```typescript
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@khana/shared-dtos';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Roles Guard
 *
 * Usage: @UseGuards(JwtAuthGuard, RolesGuard) @Roles(UserRole.ADMIN)
 *
 * Enforces role-based access control
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);

    // No roles required = allow all authenticated users
    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('User not found');
    }

    // Check if user has required role
    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(`Forbidden: requires one of ${requiredRoles.join(', ')}`);
    }

    return true;
  }
}
```

#### 1.5.3 Decorators (`auth/decorators/auth.decorators.ts`)

```typescript
import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserRole } from '@khana/shared-dtos';
import { User } from '@khana/data-access';

/**
 * @Public()
 *
 * Mark endpoint as public (no auth required)
 * Usage: @Public() @Get('login')
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * @Roles(UserRole.ADMIN, UserRole.MANAGER)
 *
 * Restrict endpoint to specific roles
 * Usage: @Roles(UserRole.ADMIN) @Delete('users/:id')
 *
 * Must be used with RolesGuard
 */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/**
 * @CurrentUser()
 *
 * Inject current user from JWT payload
 * Usage: getCurrentUser(@CurrentUser() user: User)
 */
export const CurrentUser = createParamDecorator((data: unknown, ctx: ExecutionContext): User => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});

/**
 * @TenantId()
 *
 * Inject tenant ID from JWT payload
 * Usage: getTenantData(@TenantId() tenantId: string)
 */
export const TenantId = createParamDecorator((data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest();
  return request.user?.tenant?.id || 'unknown';
});
```

---

### 1.6 Auth Controller

#### 1.6.1 Endpoints (`auth/auth.controller.ts`)

```typescript
import { Controller, Post, Body, UseGuards, Get, HttpCode, HttpStatus, Req, Res } from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { CreateUserDto, LoginDto, ChangePasswordDto, UserDto } from '@khana/shared-dtos';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Public, CurrentUser, Roles, TenantId } from './decorators/auth.decorators';
import { User } from '@khana/data-access';
import { UserRole } from '@khana/shared-dtos';

/**
 * Auth Controller
 *
 * Routes: POST /api/v1/auth/register
 *         POST /api/v1/auth/login
 *         POST /api/v1/auth/refresh
 *         POST /api/v1/auth/logout
 *         GET  /api/v1/auth/me
 */
@Controller({
  path: 'auth',
  version: '1',
})
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Register a new user
   *
   * POST /api/v1/auth/register
   *
   * Body: { email, password, name, phone?, role? }
   *
   * Errors:
   * - 400: Validation error (weak password, invalid email)
   * - 409: Email already registered
   */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: CreateUserDto, @TenantId() tenantId: string): Promise<{ user: UserDto }> {
    const user = await this.authService.register(dto, tenantId);
    return { user };
  }

  /**
   * Login with email and password
   *
   * POST /api/v1/auth/login
   *
   * Body: { email, password }
   *
   * Response:
   * {
   *   accessToken: string,
   *   refreshToken: string,
   *   expiresIn: number (ms),
   *   user: UserDto
   * }
   *
   * Errors:
   * - 401: Invalid credentials or inactive user
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @TenantId() tenantId: string) {
    return this.authService.login(dto, tenantId);
  }

  /**
   * Refresh access token
   *
   * POST /api/v1/auth/refresh
   *
   * Body: { refreshToken: string }
   *
   * Response:
   * {
   *   accessToken: string,
   *   refreshToken: string (new),
   *   expiresIn: number (ms)
   * }
   *
   * Errors:
   * - 401: Invalid or expired refresh token
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body('refreshToken') refreshToken: string, @CurrentUser() user: User) {
    return this.authService.refreshToken(refreshToken, user.id);
  }

  /**
   * Logout (invalidate refresh tokens)
   *
   * POST /api/v1/auth/logout
   *
   * Requires: JWT auth
   *
   * Response: 204 No Content
   */
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() user: User): Promise<void> {
    await this.authService.logout(user.id);
  }

  /**
   * Get current user info
   *
   * GET /api/v1/auth/me
   *
   * Requires: JWT auth
   *
   * Response: UserDto
   */
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getCurrentUser(@CurrentUser() user: User): Promise<UserDto> {
    return this.authService.getCurrentUser(user.id);
  }

  /**
   * Change password
   *
   * POST /api/v1/auth/change-password
   *
   * Requires: JWT auth
   *
   * Body: { currentPassword, newPassword }
   *
   * Response: 204 No Content
   *
   * Errors:
   * - 401: Current password incorrect
   * - 400: New password doesn't meet requirements
   */
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(@CurrentUser() user: User, @Body() dto: ChangePasswordDto): Promise<void> {
    await this.authService.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }
}
```

**API Contract**:

- All endpoints return JSON (no redirects)
- Public endpoints don't require auth
- Protected endpoints require: `Authorization: Bearer <token>`
- 401: Unauthenticated (missing/expired token)
- 403: Unauthorized (insufficient permissions)
- 400/409: Validation errors

---

### 1.7 Auth Module Setup

#### 1.7.1 Module File (`auth/auth.module.ts`)

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '@khana/data-access';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PasswordService } from './services/password.service';
import { JwtService } from './services/jwt.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: {
          expiresIn: configService.get('JWT_ACCESS_EXPIRES') || '15m',
        },
      }),
      inject: [ConfigService],
    }),
    TypeOrmModule.forFeature([User]),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, JwtService, JwtStrategy, JwtAuthGuard, RolesGuard],
  exports: [AuthService, PasswordService, JwtService, JwtAuthGuard, RolesGuard],
})
export class AuthModule {}
```

#### 1.7.2 App Module Integration (`app.module.ts`)

**Update to include AuthModule**:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BookingsModule } from './bookings/bookings.module';
import { SeedService } from './seed.service';
import { Facility, Tenant, User, AuditLog } from '@khana/data-access';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      url: process.env.DATABASE_URL,
      entities: [Tenant, Facility, User, AuditLog], // Add User, AuditLog
      autoLoadEntities: true,
      synchronize: process.env.NODE_ENV !== 'production',
    }),
    TypeOrmModule.forFeature([Tenant, Facility, User, AuditLog]),
    AuthModule, // NEW
    BookingsModule,
  ],
  controllers: [AppController],
  providers: [AppService, SeedService],
})
export class AppModule {}
```

---

### 1.8 Apply Auth Guards to Existing Routes

**Update `bookings.controller.ts`**:

```typescript
import { Controller, Post, Body, Get, UseGuards, Param, Patch, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, CurrentUser } from '../auth/decorators/auth.decorators';
import { User } from '@khana/data-access';
import { UserRole } from '@khana/shared-dtos';
import { BookingsService } from './bookings.service';
import { BookingPreviewRequestDto, CreateBookingDto, UpdateBookingStatusDto } from './dto';

@Controller({
  path: 'bookings',
  version: '1',
})
@UseGuards(JwtAuthGuard, RolesGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('facilities')
  async getFacilities() {
    return this.bookingsService.getFacilities();
  }

  @Get()
  async getBookings(@Query('facilityId') facilityId?: string, @CurrentUser() user: User) {
    // TODO: Scope bookings to current user
    return this.bookingsService.findAll(facilityId);
  }

  @Post('preview')
  async previewBooking(@Body() dto: BookingPreviewRequestDto) {
    return this.bookingsService.previewBooking(dto);
  }

  @Post()
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  async createBooking(@Body() dto: CreateBookingDto, @CurrentUser() user: User) {
    // TODO: Attach user ID to booking
    return this.bookingsService.createBooking(dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.OWNER, UserRole.MANAGER)
  async updateStatus(@Param('id') id: string, @Body() dto: UpdateBookingStatusDto, @CurrentUser() user: User) {
    // TODO: Verify user owns this booking
    return this.bookingsService.updateStatus(id, dto);
  }
}
```

**Changes**:

- `@UseGuards(JwtAuthGuard, RolesGuard)`: All routes require auth
- `@Roles(...)`: Role-based restrictions
- `@CurrentUser()`: Inject current user
- TODO comments: Phase 2 (data scoping)

---

### 1.9 Environment Configuration

**Update `.env`**:

```bash
# Database
DATABASE_URL=postgres://user:password@localhost:5432/khana

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d
JWT_REFRESH_SECRET=your-super-secret-refresh-key-different-from-jwt-secret

# Server
PORT=3000
NODE_ENV=development
```

**Security Notes**:

- Change JWT_SECRET in production (use strong random key)
- Separate refresh secret from access secret (best practice)
- Store in secure vault (AWS Secrets Manager, HashiCorp Vault)
- Never commit to git (use .env.example template)

---

## PART 2: FRONTEND IMPLEMENTATION (Angular)

### 2.1 Frontend State Management (SignalStore)

#### 2.1.1 Auth Store (`apps/manager-dashboard/src/app/state/auth/auth.store.ts`)

**Design**: SignalStore per ADR-0001

```typescript
import { Injectable, computed } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { UserDto } from '@khana/shared-dtos';

export interface AuthState {
  user: UserDto | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isLoading: false,
  error: null,
  isAuthenticated: false,
};

@Injectable({ providedIn: 'root' })
export class AuthStore extends signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ isAuthenticated }) => ({
    isLoggedIn: computed(() => isAuthenticated()),
  })),
  withMethods((store) => ({
    setUser(user: UserDto | null) {
      patchState(store, { user });
    },

    setTokens(accessToken: string, refreshToken: string) {
      patchState(store, { accessToken, refreshToken, isAuthenticated: !!accessToken });
    },

    setLoading(isLoading: boolean) {
      patchState(store, { isLoading });
    },

    setError(error: string | null) {
      patchState(store, { error });
    },

    logout() {
      patchState(store, {
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        error: null,
      });
    },
  }))
) {}
```

**Key Points**:

- `isAuthenticated`: Simple boolean flag
- `@computed` for derived state (isLoggedIn)
- Methods for state mutations
- Signals-based (modern Angular approach)

---

### 2.2 Auth Service

#### 2.2.1 Auth Service (`apps/manager-dashboard/src/app/shared/services/auth.service.ts`)

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap, catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';
import { LoginDto, UserDto } from '@khana/shared-dtos';
import { AuthStore } from '../../state/auth/auth.store';
import { ApiService } from './api.service';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: UserDto;
}

interface RegisterResponse {
  user: UserDto;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly authStore = inject(AuthStore);
  private readonly apiService = inject(ApiService);

  private readonly API_URL = '/api/v1/auth';

  /**
   * Register a new user
   */
  register(email: string, password: string, name: string) {
    const dto = { email, password, name };

    return this.http.post<RegisterResponse>(`${this.API_URL}/register`, dto).pipe(
      tap((response) => {
        this.authStore.setUser(response.user);
      }),
      catchError((error) => {
        this.authStore.setError(error.error?.message || 'Registration failed');
        return throwError(() => error);
      })
    );
  }

  /**
   * Login with email and password
   */
  login(email: string, password: string) {
    const dto: LoginDto = { email, password };

    this.authStore.setLoading(true);

    return this.http.post<LoginResponse>(`${this.API_URL}/login`, dto).pipe(
      tap((response) => {
        this.authStore.setTokens(response.accessToken, response.refreshToken);
        this.authStore.setUser(response.user);
        this.authStore.setError(null);
        this.authStore.setLoading(false);

        // Store tokens securely
        this.storeTokens(response.accessToken, response.refreshToken);
      }),
      catchError((error) => {
        const message = error.error?.message || 'Login failed';
        this.authStore.setError(message);
        this.authStore.setLoading(false);
        return throwError(() => error);
      })
    );
  }

  /**
   * Logout (invalidate tokens)
   */
  logout() {
    this.http.post(`${this.API_URL}/logout`, {}).subscribe({
      next: () => {
        this.authStore.logout();
        this.clearTokens();
      },
      error: () => {
        // Even if logout API fails, clear local state
        this.authStore.logout();
        this.clearTokens();
      },
    });
  }

  /**
   * Refresh access token using refresh token
   */
  refreshAccessToken() {
    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      return throwError(() => new Error('No refresh token available'));
    }

    return this.http.post<{ accessToken: string; refreshToken: string; expiresIn: number }>(`${this.API_URL}/refresh`, { refreshToken }).pipe(
      tap((response) => {
        this.authStore.setTokens(response.accessToken, response.refreshToken);
        this.storeTokens(response.accessToken, response.refreshToken);
      }),
      catchError((error) => {
        // Refresh failed, user needs to login again
        this.authStore.logout();
        this.clearTokens();
        return throwError(() => error);
      })
    );
  }

  /**
   * Get current user info
   */
  getCurrentUser() {
    return this.http.get<UserDto>(`${this.API_URL}/me`).pipe(
      tap((user) => {
        this.authStore.setUser(user);
      }),
      catchError((error) => {
        this.authStore.logout();
        return throwError(() => error);
      })
    );
  }

  /**
   * Change password
   */
  changePassword(currentPassword: string, newPassword: string) {
    return this.http.post(`${this.API_URL}/change-password`, { currentPassword, newPassword }).pipe(
      tap(() => {
        // Invalidate all tokens after password change
        this.authStore.logout();
        this.clearTokens();
      })
    );
  }

  /**
   * Restore session from stored tokens
   */
  restoreSession() {
    const token = this.getAccessToken();

    if (!token) {
      return;
    }

    // Mark as authenticated based on stored token
    this.authStore.setTokens(token, this.getRefreshToken() || '');

    // Fetch current user info
    this.getCurrentUser().subscribe({
      error: () => {
        // Token invalid, clear auth
        this.authStore.logout();
        this.clearTokens();
      },
    });
  }

  // Token Storage (Secure Client Storage)

  private storeTokens(accessToken: string, refreshToken: string): void {
    // Use sessionStorage for tokens (cleared on browser close)
    // Use localStorage only if user selected "Remember me"
    sessionStorage.setItem('accessToken', accessToken);
    sessionStorage.setItem('refreshToken', refreshToken);
  }

  private getAccessToken(): string | null {
    return sessionStorage.getItem('accessToken');
  }

  private getRefreshToken(): string | null {
    return sessionStorage.getItem('refreshToken');
  }

  private clearTokens(): void {
    sessionStorage.removeItem('accessToken');
    sessionStorage.removeItem('refreshToken');
  }
}
```

**Key Decisions**:

- Use `sessionStorage` for tokens (safer than localStorage, cleared on browser close)
- Tokens not stored in Angular state persisted to disk (volatile session)
- Error handling with user-friendly messages
- Token refresh on 401 (handled in interceptor)
- Logout clears all state and storage

---

### 2.3 HTTP Interceptor

#### 2.3.1 Auth Interceptor (`apps/manager-dashboard/src/app/shared/interceptors/auth.interceptor.ts`)

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpRequest, HttpHandler, HttpEvent, HttpInterceptor, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, filter, take, switchMap } from 'rxjs/operators';
import { AuthStore } from '../../state/auth/auth.store';
import { AuthService } from '../services/auth.service';

/**
 * Auth Interceptor
 *
 * Responsibilities:
 * 1. Add Authorization header to requests
 * 2. Handle 401 with token refresh
 * 3. Prevent multiple simultaneous refreshes
 */
@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private readonly authStore = inject(AuthStore);
  private readonly authService = inject(AuthService);

  private isRefreshing = false;
  private refreshTokenSubject = new BehaviorSubject<string | null>(null);

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Skip auth endpoints
    if (this.isAuthEndpoint(req.url)) {
      return next.handle(req);
    }

    // Add Authorization header
    const token = this.authStore.accessToken();

    if (token) {
      req = this.addToken(req, token);
    }

    return next.handle(req).pipe(
      catchError((error) => {
        if (error instanceof HttpErrorResponse && error.status === 401) {
          return this.handle401(req, next);
        }

        return throwError(() => error);
      })
    );
  }

  private handle401(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      return this.authService.refreshAccessToken().pipe(
        switchMap((response: any) => {
          this.isRefreshing = false;
          this.refreshTokenSubject.next(response.accessToken);
          return next.handle(this.addToken(req, response.accessToken));
        }),
        catchError((error) => {
          this.isRefreshing = false;
          // Refresh failed, logout user
          this.authStore.logout();
          return throwError(() => error);
        })
      );
    } else {
      // Wait for refresh to complete, then retry
      return this.refreshTokenSubject.pipe(
        filter((token) => token != null),
        take(1),
        switchMap((token) => {
          return next.handle(this.addToken(req, token!));
        })
      );
    }
  }

  private addToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
    return req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  private isAuthEndpoint(url: string): boolean {
    return url.includes('/auth/login') || url.includes('/auth/register') || url.includes('/auth/refresh');
  }
}
```

**Key Features**:

- Automatic token injection in Authorization header
- 401 handling with token refresh
- BehaviorSubject prevents multiple simultaneous refresh attempts
- Clear auth endpoints (don't inject token in login/register)

---

### 2.4 Route Guards

#### 2.4.1 Auth Guard (`apps/manager-dashboard/src/app/shared/guards/auth.guard.ts`)

```typescript
import { Injectable, inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { AuthStore } from '../../state/auth/auth.store';

export const authGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.isAuthenticated()) {
    return true;
  }

  // Store redirect URL for post-login navigation
  sessionStorage.setItem('redirectUrl', state.url);
  router.navigate(['/login']);
  return false;
};
```

#### 2.4.2 Public Guard (`apps/manager-dashboard/src/app/shared/guards/public.guard.ts`)

```typescript
import { Injectable, inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthStore } from '../../state/auth/auth.store';

/**
 * Redirect authenticated users away from login/register pages
 */
export const publicGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const router = inject(Router);

  if (authStore.isAuthenticated()) {
    router.navigate(['/dashboard']);
    return false;
  }

  return true;
};
```

#### 2.4.3 Role Guard (`apps/manager-dashboard/src/app/shared/guards/role.guard.ts`)

```typescript
import { Injectable, inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot } from '@angular/router';
import { UserRole } from '@khana/shared-dtos';
import { AuthStore } from '../../state/auth/auth.store';

export const roleGuard = (allowedRoles: UserRole[]): CanActivateFn => {
  return (route: ActivatedRouteSnapshot) => {
    const authStore = inject(AuthStore);
    const router = inject(Router);

    const user = authStore.user();

    if (!user || !allowedRoles.includes(user.role)) {
      router.navigate(['/forbidden']);
      return false;
    }

    return true;
  };
};
```

---

### 2.5 Login Component

#### 2.5.1 Login Component (`apps/manager-dashboard/src/app/features/login/login.component.ts`)

```typescript
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../shared/services/auth.service';
import { AuthStore } from '../../state/auth/auth.store';

@Component({
  selector: 'khana-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="login-container">
      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <h1>Login</h1>

        <div class="form-group">
          <label for="email">Email</label>
          <input id="email" type="email" formControlName="email" placeholder="your@email.com" />
          <small *ngIf="form.get('email')?.hasError('email')"> Enter a valid email </small>
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <input id="password" type="password" formControlName="password" placeholder="••••••••" />
          <small *ngIf="form.get('password')?.hasError('required')"> Password is required </small>
        </div>

        <button type="submit" [disabled]="form.invalid || authStore.isLoading()">
          {{ authStore.isLoading() ? 'Logging in...' : 'Login' }}
        </button>

        <div *ngIf="authStore.error()" class="error-message">
          {{ authStore.error() }}
        </div>

        <p class="register-link">Don't have an account? <a routerLink="/register">Register here</a></p>
      </form>
    </div>
  `,
  styles: [
    `
      .login-container {
        max-width: 400px;
        margin: 100px auto;
        padding: 20px;
      }

      form {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }

      .form-group {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }

      label {
        font-weight: 600;
      }

      input {
        padding: 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
      }

      button {
        padding: 10px;
        background: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
      }

      button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .error-message {
        color: #d32f2f;
        padding: 10px;
        background: #ffebee;
        border-radius: 4px;
      }

      .register-link {
        text-align: center;
        margin-top: 20px;
      }
    `,
  ],
})
export class LoginComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  readonly authStore = inject(AuthStore);

  form = this.formBuilder.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  onSubmit() {
    if (!this.form.valid) return;

    const { email, password } = this.form.value;

    this.authService.login(email!, password!).subscribe({
      next: () => {
        const redirectUrl = sessionStorage.getItem('redirectUrl') || '/dashboard';
        sessionStorage.removeItem('redirectUrl');
        this.router.navigateByUrl(redirectUrl);
      },
      error: () => {
        // Error handled by AuthStore
      },
    });
  }
}
```

---

### 2.6 Route Configuration

#### 2.6.1 App Routes (`apps/manager-dashboard/src/app/app.routes.ts`)

```typescript
import { Routes } from '@angular/router';
import { authGuard } from './shared/guards/auth.guard';
import { publicGuard } from './shared/guards/public.guard';
import { roleGuard } from './shared/guards/role.guard';
import { UserRole } from '@khana/shared-dtos';
import { LoginComponent } from './features/login/login.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';
import { BookingCalendarComponent } from './features/booking-calendar/booking-calendar.component';

export const appRoutes: Routes = [
  // Public routes
  {
    path: 'login',
    component: LoginComponent,
    canActivate: [publicGuard],
  },

  // Protected routes
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard],
  },
  {
    path: 'bookings/calendar',
    component: BookingCalendarComponent,
    canActivate: [authGuard],
  },

  // Admin-only routes
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard([UserRole.OWNER, UserRole.MANAGER])],
    children: [
      // Admin features here
    ],
  },

  // Redirect to dashboard on root
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
];
```

---

### 2.7 App Initialization

#### 2.7.1 App Component (`apps/manager-dashboard/src/app/app.component.ts`)

```typescript
import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './shared/services/auth.service';

@Component({
  selector: 'khana-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet></router-outlet>`,
})
export class AppComponent implements OnInit {
  private readonly authService = inject(AuthService);

  ngOnInit() {
    // Restore session on app init (check for stored tokens)
    this.authService.restoreSession();
  }
}
```

---

## PART 3: DATABASE MIGRATIONS

### 3.1 TypeORM Migrations

**Create migrations** using CLI:

```bash
npx typeorm migration:create apps/api/src/migrations/CreateUserTable
npx typeorm migration:create apps/api/src/migrations/CreateAuditLogTable
npx typeorm migration:create apps/api/src/migrations/AddUserToBooking
```

**Migration: CreateUserTable**

```typescript
import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class CreateUserTable1674000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'tenantId',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'email',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'phone',
            type: 'varchar',
            length: '20',
            isNullable: true,
          },
          {
            name: 'password',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'role',
            type: 'enum',
            enum: ['OWNER', 'MANAGER', 'STAFF', 'VIEWER'],
            default: "'STAFF'",
          },
          {
            name: 'isActive',
            type: 'boolean',
            default: true,
          },
          {
            name: 'lastLoginAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'refreshToken',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'deletedAt',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'createdAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updatedAt',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
        foreignKeys: [
          {
            name: 'FK_users_tenant',
            columnNames: ['tenantId'],
            referencedTableName: 'tenants',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
        indices: [new TableIndex({ name: 'users_email_tenant_unique', columns: ['email', 'tenantId'], isUnique: true }), new TableIndex({ name: 'users_tenant_idx', columns: ['tenantId'] }), new TableIndex({ name: 'users_is_active_idx', columns: ['isActive'] })],
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('users');
  }
}
```

---

## PART 4: TESTING STRATEGY

### 4.1 Backend Tests

#### 4.1.1 Auth Service Tests (`auth/__tests__/auth.service.spec.ts`)

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { User } from '@khana/data-access';
import { UserRole } from '@khana/shared-dtos';
import { AuthService } from '../auth.service';
import { PasswordService } from '../services/password.service';
import { JwtService } from '../services/jwt.service';

describe('AuthService', () => {
  let service: AuthService;
  let userRepository: any;
  let passwordService: PasswordService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        PasswordService,
        {
          provide: JwtService,
          useValue: {
            generateTokenPair: jest.fn().mockReturnValue({
              accessToken: 'access-token',
              refreshToken: 'refresh-token',
              expiresIn: 900000,
            }),
            verifyRefreshToken: jest.fn(),
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
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepository = module.get(getRepositoryToken(User));
    passwordService = module.get<PasswordService>(PasswordService);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('register', () => {
    it('should register a new user', async () => {
      const dto = { email: 'test@example.com', password: 'Password123', name: 'Test User' };
      const tenantId = 'tenant-1';

      userRepository.findOne.mockResolvedValue(null);
      userRepository.count.mockResolvedValue(0);
      const createdUser = { id: 'user-1', ...dto, role: UserRole.OWNER };
      userRepository.create.mockReturnValue(createdUser);
      userRepository.save.mockResolvedValue(createdUser);

      const result = await service.register(dto, tenantId);

      expect(result).toHaveProperty('email', 'test@example.com');
      expect(userRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          name: 'Test User',
          role: UserRole.OWNER,
        })
      );
    });

    it('should throw ConflictException if email exists', async () => {
      const dto = { email: 'existing@example.com', password: 'Password123', name: 'Test User' };
      const tenantId = 'tenant-1';

      userRepository.findOne.mockResolvedValue({ id: 'existing-user' });

      await expect(service.register(dto, tenantId)).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException for weak password', async () => {
      const dto = { email: 'test@example.com', password: 'weak', name: 'Test User' };
      const tenantId = 'tenant-1';

      await expect(service.register(dto, tenantId)).rejects.toThrow('Password must be at least 8 characters');
    });
  });

  describe('login', () => {
    it('should login user and return tokens', async () => {
      const dto = { email: 'test@example.com', password: 'Password123' };
      const tenantId = 'tenant-1';
      const user = {
        id: 'user-1',
        email: 'test@example.com',
        password: '$2b$10$...',
        role: UserRole.MANAGER,
        isActive: true,
        tenant: { id: tenantId },
      };

      userRepository.findOne.mockResolvedValue(user);
      jest.spyOn(passwordService, 'verify').mockResolvedValue(true);

      const result = await service.login(dto, tenantId);

      expect(result).toHaveProperty('accessToken', 'access-token');
      expect(result).toHaveProperty('user');
      expect(userRepository.update).toHaveBeenCalledWith(user.id, expect.any(Object));
    });

    it('should throw UnauthorizedException for invalid credentials', async () => {
      const dto = { email: 'test@example.com', password: 'WrongPassword' };
      const tenantId = 'tenant-1';

      userRepository.findOne.mockResolvedValue(null);

      await expect(service.login(dto, tenantId)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if user inactive', async () => {
      const dto = { email: 'test@example.com', password: 'Password123' };
      const tenantId = 'tenant-1';
      const user = {
        id: 'user-1',
        email: 'test@example.com',
        isActive: false,
      };

      userRepository.findOne.mockResolvedValue(user);

      await expect(service.login(dto, tenantId)).rejects.toThrow('User account is inactive');
    });
  });
});
```

### 4.2 Guard Tests

#### 4.2.1 JwtAuthGuard Tests

```typescript
describe('JwtAuthGuard', () => {
  it('should allow @Public() endpoints', async () => {
    // Test that @Public() decorator bypasses guard
  });

  it('should block requests without JWT token', async () => {
    // Test that requests without auth header are rejected
  });

  it('should allow requests with valid JWT', async () => {
    // Test that valid tokens pass through
  });
});
```

### 4.3 Frontend Tests

#### 4.3.1 Auth Service Tests

```typescript
describe('AuthService', () => {
  it('should store tokens in sessionStorage', () => {
    // Test token storage
  });

  it('should add Authorization header to requests', () => {
    // Test interceptor
  });

  it('should refresh token on 401', () => {
    // Test token refresh logic
  });
});
```

---

## PART 5: SECURITY CHECKLIST

### 5.1 Backend Security

- [ ] ✅ Passwords hashed with bcrypt (SALT_ROUNDS = 10)
- [ ] ✅ JWT secret stored in environment variables
- [ ] ✅ Refresh token stored in database (can be revoked)
- [ ] ✅ Tokens include tenantId (multi-tenancy enforcement)
- [ ] ✅ All protected routes use JwtAuthGuard
- [ ] ✅ Role-based access control via RolesGuard
- [ ] ✅ Password validation (min 8 chars, uppercase, lowercase, number)
- [ ] ✅ OWASP - Input validation (ValidationPipe with whitelist)
- [ ] ✅ OWASP - SQL injection prevention (TypeORM parameterized queries)
- [ ] ✅ OWASP - XSS prevention (Angular sanitization)
- [ ] ✅ OWASP - CSRF protection (SameSite cookies)
- [ ] ✅ Error messages don't expose internal details
- [ ] ✅ Audit logging for all mutations
- [ ] ✅ GDPR-compliant soft delete support

### 5.2 Frontend Security

- [ ] ✅ Tokens stored in sessionStorage (not localStorage by default)
- [ ] ✅ No sensitive data in state (never log tokens)
- [ ] ✅ HTTPS enforced in production
- [ ] ✅ HttpOnly flag on cookies (if using cookies)
- [ ] ✅ SameSite attribute on cookies
- [ ] ✅ CORS properly configured
- [ ] ✅ Content Security Policy headers
- [ ] ✅ No hardcoded API URLs (environment-based)

---

## PART 6: DEPLOYMENT CHECKLIST

### 6.1 Pre-Production

- [ ] All tests passing (>80% coverage target)
- [ ] TypeScript strict mode enabled
- [ ] No console.log statements (remove debugging)
- [ ] Environment variables configured for production
- [ ] JWT_SECRET changed to strong random key
- [ ] Database backup strategy in place
- [ ] Monitoring/logging configured
- [ ] HTTPS/TLS certificates installed
- [ ] Security headers configured (CSP, HSTS, etc.)
- [ ] Rate limiting configured on auth endpoints
- [ ] Password reset/recovery flow designed
- [ ] Audit logs exportable for compliance

### 6.2 Post-Deployment

- [ ] Monitor auth logs for suspicious activity
- [ ] Verify token refresh working
- [ ] Test password reset flow
- [ ] Verify audit trail recording
- [ ] Performance monitoring active
- [ ] User feedback collection

---

## PART 7: ROLLOUT PLAN

### Phase 1a: Backend Auth System (1 week)

1. Day 1-2: Entities, repositories, services
2. Day 2-3: Guards, decorators, strategies
3. Day 4: Controller endpoints
4. Day 5: Tests, documentation

### Phase 1b: Frontend Auth (1 week)

1. Day 1: Auth service, store
2. Day 2: Interceptor, guards
3. Day 3: Login component
4. Day 4: Route configuration
5. Day 5: Integration testing

### Phase 1c: Integration & Testing (3-5 days)

1. End-to-end auth flow
2. Token refresh scenarios
3. Security audit
4. Performance testing
5. Load testing

**Total: 2-3 weeks (20-30 hours)**

---

## PART 8: KNOWN RISKS & MITIGATION

### Risk 1: JWT Token Exposure

**Mitigation**:

- Use short expiry (15 minutes)
- Refresh tokens stored server-side (can be revoked)
- HTTPS enforced
- HttpOnly flag on cookies

### Risk 2: Password Brute Force

**Mitigation**:

- Rate limiting on login endpoint (e.g., 5 attempts per minute)
- Bcrypt with 10 salt rounds (100-150ms per verification)
- Account lockout after X failed attempts

### Risk 3: Cross-Site Request Forgery (CSRF)

**Mitigation**:

- SameSite cookies enforced
- CORS properly configured
- Mutation operations use POST (not GET)

### Risk 4: Multi-Tenancy Data Leaks

**Mitigation**:

- All queries filtered by tenantId
- User ownership validation
- Audit logging captures access patterns
- Regular security audits

---

## APPENDIX A: Environment Configuration Template

```bash
# .env.example

# Database
DATABASE_URL=postgres://user:password@localhost:5432/khana

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_SECRET=your-super-secret-refresh-key-different
JWT_REFRESH_EXPIRES=7d

# Server
PORT=3000
NODE_ENV=development

# Frontend
API_BASE_URL=http://localhost:3000/api
```

---

## APPENDIX B: Quick Reference - File Checklist

### Backend Files to Create

- [ ] `libs/data-access/src/lib/entities/user.entity.ts`
- [ ] `libs/data-access/src/lib/entities/audit-log.entity.ts`
- [ ] `apps/api/src/app/auth/auth.module.ts`
- [ ] `apps/api/src/app/auth/auth.service.ts`
- [ ] `apps/api/src/app/auth/auth.controller.ts`
- [ ] `apps/api/src/app/auth/services/password.service.ts`
- [ ] `apps/api/src/app/auth/services/jwt.service.ts`
- [ ] `apps/api/src/app/auth/strategies/jwt.strategy.ts`
- [ ] `apps/api/src/app/auth/guards/jwt-auth.guard.ts`
- [ ] `apps/api/src/app/auth/guards/roles.guard.ts`
- [ ] `apps/api/src/app/auth/decorators/auth.decorators.ts`
- [ ] `apps/api/src/migrations/CreateUserTable.ts`
- [ ] `apps/api/src/migrations/CreateAuditLogTable.ts`
- [ ] `apps/api/src/migrations/AddUserToBooking.ts`

### Frontend Files to Create

- [ ] `apps/manager-dashboard/src/app/state/auth/auth.store.ts`
- [ ] `apps/manager-dashboard/src/app/shared/services/auth.service.ts`
- [ ] `apps/manager-dashboard/src/app/shared/interceptors/auth.interceptor.ts`
- [ ] `apps/manager-dashboard/src/app/shared/guards/auth.guard.ts`
- [ ] `apps/manager-dashboard/src/app/shared/guards/public.guard.ts`
- [ ] `apps/manager-dashboard/src/app/shared/guards/role.guard.ts`
- [ ] `apps/manager-dashboard/src/app/features/login/login.component.ts`

### Files to Update

- [ ] `libs/data-access/src/lib/entities/booking.entity.ts` (add user reference)
- [ ] `apps/api/src/app/app.module.ts` (import AuthModule)
- [ ] `apps/api/src/app/bookings/bookings.controller.ts` (add auth guards)
- [ ] `apps/manager-dashboard/src/app/app.component.ts` (restore session)
- [ ] `apps/manager-dashboard/src/app/app.routes.ts` (add auth guards)
- [ ] `package.json` (add dependencies)

---

## APPENDIX C: Troubleshooting Guide

### "JWT malformed" Error

**Cause**: Token format incorrect
**Fix**: Check interceptor format is "Bearer <token>"

### "User not found" on Login

**Cause**: Email not in database
**Fix**: Ensure user registered first

### Token Refresh Loop

**Cause**: Refresh token also expired or invalid
**Fix**: Force logout, require fresh login

### CORS Error

**Cause**: Frontend URL not in CORS whitelist
**Fix**: Update CORS config in main.ts

---

## CONCLUSION

This Phase 1 implementation blueprint provides everything needed to build a production-ready authentication system. It follows NestJS/Angular best practices, implements OWASP security guidelines, and enables multi-tenancy from the ground up.

**Key Outcome**: Unblocks all Phase 2 features and enables safe production deployment.

**Questions?** Reference the corresponding section or check code comments for additional details.
