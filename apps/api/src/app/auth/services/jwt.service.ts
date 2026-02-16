import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService as NestJwtService, JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';

/**
 * JWT Payload Interface
 *
 * Standard JWT claims for authentication tokens
 */
export interface JwtPayload {
  sub: string; // User ID
  email: string;
  role: string;
  tenantId: string;
  typ?: 'access' | 'refresh';
  jti?: string;
  sid?: string;
}

/**
 * Token Response Interface
 *
 * Contains both access and refresh tokens
 */
export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // in milliseconds
}

/**
 * JWT Service
 *
 * Handles token generation and verification for authentication.
 * - Access tokens: short-lived (15 minutes)
 * - Refresh tokens: long-lived (7 days)
 */
@Injectable()
export class JwtTokenService {
  constructor(
    private readonly jwtService: NestJwtService,
    private readonly configService: ConfigService
  ) {}

  /**
   * Generate access token (short-lived, 15 minutes)
   *
   * @param payload - JWT payload with user claims
   * @returns string - Signed JWT access token
   */
  generateAccessToken(payload: JwtPayload): string {
    const accessPayload: JwtPayload = {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      tenantId: payload.tenantId,
      typ: 'access',
      sid: payload.sid,
    };
    const expiresIn = (this.configService.get<string>('JWT_ACCESS_EXPIRES') ??
      '15m') as StringValue;
    const options: JwtSignOptions = {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn,
    };
    return this.jwtService.sign(accessPayload as object, options);
  }

  /**
   * Generate refresh token (long-lived, 7 days)
   *
   * Used to issue new access tokens without re-login.
   *
   * @param payload - JWT payload with user claims
   * @returns string - Signed JWT refresh token
   */
  generateRefreshToken(payload: JwtPayload): string {
    if (!payload.jti || !payload.sid) {
      throw new Error('Refresh token payload requires jti and sid');
    }
    const refreshPayload: JwtPayload = {
      sub: payload.sub,
      email: payload.email,
      role: payload.role,
      tenantId: payload.tenantId,
      typ: 'refresh',
      jti: payload.jti,
      sid: payload.sid,
    };
    const expiresIn = (this.configService.get<string>('JWT_REFRESH_EXPIRES') ??
      '7d') as StringValue;
    const options: JwtSignOptions = {
      secret:
        this.configService.get<string>('JWT_REFRESH_SECRET') ||
        this.configService.get<string>('JWT_SECRET'),
      expiresIn,
    };
    return this.jwtService.sign(refreshPayload as object, options);
  }

  /**
   * Generate both tokens for login response
   *
   * @param payload - JWT payload with user claims
   * @returns TokenResponse - Access token, refresh token, and expiry time
   */
  generateTokenPair(payload: JwtPayload): TokenResponse {
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);

    // Decode to get exact expiry time
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
   *
   * @param token - JWT access token
   * @returns JwtPayload - Decoded payload
   * @throws UnauthorizedException if token invalid or expired
   */
  verifyAccessToken(token: string): JwtPayload {
    try {
      return this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      }) as JwtPayload;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  /**
   * Verify and decode refresh token
   *
   * @param token - JWT refresh token
   * @returns JwtPayload - Decoded payload
   * @throws UnauthorizedException if token invalid or expired
   */
  verifyRefreshToken(token: string): JwtPayload {
    try {
      return this.jwtService.verify(token, {
        secret:
          this.configService.get<string>('JWT_REFRESH_SECRET') ||
          this.configService.get<string>('JWT_SECRET'),
      }) as JwtPayload;
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }
}
