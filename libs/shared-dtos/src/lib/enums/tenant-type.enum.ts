/**
 * Type of tenant/business using the Khana platform
 * Determines inventory type and booking behavior
 */
export enum TenantType {
  /** Sports facilities - uses HOURLY inventory (Padel, Football courts) */
  SPORTS_FACILITY = 'SPORTS_FACILITY',

  /** Chalets - uses DAILY inventory (private chalets, camps) */
  CHALET = 'CHALET',

  /** Resorts - uses DAILY inventory with extended features */
  RESORT = 'RESORT',
}
