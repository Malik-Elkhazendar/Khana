import axios from 'axios';

describe('API', () => {
  let facilityId: string;
  let bookedStartTime: string;
  let bookedEndTime: string;

  beforeAll(async () => {
    const res = await axios.get(`/api/v1/bookings/facilities`);
    facilityId = res.data?.[0]?.id;

    // Create a deterministic booking for conflict/list tests (tomorrow at 10:00-11:00).
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    bookedStartTime = tomorrow.toISOString();
    bookedEndTime = new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString();

    await axios.post(`/api/v1/bookings`, {
      facilityId,
      startTime: bookedStartTime,
      endTime: bookedEndTime,
      customerName: 'Test Customer',
      customerPhone: '+966512345678',
    });
  });

  describe('GET /api', () => {
    it('should return a message', async () => {
      const res = await axios.get(`/api`);

      expect(res.status).toBe(200);
      expect(res.data).toEqual({ message: 'Hello API' });
    });
  });

  describe('GET /api/v1/bookings/facilities', () => {
    it('should return list of facilities', async () => {
      const res = await axios.get(`/api/v1/bookings/facilities`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
      expect(res.data.length).toBeGreaterThan(0);

      // Verify facility structure
      const facility = res.data[0];
      expect(facility).toHaveProperty('id');
      expect(facility).toHaveProperty('name');
      expect(facility).toHaveProperty('basePrice');
      expect(facility).toHaveProperty('currency');
    });
  });

  describe('POST /api/v1/bookings/preview', () => {
    it('should return successful preview for available slot', async () => {
      // Request a slot that should be available (tomorrow at 9 AM)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);

      const startTime = tomorrow.toISOString();
      const endTime = new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString();

      const res = await axios.post(`/api/v1/bookings/preview`, {
        facilityId,
        startTime,
        endTime,
      });

      expect(res.status).toBe(200);
      expect(res.data.canBook).toBe(true);
      expect(res.data.priceBreakdown).toBeDefined();
      expect(res.data.priceBreakdown.total).toBeGreaterThan(0);
      expect(res.data.priceBreakdown.currency).toBe('SAR');
      expect(res.data.conflict).toBeUndefined();
    });

    it('should return conflict for occupied slot', async () => {
      const res = await axios.post(`/api/v1/bookings/preview`, {
        facilityId,
        startTime: bookedStartTime,
        endTime: bookedEndTime,
      });

      expect(res.status).toBe(200);
      expect(res.data.canBook).toBe(false);
      expect(res.data.conflict).toBeDefined();
      expect(res.data.conflict.hasConflict).toBe(true);
    });

    it('should block conflicts for active pending holds', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(12, 0, 0, 0);

      const startTime = tomorrow.toISOString();
      const endTime = new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString();

      await axios.post(`/api/v1/bookings`, {
        facilityId,
        startTime,
        endTime,
        customerName: 'Pending Hold',
        customerPhone: '+966512345679',
        status: 'PENDING',
      });

      const res = await axios.post(`/api/v1/bookings/preview`, {
        facilityId,
        startTime,
        endTime,
      });

      expect(res.status).toBe(200);
      expect(res.data.canBook).toBe(false);
      expect(res.data.conflict).toBeDefined();
      expect(res.data.conflict.hasConflict).toBe(true);
    });

    it('should return validation errors for invalid input', async () => {
      // Invalid: end time before start time
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(15, 0, 0, 0);

      const startTime = tomorrow.toISOString();
      const endTime = new Date(tomorrow.getTime() - 60 * 60 * 1000).toISOString();

      const res = await axios.post(`/api/v1/bookings/preview`, {
        facilityId,
        startTime,
        endTime,
      });

      expect(res.status).toBe(200);
      expect(res.data.canBook).toBe(false);
      expect(res.data.validationErrors).toBeDefined();
      expect(res.data.validationErrors.length).toBeGreaterThan(0);
    });

    it('should return 404 for non-existent facility', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);

      try {
        await axios.post(`/api/v1/bookings/preview`, {
          facilityId: '00000000-0000-4000-8000-000000000000',
          startTime: tomorrow.toISOString(),
          endTime: new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString(),
        });
        fail('Expected 404 error');
      } catch (error: unknown) {
        const axiosError = error as { response?: { status: number } };
        expect(axiosError.response?.status).toBe(404);
      }
    });

    it('should apply promo code discount', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);

      const res = await axios.post(`/api/v1/bookings/preview`, {
        facilityId,
        startTime: tomorrow.toISOString(),
        endTime: new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString(),
        promoCode: 'SUMMER10',
      });

      expect(res.status).toBe(200);
      expect(res.data.priceBreakdown.promoCode).toBe('SUMMER10');
      expect(res.data.priceBreakdown.promoDiscount).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/bookings', () => {
    it('should return list of bookings (optionally filtered)', async () => {
      const res = await axios.get(`/api/v1/bookings`, { params: { facilityId } });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
      expect(res.data.length).toBeGreaterThan(0);

      const booking = res.data[0];
      expect(booking).toHaveProperty('id');
      expect(booking).toHaveProperty('startTime');
      expect(booking).toHaveProperty('endTime');
      expect(booking).toHaveProperty('customerName');
      expect(booking).toHaveProperty('customerPhone');
      expect(booking).toHaveProperty('status');
    });
  });
});
