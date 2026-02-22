import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  HttpCode,
  HttpStatus,
  Headers,
  Ip,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserDto } from '@khana/shared-dtos';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { TenantId } from './decorators/tenant-id.decorator';
import { User } from '@khana/data-access';
import {
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  LogoutDeviceDto,
  LogoutDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
} from './dto';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';

/**
 * Auth Controller
 *
 * Routes:
 * - POST /api/v1/auth/register
 * - POST /api/v1/auth/login
 * - POST /api/v1/auth/refresh
 * - POST /api/v1/auth/logout
 * - GET  /api/v1/auth/me
 * - POST /api/v1/auth/change-password
 */
@Controller({
  path: 'auth',
  version: '1',
})
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Get('tenant')
  @HttpCode(HttpStatus.OK)
  async getTenantContext() {
    return this.authService.getTenantContext();
  }

  /**
   * Register a new user
   *
   * POST /api/v1/auth/register
   *
   * Body: { email, password, name, phone? }
   *
   * Errors:
   * - 400: Validation error (weak password, invalid email)
   * - 409: Email already registered
   */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @TenantId() tenantId?: string,
    @Ip() ipAddress?: string,
    @Headers('user-agent') userAgent?: string
  ) {
    return this.authService.register(dto, tenantId, ipAddress, userAgent);
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
  async login(
    @Body() dto: LoginDto,
    @TenantId() tenantId?: string,
    @Ip() ipAddress?: string,
    @Headers('user-agent') userAgent?: string
  ) {
    return this.authService.login(dto, tenantId, ipAddress, userAgent);
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
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Ip() ipAddress?: string,
    @Headers('user-agent') userAgent?: string
  ) {
    return this.authService.refreshToken(
      dto.refreshToken,
      ipAddress,
      userAgent
    );
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
  async logout(
    @CurrentUser() user: User & { sid?: string },
    @Body() dto: LogoutDto,
    @Headers('x-refresh-token') headerRefreshToken?: string,
    @Ip() ipAddress?: string,
    @Headers('user-agent') userAgent?: string
  ): Promise<void> {
    await this.authService.logout(
      user.id,
      user.sid,
      dto?.refreshToken || headerRefreshToken,
      ipAddress,
      userAgent
    );
  }

  /**
   * Logout a device/session
   *
   * POST /api/v1/auth/logout-device
   */
  @UseGuards(JwtAuthGuard)
  @Post('logout-device')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutDevice(
    @CurrentUser() user: User,
    @Body() dto: LogoutDeviceDto
  ): Promise<void> {
    await this.authService.logoutDevice(dto.sessionId, user.id);
  }

  /**
   * Logout all devices
   *
   * POST /api/v1/auth/logout-all-devices
   */
  @UseGuards(JwtAuthGuard)
  @Post('logout-all-devices')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAllDevices(
    @CurrentUser() user: User & { sid?: string }
  ): Promise<void> {
    await this.authService.logoutAllDevices(user.id, user.sid);
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
  async changePassword(
    @CurrentUser() user: User & { sid?: string },
    @Body() dto: ChangePasswordDto
  ): Promise<void> {
    await this.authService.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
      user.sid
    );
  }

  /**
   * Request password reset
   *
   * POST /api/v1/auth/forgot-password
   *
   * Body: { email }
   *
   * Always returns 200 to prevent email enumeration.
   */
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @TenantId() tenantId?: string,
    @Ip() ipAddress?: string,
    @Headers('user-agent') userAgent?: string
  ) {
    return this.authService.forgotPassword(
      dto.email,
      tenantId,
      ipAddress,
      userAgent
    );
  }

  /**
   * Reset password with token
   *
   * POST /api/v1/auth/reset-password
   *
   * Body: { token, newPassword }
   *
   * Errors:
   * - 400: Invalid/expired token or weak password
   */
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Ip() ipAddress?: string,
    @Headers('user-agent') userAgent?: string
  ) {
    return this.authService.resetPassword(
      dto.token,
      dto.newPassword,
      ipAddress,
      userAgent
    );
  }
}
