import {
  // Date utils
  isMenaWeekend,
  isPeakHour,
  parseTimeString,
  setTimeFromString,
  startOfDay,
  endOfDay,
  addMinutes,
  addDays,
  diffInMinutes,
  doTimeRangesOverlap,
  generateDailySlots,
  isToday,
  // Validation
  isValidSaudiPhone,
  normalizeSaudiPhone,
  isValidEmail,
  isValidSubdomain,
  validateTimeRange,
  validatePhone,
  // Formatters
  formatCurrency,
  formatDuration,
  formatPhoneDisplay,
  enumToDisplay,
  capitalize,
  formatPercentage,
  getOccupancyLevel,
  // Booking reference
  generateBookingReference,
  parseBookingReference,
  isValidBookingReferenceFormat,
  generateConfirmationCode,
} from './shared-utils';

describe('shared-utils', () => {
  describe('Date Utils', () => {
    describe('isMenaWeekend', () => {
      it('should return true for Thursday (day 4)', () => {
        const thursday = new Date('2025-01-02'); // A Thursday
        expect(isMenaWeekend(thursday)).toBe(true);
      });

      it('should return true for Friday (day 5)', () => {
        const friday = new Date('2025-01-03'); // A Friday
        expect(isMenaWeekend(friday)).toBe(true);
      });

      it('should return false for Sunday (day 0)', () => {
        const sunday = new Date('2025-01-05'); // A Sunday
        expect(isMenaWeekend(sunday)).toBe(false);
      });
    });

    describe('isPeakHour', () => {
      it('should return true for 18:00 (within 17:00-22:00)', () => {
        const date = new Date('2025-01-01T18:00:00');
        expect(isPeakHour(date)).toBe(true);
      });

      it('should return false for 10:00 (outside peak)', () => {
        const date = new Date('2025-01-01T10:00:00');
        expect(isPeakHour(date)).toBe(false);
      });

      it('should respect custom peak hours', () => {
        const date = new Date('2025-01-01T14:00:00');
        expect(isPeakHour(date, 14, 16)).toBe(true);
      });
    });

    describe('parseTimeString', () => {
      it('should parse HH:mm format', () => {
        expect(parseTimeString('09:30')).toEqual({ hours: 9, minutes: 30 });
        expect(parseTimeString('17:00')).toEqual({ hours: 17, minutes: 0 });
      });
    });

    describe('setTimeFromString', () => {
      it('should set time on date', () => {
        const date = new Date('2025-01-01');
        const result = setTimeFromString(date, '14:30');
        expect(result.getHours()).toBe(14);
        expect(result.getMinutes()).toBe(30);
      });
    });

    describe('startOfDay / endOfDay', () => {
      it('should get start of day', () => {
        const date = new Date('2025-01-01T15:30:45.123');
        const start = startOfDay(date);
        expect(start.getHours()).toBe(0);
        expect(start.getMinutes()).toBe(0);
        expect(start.getSeconds()).toBe(0);
      });

      it('should get end of day', () => {
        const date = new Date('2025-01-01T10:00:00');
        const end = endOfDay(date);
        expect(end.getHours()).toBe(23);
        expect(end.getMinutes()).toBe(59);
        expect(end.getSeconds()).toBe(59);
      });
    });

    describe('addMinutes / addDays', () => {
      it('should add minutes', () => {
        const date = new Date('2025-01-01T10:00:00');
        const result = addMinutes(date, 90);
        expect(result.getHours()).toBe(11);
        expect(result.getMinutes()).toBe(30);
      });

      it('should add days', () => {
        const date = new Date('2025-01-01');
        const result = addDays(date, 5);
        expect(result.getDate()).toBe(6);
      });
    });

    describe('diffInMinutes', () => {
      it('should calculate difference in minutes', () => {
        const start = new Date('2025-01-01T10:00:00');
        const end = new Date('2025-01-01T11:30:00');
        expect(diffInMinutes(start, end)).toBe(90);
      });
    });

    describe('doTimeRangesOverlap', () => {
      it('should detect exact overlap', () => {
        const a1 = new Date('2025-01-01T10:00:00');
        const a2 = new Date('2025-01-01T11:00:00');
        expect(doTimeRangesOverlap(a1, a2, a1, a2)).toBe(true);
      });

      it('should detect partial overlap', () => {
        const a1 = new Date('2025-01-01T10:00:00');
        const a2 = new Date('2025-01-01T11:00:00');
        const b1 = new Date('2025-01-01T10:30:00');
        const b2 = new Date('2025-01-01T11:30:00');
        expect(doTimeRangesOverlap(a1, a2, b1, b2)).toBe(true);
      });

      it('should not detect adjacent slots as overlap', () => {
        const a1 = new Date('2025-01-01T10:00:00');
        const a2 = new Date('2025-01-01T11:00:00');
        const b1 = new Date('2025-01-01T11:00:00');
        const b2 = new Date('2025-01-01T12:00:00');
        expect(doTimeRangesOverlap(a1, a2, b1, b2)).toBe(false);
      });

      it('should not detect non-overlapping ranges', () => {
        const a1 = new Date('2025-01-01T10:00:00');
        const a2 = new Date('2025-01-01T11:00:00');
        const b1 = new Date('2025-01-01T14:00:00');
        const b2 = new Date('2025-01-01T15:00:00');
        expect(doTimeRangesOverlap(a1, a2, b1, b2)).toBe(false);
      });
    });

    describe('generateDailySlots', () => {
      it('should generate hourly slots', () => {
        const date = new Date('2025-01-01');
        const slots = generateDailySlots(date, '08:00', '12:00', 60);

        expect(slots.length).toBe(4); // 8-9, 9-10, 10-11, 11-12
        expect(slots[0].startTime.getHours()).toBe(8);
        expect(slots[0].endTime.getHours()).toBe(9);
        expect(slots[3].startTime.getHours()).toBe(11);
        expect(slots[3].endTime.getHours()).toBe(12);
      });

      it('should generate 90-minute slots', () => {
        const date = new Date('2025-01-01');
        const slots = generateDailySlots(date, '08:00', '14:00', 90);

        expect(slots.length).toBe(4); // 8-9:30, 9:30-11, 11-12:30, 12:30-14
      });
    });

    describe('isToday', () => {
      it('should return true for today', () => {
        expect(isToday(new Date())).toBe(true);
      });

      it('should return false for yesterday', () => {
        const yesterday = addDays(new Date(), -1);
        expect(isToday(yesterday)).toBe(false);
      });
    });
  });

  describe('Validation', () => {
    describe('isValidSaudiPhone', () => {
      it('should accept +966 format', () => {
        expect(isValidSaudiPhone('+966512345678')).toBe(true);
      });

      it('should accept 00966 format', () => {
        expect(isValidSaudiPhone('00966512345678')).toBe(true);
      });

      it('should accept 05 format', () => {
        expect(isValidSaudiPhone('0512345678')).toBe(true);
      });

      it('should accept 5 format', () => {
        expect(isValidSaudiPhone('512345678')).toBe(true);
      });

      it('should reject invalid numbers', () => {
        expect(isValidSaudiPhone('123456')).toBe(false);
        expect(isValidSaudiPhone('+1234567890')).toBe(false);
      });
    });

    describe('normalizeSaudiPhone', () => {
      it('should normalize to +966 format', () => {
        expect(normalizeSaudiPhone('0512345678')).toBe('+966512345678');
        expect(normalizeSaudiPhone('512345678')).toBe('+966512345678');
        expect(normalizeSaudiPhone('00966512345678')).toBe('+966512345678');
        expect(normalizeSaudiPhone('+966512345678')).toBe('+966512345678');
      });
    });

    describe('isValidEmail', () => {
      it('should accept valid emails', () => {
        expect(isValidEmail('test@example.com')).toBe(true);
        expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      });

      it('should reject invalid emails', () => {
        expect(isValidEmail('invalid')).toBe(false);
        expect(isValidEmail('no@domain')).toBe(false);
        expect(isValidEmail('@domain.com')).toBe(false);
      });
    });

    describe('isValidSubdomain', () => {
      it('should accept valid subdomains', () => {
        expect(isValidSubdomain('elite-padel')).toBe(true);
        expect(isValidSubdomain('club123')).toBe(true);
        expect(isValidSubdomain('abc')).toBe(true);
      });

      it('should reject invalid subdomains', () => {
        expect(isValidSubdomain('AB')).toBe(false); // Too short
        expect(isValidSubdomain('Elite-Padel')).toBe(false); // Uppercase
        expect(isValidSubdomain('-start')).toBe(false); // Starts with hyphen
        expect(isValidSubdomain('end-')).toBe(false); // Ends with hyphen
      });
    });

    describe('validateTimeRange', () => {
      it('should validate correct time range', () => {
        const start = new Date('2025-01-01T10:00:00');
        const end = new Date('2025-01-01T11:00:00');
        expect(validateTimeRange(start, end).isValid).toBe(true);
      });

      it('should reject end before start', () => {
        const start = new Date('2025-01-01T11:00:00');
        const end = new Date('2025-01-01T10:00:00');
        expect(validateTimeRange(start, end).isValid).toBe(false);
      });

      it('should enforce minimum duration', () => {
        const start = new Date('2025-01-01T10:00:00');
        const end = new Date('2025-01-01T10:30:00');
        expect(validateTimeRange(start, end, 60).isValid).toBe(false);
        expect(validateTimeRange(start, end, 30).isValid).toBe(true);
      });
    });

    describe('validatePhone', () => {
      it('should return error for empty phone', () => {
        const result = validatePhone('');
        expect(result.isValid).toBe(false);
        expect(result.error).toBe('Phone number is required');
      });
    });
  });

  describe('Formatters', () => {
    describe('formatCurrency', () => {
      it('should format SAR currency', () => {
        const formatted = formatCurrency(150);
        expect(formatted).toContain('150');
        expect(formatted).toContain('SAR');
      });
    });

    describe('formatDuration', () => {
      it('should format minutes', () => {
        expect(formatDuration(30)).toBe('30 min');
        expect(formatDuration(60)).toBe('1 hour');
        expect(formatDuration(90)).toBe('1h 30m');
        expect(formatDuration(120)).toBe('2 hours');
      });
    });

    describe('formatPhoneDisplay', () => {
      it('should format Saudi phone for display', () => {
        expect(formatPhoneDisplay('+966512345678')).toBe('+966 51 234 5678');
      });
    });

    describe('enumToDisplay', () => {
      it('should convert enum to display string', () => {
        expect(enumToDisplay('PADEL_COURT')).toBe('Padel Court');
        expect(enumToDisplay('SPORTS_FACILITY')).toBe('Sports Facility');
      });
    });

    describe('capitalize', () => {
      it('should capitalize first letter', () => {
        expect(capitalize('hello')).toBe('Hello');
        expect(capitalize('HELLO')).toBe('Hello');
      });
    });

    describe('formatPercentage', () => {
      it('should format percentage', () => {
        expect(formatPercentage(75.5)).toBe('76%');
        expect(formatPercentage(75.5, 1)).toBe('75.5%');
      });
    });

    describe('getOccupancyLevel', () => {
      it('should return correct level', () => {
        expect(getOccupancyLevel(100)).toBe('full');
        expect(getOccupancyLevel(80)).toBe('high');
        expect(getOccupancyLevel(60)).toBe('medium');
        expect(getOccupancyLevel(30)).toBe('low');
      });
    });
  });

  describe('Booking Reference', () => {
    describe('generateBookingReference', () => {
      it('should generate correct format', () => {
        const ref = generateBookingReference(1234, 2025);
        expect(ref).toBe('KH-2025-001234');
      });

      it('should pad sequence number', () => {
        const ref = generateBookingReference(1, 2025);
        expect(ref).toBe('KH-2025-000001');
      });
    });

    describe('parseBookingReference', () => {
      it('should parse valid reference', () => {
        const parsed = parseBookingReference('KH-2025-001234');
        expect(parsed).toEqual({
          prefix: 'KH',
          year: 2025,
          sequenceNumber: 1234,
        });
      });

      it('should return null for invalid reference', () => {
        expect(parseBookingReference('INVALID')).toBeNull();
        expect(parseBookingReference('KH-2025-12345')).toBeNull();
      });
    });

    describe('isValidBookingReferenceFormat', () => {
      it('should validate correct format', () => {
        expect(isValidBookingReferenceFormat('KH-2025-001234')).toBe(true);
        expect(isValidBookingReferenceFormat('KH-2025-12345')).toBe(false);
        expect(isValidBookingReferenceFormat('XX-2025-001234')).toBe(false);
      });
    });

    describe('generateConfirmationCode', () => {
      it('should generate 6 character code', () => {
        const code = generateConfirmationCode();
        expect(code.length).toBe(6);
        expect(/^[A-Z0-9]+$/.test(code)).toBe(true);
      });

      it('should generate unique codes', () => {
        const codes = new Set<string>();
        for (let i = 0; i < 100; i++) {
          codes.add(generateConfirmationCode());
        }
        expect(codes.size).toBe(100); // All unique
      });
    });
  });
});
