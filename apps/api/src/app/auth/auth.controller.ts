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
  Query,
} from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
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
  SignupOwnerDto,
} from './dto';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiExampleCreatedResponse,
  ApiExampleOkResponse,
  ApiExampleRequestBody,
  ApiJwtAuth,
  ApiOptionalTenantHeader,
  ApiStandardErrorResponses,
} from '../swagger/swagger.decorators';
import {
  SWAGGER_AUTH_LOGIN_REQUEST_EXAMPLE,
  SWAGGER_AUTH_LOGIN_RESPONSE_EXAMPLE,
  SWAGGER_AUTH_MESSAGE_RESPONSE_EXAMPLE,
  SWAGGER_AUTH_REFRESH_REQUEST_EXAMPLE,
  SWAGGER_AUTH_REFRESH_RESPONSE_EXAMPLE,
  SWAGGER_AUTH_REGISTER_REQUEST_EXAMPLE,
  SWAGGER_AUTH_SIGNUP_OWNER_REQUEST_EXAMPLE,
  SWAGGER_TENANT_CONTEXT_EXAMPLE,
} from '../swagger/swagger.examples';
import {
  AuthLoginResponseDoc,
  AuthMessageResponseDoc,
  AuthRefreshResponseDoc,
  AuthTenantContextDoc,
  AuthUserDoc,
} from './swagger/auth-doc.models';

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
@ApiTags('Auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Get('tenant')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resolve tenant context from the current request',
    description:
      'Returns public tenant context used by auth and onboarding flows before a JWT exists.',
    security: [],
  })
  @ApiOptionalTenantHeader()
  @ApiExampleOkResponse(
    AuthTenantContextDoc,
    'Tenant context resolved from request hints.',
    SWAGGER_TENANT_CONTEXT_EXAMPLE
  )
  async getTenantContext(@TenantId() tenantId?: string) {
    return this.authService.getTenantContext(tenantId);
  }

  @Public()
  @Get('tenant/resolve')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({
    summary: 'Resolve a tenant by public slug',
    security: [],
  })
  @ApiQuery({
    name: 'slug',
    required: true,
    description: 'Public tenant slug used to resolve auth context.',
    example: 'khana-padel-club',
  })
  @ApiExampleOkResponse(
    AuthTenantContextDoc,
    'Tenant context for the supplied public slug.',
    SWAGGER_TENANT_CONTEXT_EXAMPLE
  )
  @ApiStandardErrorResponses(400, 429)
  async resolveTenantBySlug(
    @Query('slug') slug?: string,
    @Ip() ipAddress?: string,
    @Headers('user-agent') userAgent?: string
  ) {
    return this.authService.resolveTenantBySlug(
      slug || '',
      ipAddress,
      userAgent
    );
  }

  @Public()
  @Post('signup-owner')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({
    summary: 'Create a new owner account and tenant',
    security: [],
  })
  @ApiExampleRequestBody(
    SignupOwnerDto,
    'Owner signup payload with the initial tenant context.',
    SWAGGER_AUTH_SIGNUP_OWNER_REQUEST_EXAMPLE
  )
  @ApiExampleCreatedResponse(
    AuthLoginResponseDoc,
    'Owner account created and initial auth tokens returned.',
    SWAGGER_AUTH_LOGIN_RESPONSE_EXAMPLE
  )
  @ApiStandardErrorResponses(400, 409, 429)
  async signupOwner(
    @Body() dto: SignupOwnerDto,
    @Ip() ipAddress?: string,
    @Headers('user-agent') userAgent?: string
  ) {
    return this.authService.signupOwner(dto, ipAddress, userAgent);
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
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({
    summary: 'Register a user for an existing tenant',
    security: [],
  })
  @ApiOptionalTenantHeader()
  @ApiExampleRequestBody(
    RegisterDto,
    'User registration payload for an existing tenant.',
    SWAGGER_AUTH_REGISTER_REQUEST_EXAMPLE
  )
  @ApiExampleCreatedResponse(
    AuthLoginResponseDoc,
    'User registered and auth tokens returned.',
    SWAGGER_AUTH_LOGIN_RESPONSE_EXAMPLE
  )
  @ApiStandardErrorResponses(400, 409, 429)
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
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({
    summary: 'Authenticate with email and password',
    security: [],
  })
  @ApiOptionalTenantHeader()
  @ApiExampleRequestBody(
    LoginDto,
    'Email/password login payload with an optional public tenant hint.',
    SWAGGER_AUTH_LOGIN_REQUEST_EXAMPLE
  )
  @ApiExampleOkResponse(
    AuthLoginResponseDoc,
    'Access token, refresh token, and current user context.',
    SWAGGER_AUTH_LOGIN_RESPONSE_EXAMPLE
  )
  @ApiStandardErrorResponses(400, 401, 429)
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
  @ApiOperation({
    summary: 'Rotate a refresh token and issue a new access token',
    security: [],
  })
  @ApiExampleRequestBody(
    RefreshTokenDto,
    'Refresh-token rotation payload.',
    SWAGGER_AUTH_REFRESH_REQUEST_EXAMPLE
  )
  @ApiExampleOkResponse(
    AuthRefreshResponseDoc,
    'New access token, rotated refresh token, and expiry metadata.',
    SWAGGER_AUTH_REFRESH_RESPONSE_EXAMPLE
  )
  @ApiStandardErrorResponses(400, 401, 429)
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
  @ApiJwtAuth()
  @ApiOperation({
    summary: 'Log out the current session',
  })
  @ApiNoContentResponse({
    description: 'The current refresh-token session was revoked.',
  })
  @ApiStandardErrorResponses(400, 401)
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
  @ApiJwtAuth()
  @ApiOperation({
    summary: 'Log out a specific device session',
  })
  @ApiNoContentResponse({
    description: 'The requested device session was revoked.',
  })
  @ApiStandardErrorResponses(400, 401, 404)
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
  @ApiJwtAuth()
  @ApiOperation({
    summary: 'Log out all devices except the current session',
  })
  @ApiNoContentResponse({
    description: 'All other device sessions were revoked.',
  })
  @ApiStandardErrorResponses(401)
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
  @ApiJwtAuth()
  @ApiOperation({
    summary: 'Get the current authenticated user',
  })
  @ApiExampleOkResponse(
    AuthUserDoc,
    'Current authenticated user profile.',
    SWAGGER_AUTH_LOGIN_RESPONSE_EXAMPLE.user
  )
  @ApiStandardErrorResponses(401)
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
  @ApiJwtAuth()
  @ApiOperation({
    summary: 'Change the current user password',
  })
  @ApiNoContentResponse({
    description: 'Password changed and prior sessions revoked.',
  })
  @ApiStandardErrorResponses(400, 401)
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
  @ApiOperation({
    summary: 'Request a password reset email',
    security: [],
  })
  @ApiOptionalTenantHeader()
  @ApiExampleRequestBody(ForgotPasswordDto, 'Password reset request payload.', {
    email: 'owner@khana.sa',
  })
  @ApiExampleOkResponse(
    AuthMessageResponseDoc,
    'Always returns success semantics to avoid exposing whether the email exists.',
    SWAGGER_AUTH_MESSAGE_RESPONSE_EXAMPLE
  )
  @ApiStandardErrorResponses(400, 429)
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
  @ApiOperation({
    summary: 'Reset password with a valid reset token',
    security: [],
  })
  @ApiExampleRequestBody(
    ResetPasswordDto,
    'Password reset confirmation payload.',
    {
      token: 'reset-token-from-email',
      newPassword: 'Secret123!',
    }
  )
  @ApiExampleOkResponse(
    AuthMessageResponseDoc,
    'Password reset completed successfully.',
    {
      message: 'Password reset completed successfully.',
    }
  )
  @ApiStandardErrorResponses(400, 429)
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
