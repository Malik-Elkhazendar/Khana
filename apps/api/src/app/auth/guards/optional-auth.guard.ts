import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Optional JWT Auth Guard
 *
 * Similar to JwtAuthGuard but doesn't throw on missing token.
 * Attaches user if token present, continues without if not.
 *
 * Usage: @UseGuards(OptionalAuthGuard)
 * Use for routes that work with or without authentication
 */
@Injectable()
export class OptionalAuthGuard extends AuthGuard('jwt') {
  /**
   * Handle request - don't throw if no token
   *
   * @param err - Error from validation
   * @param user - User from JwtStrategy.validate()
   * @returns User | null - User if authenticated, null otherwise
   */
  handleRequest<TUser = any>(
    err: any,
    user: any,
    info: any,
    context: ExecutionContext,
    status?: any
  ): TUser {
    // Don't throw error if user not found - just return null
    return (user || null) as TUser;
  }
}
