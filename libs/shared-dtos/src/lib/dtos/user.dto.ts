import { UserRole } from '../enums/user-role.enum';

/**
 * User DTO - Safe for frontend consumption
 * Represents staff/admin users (not customers)
 */
export interface UserDto {
  /** Unique identifier */
  id: string;

  /** Tenant ID this user belongs to */
  tenantId: string;

  /** Email (used for login) */
  email: string;

  /** Display name */
  name: string;

  /** Phone number */
  phone?: string;

  /** User role */
  role: UserRole;

  /** Whether user is active */
  isActive: boolean;

  /** Last login timestamp */
  lastLoginAt?: Date;

  /** Creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * DTO for creating a new user
 */
export interface CreateUserDto {
  /** Email (must be unique within tenant) */
  email: string;

  /** Password (will be hashed) */
  password: string;

  /** Display name */
  name: string;

  /** Phone number */
  phone?: string;

  /** User role (optional for self-registration) */
  role?: UserRole;
}

/**
 * DTO for updating a user
 */
export interface UpdateUserDto {
  /** Display name */
  name?: string;

  /** Phone number */
  phone?: string;

  /** User role */
  role?: UserRole;

  /** Active status */
  isActive?: boolean;
}

/**
 * DTO for changing password
 */
export interface ChangePasswordDto {
  /** Current password */
  currentPassword: string;

  /** New password */
  newPassword: string;
}

/**
 * DTO for login request
 */
export interface LoginDto {
  /** Email */
  email: string;

  /** Password */
  password: string;

  /** Tenant subdomain (extracted from URL or provided) */
  subdomain?: string;
}

/**
 * DTO for login response
 */
export interface LoginResponseDto {
  /** JWT access token */
  accessToken: string;

  /** Refresh token */
  refreshToken: string;

  /** Token expiry (seconds) */
  expiresIn: number;

  /** User data */
  user: UserDto;

  /** Tenant data (optional for backward compatibility) */
  tenant?: {
    id: string;
    name: string;
    subdomain?: string;
  };
}

/**
 * Summary DTO for user lists
 */
export interface UserSummaryDto {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: Date;
}
