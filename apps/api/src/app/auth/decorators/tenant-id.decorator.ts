import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * @TenantId()
 *
 * Inject tenant ID from current user's JWT payload or request metadata
 *
 * Usage:
 * async getTenantData(@TenantId() tenantId: string) { ... }
 */
export const TenantId = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    const normalize = (value: unknown): string | undefined => {
      if (Array.isArray(value)) {
        return typeof value[0] === 'string' ? value[0] : undefined;
      }
      return typeof value === 'string' ? value : undefined;
    };

    return (
      normalize(request.user?.tenantId) ||
      normalize(request.user?.tenant?.id) ||
      normalize(request.headers?.['x-tenant-id']) ||
      normalize(request.headers?.['x-tenant']) ||
      normalize(request.body?.tenantId) ||
      normalize(request.query?.tenantId)
    );
  }
);
