import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * JWT Auth Guard
 *
 * Usage: @UseGuards(JwtAuthGuard)
 *
 * Blocks unauthenticated requests unless endpoint marked with @Public()
 * Integrates with JwtStrategy for token validation
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  /**
   * Determine if route can be activated
   *
   * @param context - Execution context
   * @returns boolean | Promise<boolean> - True if request can proceed
   */
  canActivate(context: ExecutionContext) {
    // Check if endpoint is marked @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Require JWT validation
    return super.canActivate(context);
  }

  /**
   * Handle request after validation
   *
   * @param err - Error from validation
   * @param user - User from JwtStrategy.validate()
   * @param info - Additional info from Passport
   * @returns User - Attached to request.user
   * @throws UnauthorizedException if validation failed
   */
  handleRequest<TUser = any>(
    err: any,
    user: any,
    info: any,
    context: ExecutionContext,
    status?: any
  ): TUser {
    if (err || !user) {
      throw err || new UnauthorizedException('Authentication required');
    }
    return user as TUser;
  }
}
