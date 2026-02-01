import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Tenant Guard
 *
 * Validates tenantId in request params/body matches user.tenantId.
 * Prevents cross-tenant data access.
 *
 * Usage: @UseGuards(JwtAuthGuard, TenantGuard)
 * Skips validation for routes without tenantId parameter
 */
@Injectable()
export class TenantGuard implements CanActivate {
  /**
   * Validate tenant isolation
   *
   * @param context - Execution context
   * @returns boolean - True if tenant matches or no tenantId in request
   * @throws ForbiddenException if tenant mismatch
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not found in request');
    }

    // Extract tenantId from params or body
    const tenantIdFromRequest =
      request.params?.tenantId || request.body?.tenantId;

    // If no tenantId in request, skip validation
    if (!tenantIdFromRequest) {
      return true;
    }

    // Verify tenant match
    const userTenantId = user.tenant?.id;

    if (tenantIdFromRequest !== userTenantId) {
      throw new ForbiddenException(
        'Access denied: Tenant mismatch. You can only access data from your own tenant.'
      );
    }

    return true;
  }
}
