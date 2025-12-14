import { ConflictType, SlotStatus } from '@khana/shared-dtos';
import {
  detectConflicts,
  determineConflictType,
  generateConflictMessage,
} from './conflict-detector';
import { OccupiedSlot } from './types';

describe('ConflictDetector', () => {
  // Helper to create dates at specific times
  const createDate = (hour: number, minute = 0): Date => {
    const date = new Date('2025-01-15');
    date.setHours(hour, minute, 0, 0);
    return date;
  };

  // Helper to create an occupied slot
  const createOccupiedSlot = (
    startHour: number,
    endHour: number,
    status: SlotStatus = SlotStatus.BOOKED,
    facilityId = 'facility-1'
  ): OccupiedSlot => ({
    id: `slot-${startHour}-${endHour}`,
    facilityId,
    startTime: createDate(startHour),
    endTime: createDate(endHour),
    status,
    bookingReference: status === SlotStatus.BOOKED ? 'KH-2025-001' : undefined,
  });

  describe('determineConflictType', () => {
    it('should return undefined when no overlap exists', () => {
      // Requested: 14:00-15:00, Existing: 16:00-17:00
      const result = determineConflictType(
        createDate(14),
        createDate(15),
        createDate(16),
        createDate(17)
      );
      expect(result).toBeUndefined();
    });

    it('should detect exact overlap', () => {
      // Requested: 14:00-15:00, Existing: 14:00-15:00
      const result = determineConflictType(
        createDate(14),
        createDate(15),
        createDate(14),
        createDate(15)
      );
      expect(result).toBe(ConflictType.EXACT_OVERLAP);
    });

    it('should detect when requested is contained within existing', () => {
      // Requested: 14:30-15:30, Existing: 14:00-16:00
      const result = determineConflictType(
        createDate(14, 30),
        createDate(15, 30),
        createDate(14),
        createDate(16)
      );
      expect(result).toBe(ConflictType.CONTAINED_WITHIN);
    });

    it('should detect when existing is contained within requested', () => {
      // Requested: 14:00-17:00, Existing: 15:00-16:00
      const result = determineConflictType(
        createDate(14),
        createDate(17),
        createDate(15),
        createDate(16)
      );
      expect(result).toBe(ConflictType.CONTAINS_EXISTING);
    });

    it('should detect partial end overlap', () => {
      // Requested: 14:00-15:30, Existing: 15:00-16:00
      const result = determineConflictType(
        createDate(14),
        createDate(15, 30),
        createDate(15),
        createDate(16)
      );
      expect(result).toBe(ConflictType.PARTIAL_END_OVERLAP);
    });

    it('should detect partial start overlap', () => {
      // Requested: 15:30-17:00, Existing: 15:00-16:00
      const result = determineConflictType(
        createDate(15, 30),
        createDate(17),
        createDate(15),
        createDate(16)
      );
      expect(result).toBe(ConflictType.PARTIAL_START_OVERLAP);
    });

    it('should allow adjacent bookings (end time = start time)', () => {
      // Requested: 15:00-16:00, Existing: 14:00-15:00 (adjacent, no overlap)
      const result = determineConflictType(
        createDate(15),
        createDate(16),
        createDate(14),
        createDate(15)
      );
      expect(result).toBeUndefined();
    });
  });

  describe('generateConflictMessage', () => {
    it('should generate message for exact overlap', () => {
      const message = generateConflictMessage(ConflictType.EXACT_OVERLAP, [
        createOccupiedSlot(14, 15),
      ]);
      expect(message).toContain('already booked');
    });

    it('should generate message for contained within', () => {
      const message = generateConflictMessage(ConflictType.CONTAINED_WITHIN, [
        createOccupiedSlot(14, 16),
      ]);
      expect(message).toContain('within an existing booking');
    });

    it('should generate message for contains existing with count', () => {
      const message = generateConflictMessage(ConflictType.CONTAINS_EXISTING, [
        createOccupiedSlot(14, 15),
        createOccupiedSlot(15, 16),
      ]);
      expect(message).toContain('2 existing slots');
    });
  });

  describe('detectConflicts', () => {
    it('should return no conflict when no occupied slots exist', () => {
      const result = detectConflicts({
        facilityId: 'facility-1',
        requestedStart: createDate(14),
        requestedEnd: createDate(15),
        occupiedSlots: [],
      });

      expect(result.hasConflict).toBe(false);
      expect(result.conflictingSlots).toHaveLength(0);
      expect(result.message).toContain('available');
    });

    it('should return no conflict when time slot is available', () => {
      const result = detectConflicts({
        facilityId: 'facility-1',
        requestedStart: createDate(14),
        requestedEnd: createDate(15),
        occupiedSlots: [
          createOccupiedSlot(16, 17), // Later slot
          createOccupiedSlot(12, 13), // Earlier slot
        ],
      });

      expect(result.hasConflict).toBe(false);
    });

    it('should detect conflict with booked slot', () => {
      const result = detectConflicts({
        facilityId: 'facility-1',
        requestedStart: createDate(14),
        requestedEnd: createDate(15),
        occupiedSlots: [createOccupiedSlot(14, 15, SlotStatus.BOOKED)],
      });

      expect(result.hasConflict).toBe(true);
      expect(result.conflictType).toBe(ConflictType.EXACT_OVERLAP);
      expect(result.conflictingSlots).toHaveLength(1);
      expect(result.conflictingSlots[0].status).toBe(SlotStatus.BOOKED);
    });

    it('should detect conflict with maintenance slot', () => {
      const result = detectConflicts({
        facilityId: 'facility-1',
        requestedStart: createDate(14),
        requestedEnd: createDate(15),
        occupiedSlots: [createOccupiedSlot(14, 15, SlotStatus.MAINTENANCE)],
      });

      expect(result.hasConflict).toBe(true);
      expect(result.conflictingSlots[0].status).toBe(SlotStatus.MAINTENANCE);
    });

    it('should ignore slots from different facilities', () => {
      const result = detectConflicts({
        facilityId: 'facility-1',
        requestedStart: createDate(14),
        requestedEnd: createDate(15),
        occupiedSlots: [
          createOccupiedSlot(14, 15, SlotStatus.BOOKED, 'facility-2'), // Different facility
        ],
      });

      expect(result.hasConflict).toBe(false);
    });

    it('should detect multiple conflicting slots', () => {
      const result = detectConflicts({
        facilityId: 'facility-1',
        requestedStart: createDate(14),
        requestedEnd: createDate(17),
        occupiedSlots: [
          createOccupiedSlot(14, 15),
          createOccupiedSlot(15, 16),
          createOccupiedSlot(16, 17),
        ],
      });

      expect(result.hasConflict).toBe(true);
      expect(result.conflictingSlots).toHaveLength(3);
    });
  });
});
