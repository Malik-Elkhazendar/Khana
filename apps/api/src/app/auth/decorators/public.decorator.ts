import { SetMetadata } from '@nestjs/common';

/**
 * Public Decorator Key
 *
 * Metadata key for marking routes as public
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * @Public()
 *
 * Mark endpoint as public (no auth required)
 *
 * Usage:
 * @Public()
 * @Get('login')
 * async login() { ... }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
