/**
 * Type of facility within a tenant
 * Determines specific business rules and UI presentation
 */
export enum FacilityType {
  /** Padel court - typically 60-90 min slots */
  PADEL_COURT = 'PADEL_COURT',

  /** Football/Soccer field - typically 60-120 min slots */
  FOOTBALL_FIELD = 'FOOTBALL_FIELD',

  /** Basketball court */
  BASKETBALL_COURT = 'BASKETBALL_COURT',

  /** Tennis court */
  TENNIS_COURT = 'TENNIS_COURT',

  /** Private chalet - daily rental */
  CHALET = 'CHALET',

  /** Camp/Istiraha - daily rental */
  CAMP = 'CAMP',

  /** Resort unit - daily rental with amenities */
  RESORT_UNIT = 'RESORT_UNIT',

  /** Generic bookable space */
  OTHER = 'OTHER',
}
