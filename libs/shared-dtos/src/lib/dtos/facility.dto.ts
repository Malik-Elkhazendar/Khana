import { FacilityType } from '../enums/facility-type.enum';
import { InventoryType } from '../enums/inventory-type.enum';
import { FacilityMetadata } from '../interfaces/facility-metadata.interface';

/**
 * Facility DTO - Safe for frontend consumption
 */
export interface FacilityDto {
  /** Unique identifier */
  id: string;

  /** Tenant ID this facility belongs to */
  tenantId: string;

  /** Display name (e.g., "Court 1", "VIP Chalet") */
  name: string;

  /** Type of facility */
  type: FacilityType;

  /** Inventory type (HOURLY for sports, DAILY for chalets) */
  inventoryType: InventoryType;

  /** Facility metadata (capacity, amenities, pricing, etc.) */
  metadata: FacilityMetadata;

  /** Whether facility is active and bookable */
  isActive: boolean;

  /** Display order in lists */
  displayOrder?: number;

  /** Creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;
}

/**
 * DTO for creating a new facility
 */
export interface CreateFacilityDto {
  /** Display name */
  name: string;

  /** Type of facility */
  type: FacilityType;

  /** Inventory type */
  inventoryType: InventoryType;

  /** Facility metadata */
  metadata: FacilityMetadata;

  /** Display order */
  displayOrder?: number;
}

/**
 * DTO for updating a facility
 */
export interface UpdateFacilityDto {
  /** Display name */
  name?: string;

  /** Updated metadata (partial) */
  metadata?: Partial<FacilityMetadata>;

  /** Activate/deactivate */
  isActive?: boolean;

  /** Display order */
  displayOrder?: number;
}

/**
 * Summary DTO for facility lists
 */
export interface FacilitySummaryDto {
  id: string;
  name: string;
  type: FacilityType;
  inventoryType: InventoryType;
  isActive: boolean;
  /** Base price for quick display */
  basePrice: number;
  /** Currency */
  currency: string;
  /** Today's occupancy rate */
  todayOccupancy?: number;
}
