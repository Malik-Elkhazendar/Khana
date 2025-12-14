/**
 * Type of booking conflict detected
 * Used for detailed error messages and alternative suggestions
 */
export enum ConflictType {
  /** Requested time exactly matches an existing booking */
  EXACT_OVERLAP = 'EXACT_OVERLAP',

  /** Requested time is fully contained within an existing booking */
  CONTAINED_WITHIN = 'CONTAINED_WITHIN',

  /** Requested start time overlaps with end of existing booking */
  PARTIAL_START_OVERLAP = 'PARTIAL_START_OVERLAP',

  /** Requested end time overlaps with start of existing booking */
  PARTIAL_END_OVERLAP = 'PARTIAL_END_OVERLAP',

  /** Existing booking is fully contained within requested time */
  CONTAINS_EXISTING = 'CONTAINS_EXISTING',
}
