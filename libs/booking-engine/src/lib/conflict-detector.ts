/**
 * Conflict Detector
 * Pure functions for detecting booking conflicts
 */

import { ConflictType } from '@khana/shared-dtos';
import { doTimeRangesOverlap } from '@khana/shared-utils';
import {
  OccupiedSlot,
  ConflictDetectionInput,
  ConflictDetectionResult,
} from './types';

/**
 * Determine the type of overlap between two time ranges
 * Returns undefined if no overlap exists
 */
export function determineConflictType(
  requestedStart: Date,
  requestedEnd: Date,
  existingStart: Date,
  existingEnd: Date
): ConflictType | undefined {
  // No overlap - early exit
  if (
    !doTimeRangesOverlap(
      requestedStart,
      requestedEnd,
      existingStart,
      existingEnd
    )
  ) {
    return undefined;
  }

  const requestedStartTime = requestedStart.getTime();
  const requestedEndTime = requestedEnd.getTime();
  const existingStartTime = existingStart.getTime();
  const existingEndTime = existingEnd.getTime();

  // Exact overlap
  if (
    requestedStartTime === existingStartTime &&
    requestedEndTime === existingEndTime
  ) {
    return ConflictType.EXACT_OVERLAP;
  }

  // Requested is fully contained within existing
  if (
    requestedStartTime >= existingStartTime &&
    requestedEndTime <= existingEndTime
  ) {
    return ConflictType.CONTAINED_WITHIN;
  }

  // Existing is fully contained within requested
  if (
    existingStartTime >= requestedStartTime &&
    existingEndTime <= requestedEndTime
  ) {
    return ConflictType.CONTAINS_EXISTING;
  }

  // Partial start overlap (requested starts before existing ends)
  if (
    requestedStartTime < existingStartTime &&
    requestedEndTime > existingStartTime
  ) {
    return ConflictType.PARTIAL_END_OVERLAP;
  }

  // Partial end overlap (requested ends after existing starts)
  if (
    requestedStartTime < existingEndTime &&
    requestedEndTime > existingEndTime
  ) {
    return ConflictType.PARTIAL_START_OVERLAP;
  }

  // Fallback - some form of overlap exists
  return ConflictType.PARTIAL_START_OVERLAP;
}

/**
 * Generate human-readable conflict message
 */
export function generateConflictMessage(
  conflictType: ConflictType,
  conflictingSlots: OccupiedSlot[]
): string {
  const slotCount = conflictingSlots.length;
  const slotWord = slotCount === 1 ? 'slot' : 'slots';

  switch (conflictType) {
    case ConflictType.EXACT_OVERLAP:
      return `This exact time slot is already booked.`;
    case ConflictType.CONTAINED_WITHIN:
      return `The requested time falls within an existing booking.`;
    case ConflictType.CONTAINS_EXISTING:
      return `The requested time contains ${slotCount} existing ${slotWord}.`;
    case ConflictType.PARTIAL_START_OVERLAP:
      return `The start of your booking overlaps with an existing booking.`;
    case ConflictType.PARTIAL_END_OVERLAP:
      return `The end of your booking overlaps with an existing booking.`;
    default:
      return `Time conflict detected with ${slotCount} existing ${slotWord}.`;
  }
}

/**
 * Detect conflicts between a requested booking and existing occupied slots
 *
 * Pure function - no side effects, fully deterministic
 *
 * @param input - The conflict detection input
 * @returns Conflict detection result
 */
export function detectConflicts(
  input: ConflictDetectionInput
): ConflictDetectionResult {
  const { requestedStart, requestedEnd, occupiedSlots, facilityId } = input;

  // Filter to only slots for this facility
  const relevantSlots = occupiedSlots.filter(
    (slot) => slot.facilityId === facilityId
  );

  // Find all conflicting slots
  const conflictingSlots: OccupiedSlot[] = [];
  let primaryConflictType: ConflictType | undefined;

  for (const slot of relevantSlots) {
    const conflictType = determineConflictType(
      requestedStart,
      requestedEnd,
      slot.startTime,
      slot.endTime
    );

    if (conflictType) {
      conflictingSlots.push(slot);
      // Keep the most severe conflict type (exact overlap is most severe)
      if (!primaryConflictType || conflictType === ConflictType.EXACT_OVERLAP) {
        primaryConflictType = conflictType;
      }
    }
  }

  if (conflictingSlots.length === 0) {
    return {
      hasConflict: false,
      message: 'No conflicts detected. Time slot is available.',
      conflictingSlots: [],
    };
  }

  return {
    hasConflict: true,
    conflictType: primaryConflictType,
    message: generateConflictMessage(
      primaryConflictType as ConflictType,
      conflictingSlots
    ),
    conflictingSlots,
  };
}
