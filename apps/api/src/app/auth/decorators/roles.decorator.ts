import { SetMetadata } from '@nestjs/common';

/**
 * Roles Decorator Key
 *
 * Metadata key for specifying required roles
 */
export const ROLES_KEY = 'roles';

/**
 * @Roles(UserRole.OWNER, UserRole.MANAGER)
 *
 * Restrict endpoint to specific roles
 *
 * Usage:
 * @Roles('OWNER', 'MANAGER')
 * @Delete('users/:id')
 * async deleteUser() { ... }
 *
 * Must be used with RolesGuard
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
