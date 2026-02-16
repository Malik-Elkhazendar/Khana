import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { User } from '@khana/data-access';
import { JwtPayload } from '../services/jwt.service';

/**
 * JWT Strategy
 *
 * Validates JWT tokens on protected routes.
 * Called automatically by @UseGuards(AuthGuard('jwt'))
 *
 * Process:
 * 1. Passport extracts token from Authorization header
 * 2. Verifies signature using JWT_SECRET
 * 3. Calls validate() with decoded payload
 * 4. Attaches returned user to request.user
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  /**
   * Validate token payload
   *
   * Called by Passport after signature verification.
   * Double-checks user exists and is active (handles user deletion/deactivation after token issue)
   *
   * @param payload - Decoded JWT payload
   * @returns Promise<User> - User entity to attach to request
   * @throws UnauthorizedException if user not found or inactive
   */
  async validate(
    payload: JwtPayload
  ): Promise<User & { sid?: string; jti?: string; tokenType?: string }> {
    if (payload.typ && payload.typ !== 'access') {
      throw new UnauthorizedException('Invalid token type');
    }

    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
      relations: ['tenant'],
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is inactive');
    }

    return Object.assign(user, {
      sid: payload.sid,
      jti: payload.jti,
      tokenType: payload.typ,
    });
  }
}
