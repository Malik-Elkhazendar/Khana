import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '@khana/data-access';

/**
 * @CurrentUser()
 *
 * Inject current user from JWT payload
 *
 * Usage:
 * async getCurrentUser(@CurrentUser() user: User) { ... }
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  }
);
