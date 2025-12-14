import { TenantType } from '../enums/tenant-type.enum';
import { TenantSettings } from '../interfaces/tenant-settings.interface';

/**
 * Tenant DTO - Safe for frontend consumption
 * Maps from Tenant entity (backend-only)
 */
export interface TenantDto {
  /** Unique identifier */
  id: string;

  /** Subdomain for tenant access (e.g., 'elite-padel') */
  subdomain: string;

  /** Display name */
  name: string;

  /** Type of tenant business */
  type: TenantType;

  /** Tenant settings and configuration */
  settings: TenantSettings;

  /** Whether tenant is active */
  isActive: boolean;

  /** Creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * DTO for creating a new tenant
 */
export interface CreateTenantDto {
  /** Subdomain (must be unique, lowercase, alphanumeric with hyphens) */
  subdomain: string;

  /** Display name */
  name: string;

  /** Type of tenant business */
  type: TenantType;

  /** Initial settings */
  settings: Partial<TenantSettings>;
}

/**
 * DTO for updating a tenant
 */
export interface UpdateTenantDto {
  /** Display name */
  name?: string;

  /** Updated settings (partial update) */
  settings?: Partial<TenantSettings>;

  /** Activate/deactivate tenant */
  isActive?: boolean;
}

/**
 * Summary DTO for tenant lists
 */
export interface TenantSummaryDto {
  id: string;
  subdomain: string;
  name: string;
  type: TenantType;
  isActive: boolean;
  facilityCount?: number;
  bookingCount?: number;
}
