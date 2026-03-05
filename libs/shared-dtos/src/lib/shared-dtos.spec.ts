import {
  // Enums
  TenantType,
  FacilityType,
  InventoryType,
  SlotStatus,
  BookingStatus,
  BookingCancellationReasonKey,
  PaymentStatus,
  ConflictType,
  UserRole,
  serializeCancellationReason,
  parseCancellationReason,
  isBookingCancellationReasonKey,
  // Interfaces
  TimeSlot,
  PriceBreakdown,
  // DTOs
  TenantDto,
  FacilityDto,
  BookingDto,
} from './shared-dtos';

describe('shared-dtos', () => {
  describe('Enums', () => {
    it('should export TenantType enum', () => {
      expect(TenantType.SPORTS_FACILITY).toBe('SPORTS_FACILITY');
      expect(TenantType.CHALET).toBe('CHALET');
      expect(TenantType.RESORT).toBe('RESORT');
    });

    it('should export FacilityType enum', () => {
      expect(FacilityType.PADEL_COURT).toBe('PADEL_COURT');
      expect(FacilityType.FOOTBALL_FIELD).toBe('FOOTBALL_FIELD');
      expect(FacilityType.CHALET).toBe('CHALET');
    });

    it('should export InventoryType enum', () => {
      expect(InventoryType.HOURLY).toBe('HOURLY');
      expect(InventoryType.DAILY).toBe('DAILY');
      expect(InventoryType.CUSTOM).toBe('CUSTOM');
    });

    it('should export SlotStatus enum without AVAILABLE', () => {
      expect(SlotStatus.BOOKED).toBe('BOOKED');
      expect(SlotStatus.BLOCKED).toBe('BLOCKED');
      expect(SlotStatus.MAINTENANCE).toBe('MAINTENANCE');
      // AVAILABLE should not exist (critical design decision)
      expect(
        Object.prototype.hasOwnProperty.call(SlotStatus, 'AVAILABLE')
      ).toBe(false);
    });

    it('should export BookingStatus enum', () => {
      expect(BookingStatus.PENDING).toBe('PENDING');
      expect(BookingStatus.CONFIRMED).toBe('CONFIRMED');
      expect(BookingStatus.CANCELLED).toBe('CANCELLED');
    });

    it('should export BookingCancellationReasonKey enum', () => {
      expect(BookingCancellationReasonKey.CUSTOMER_REQUEST).toBe(
        'customer_request'
      );
      expect(BookingCancellationReasonKey.NO_PAYMENT).toBe('no_payment');
      expect(BookingCancellationReasonKey.DOUBLE_BOOKING).toBe(
        'double_booking'
      );
      expect(BookingCancellationReasonKey.FACILITY_UNAVAILABLE).toBe(
        'facility_unavailable'
      );
      expect(BookingCancellationReasonKey.STAFF_ERROR).toBe('staff_error');
      expect(BookingCancellationReasonKey.OTHER).toBe('other');
    });

    it('should export PaymentStatus enum', () => {
      expect(PaymentStatus.PENDING).toBe('PENDING');
      expect(PaymentStatus.PAID).toBe('PAID');
      expect(PaymentStatus.REFUNDED).toBe('REFUNDED');
      expect(
        Object.prototype.hasOwnProperty.call(PaymentStatus, 'UNPAID')
      ).toBe(false);
    });

    it('should export ConflictType enum', () => {
      expect(ConflictType.EXACT_OVERLAP).toBe('EXACT_OVERLAP');
      expect(ConflictType.PARTIAL_START_OVERLAP).toBe('PARTIAL_START_OVERLAP');
    });

    it('should export UserRole enum', () => {
      expect(UserRole.OWNER).toBe('OWNER');
      expect(UserRole.MANAGER).toBe('MANAGER');
      expect(UserRole.STAFF).toBe('STAFF');
    });
  });

  describe('Cancellation reason helpers', () => {
    it('serializes non-other reasons as key only', () => {
      expect(
        serializeCancellationReason(
          BookingCancellationReasonKey.CUSTOMER_REQUEST,
          'ignored'
        )
      ).toBe('customer_request');
    });

    it('serializes other with optional note', () => {
      expect(
        serializeCancellationReason(BookingCancellationReasonKey.OTHER)
      ).toBe('other');
      expect(
        serializeCancellationReason(
          BookingCancellationReasonKey.OTHER,
          '  Customer asked to move slot  '
        )
      ).toBe('other|Customer asked to move slot');
    });

    it('parses canonical values', () => {
      expect(parseCancellationReason('customer_request')).toEqual({
        isValid: true,
        key: BookingCancellationReasonKey.CUSTOMER_REQUEST,
        note: null,
        raw: 'customer_request',
      });
      expect(parseCancellationReason('other|Need a different day')).toEqual({
        isValid: true,
        key: BookingCancellationReasonKey.OTHER,
        note: 'Need a different day',
        raw: 'other|Need a different day',
      });
    });

    it('marks invalid values as invalid', () => {
      expect(parseCancellationReason('free text')).toEqual({
        isValid: false,
        key: null,
        note: null,
        raw: 'free text',
      });
      expect(parseCancellationReason('')).toEqual({
        isValid: false,
        key: null,
        note: null,
        raw: '',
      });
    });

    it('detects valid cancellation reason keys', () => {
      expect(isBookingCancellationReasonKey('customer_request')).toBe(true);
      expect(isBookingCancellationReasonKey('unknown')).toBe(false);
    });
  });

  describe('Interfaces', () => {
    it('should allow TimeSlot interface usage', () => {
      const slot: TimeSlot = {
        startTime: new Date('2025-01-01T10:00:00'),
        endTime: new Date('2025-01-01T11:00:00'),
      };
      expect(slot.startTime).toBeInstanceOf(Date);
      expect(slot.endTime).toBeInstanceOf(Date);
    });

    it('should allow PriceBreakdown interface usage', () => {
      const breakdown: PriceBreakdown = {
        basePrice: 100,
        timeMultiplier: 1.5,
        dayMultiplier: 1.0,
        durationDiscount: 0,
        subtotal: 150,
        discountAmount: 0,
        total: 150,
        currency: 'SAR',
      };
      expect(breakdown.total).toBe(150);
      expect(breakdown.currency).toBe('SAR');
    });
  });

  describe('DTOs', () => {
    it('should allow TenantDto interface usage', () => {
      const tenant: Partial<TenantDto> = {
        id: 'uuid-123',
        subdomain: 'elite-padel',
        name: 'Elite Padel Club',
        type: TenantType.SPORTS_FACILITY,
        isActive: true,
      };
      expect(tenant.subdomain).toBe('elite-padel');
      expect(tenant.type).toBe(TenantType.SPORTS_FACILITY);
    });

    it('should allow FacilityDto interface usage', () => {
      const facility: Partial<FacilityDto> = {
        id: 'uuid-456',
        name: 'Court 1',
        type: FacilityType.PADEL_COURT,
        inventoryType: InventoryType.HOURLY,
        isActive: true,
      };
      expect(facility.type).toBe(FacilityType.PADEL_COURT);
      expect(facility.inventoryType).toBe(InventoryType.HOURLY);
    });

    it('should allow BookingDto interface usage', () => {
      const booking: Partial<BookingDto> = {
        id: 'uuid-789',
        bookingReference: 'KH-2025-001234',
        status: BookingStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
        totalAmount: 150,
        currency: 'SAR',
      };
      expect(booking.bookingReference).toMatch(/^KH-\d{4}-\d{6}$/);
      expect(booking.status).toBe(BookingStatus.CONFIRMED);
    });
  });
});
