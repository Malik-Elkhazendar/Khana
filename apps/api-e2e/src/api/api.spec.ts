import axios from 'axios';

describe('API', () => {
  let facilityId: string;
  let bookedStartTime: string;
  let bookedEndTime: string;
  let accessToken: string;

  const authHeaders = () => ({
    Authorization: `Bearer ${accessToken}`,
  });

  const expectHttpError = async (
    request: Promise<unknown>,
    expectedStatus: number
  ) => {
    try {
      await request;
      fail(`Expected HTTP ${expectedStatus}`);
    } catch (error: unknown) {
      const axiosError = error as { response?: { status?: number } };
      expect(axiosError.response?.status).toBe(expectedStatus);
    }
  };

  beforeAll(async () => {
    const email = `bookings-e2e-${Date.now()}@khana.dev`;
    const password = 'Password123';

    const registerRes = await axios.post(`/api/v1/auth/register`, {
      email,
      password,
      name: 'Bookings E2E User',
    });
    accessToken = registerRes.data.accessToken;

    const facilitiesRes = await axios.get(`/api/v1/bookings/facilities`, {
      headers: authHeaders(),
    });
    facilityId = facilitiesRes.data?.[0]?.id;
    expect(facilityId).toBeTruthy();

    // Create a deterministic booking for conflict/list tests (tomorrow 10:00-11:00).
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    bookedStartTime = tomorrow.toISOString();
    bookedEndTime = new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString();

    await axios.post(
      `/api/v1/bookings`,
      {
        facilityId,
        startTime: bookedStartTime,
        endTime: bookedEndTime,
        customerName: 'Test Customer',
        customerPhone: '+966512345678',
      },
      { headers: authHeaders() }
    );
  });

  describe('GET /api', () => {
    it('should return a message', async () => {
      const res = await axios.get(`/api`);

      expect(res.status).toBe(200);
      expect(res.data).toEqual({ message: 'Hello API' });
    });
  });

  describe('Bookings Authentication', () => {
    it('should return 401 for GET /api/v1/bookings without token', async () => {
      await expectHttpError(axios.get(`/api/v1/bookings`), 401);
    });

    it('should return 401 for POST /api/v1/bookings without token', async () => {
      await expectHttpError(
        axios.post(`/api/v1/bookings`, {
          facilityId,
          startTime: bookedStartTime,
          endTime: bookedEndTime,
          customerName: 'Unauth Customer',
          customerPhone: '+966500000000',
        }),
        401
      );
    });

    it('should return 401 for PATCH /api/v1/bookings/:id/status without token', async () => {
      await expectHttpError(
        axios.patch(
          `/api/v1/bookings/00000000-0000-4000-8000-000000000000/status`,
          {
            status: 'CANCELLED',
            cancellationReason: 'No longer needed',
          }
        ),
        401
      );
    });

    it('should return 401 for POST /api/v1/bookings/preview without token', async () => {
      await expectHttpError(
        axios.post(`/api/v1/bookings/preview`, {
          facilityId,
          startTime: bookedStartTime,
          endTime: bookedEndTime,
        }),
        401
      );
    });

    it('should return 401 for GET /api/v1/bookings/facilities without token', async () => {
      await expectHttpError(axios.get(`/api/v1/bookings/facilities`), 401);
    });
  });

  describe('GET /api/v1/bookings/facilities', () => {
    it('should return list of facilities for authenticated user', async () => {
      const res = await axios.get(`/api/v1/bookings/facilities`, {
        headers: authHeaders(),
      });

      expect(res.status).toBe(200);
      expect(Array.isArray(res.data)).toBe(true);
      expect(res.data.length).toBeGreaterThan(0);

      const facility = res.data[0];
      expect(facility).toHaveProperty('id');
      expect(facility).toHaveProperty('name');
      expect(facility).toHaveProperty('basePrice');
      expect(facility).toHaveProperty('currency');
    });
  });

  describe('POST /api/v1/bookings/preview', () => {
    it('should return successful preview for available slot', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);

      const startTime = tomorrow.toISOString();
      const endTime = new Date(
        tomorrow.getTime() + 60 * 60 * 1000
      ).toISOString();

      const res = await axios.post(
        `/api/v1/bookings/preview`,
        {
          facilityId,
          startTime,
          endTime,
        },
        { headers: authHeaders() }
      );

      expect(res.status).toBe(200);
      expect(res.data.canBook).toBe(true);
      expect(res.data.priceBreakdown).toBeDefined();
      expect(res.data.priceBreakdown.total).toBeGreaterThan(0);
      expect(res.data.priceBreakdown.currency).toBe('SAR');
      expect(res.data.conflict).toBeUndefined();
    });

    it('should return conflict for occupied slot', async () => {
      const res = await axios.post(
        `/api/v1/bookings/preview`,
        {
          facilityId,
          startTime: bookedStartTime,
          endTime: bookedEndTime,
        },
        { headers: authHeaders() }
      );

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
      const endTime = new Date(
        tomorrow.getTime() + 60 * 60 * 1000
      ).toISOString();

      await axios.post(
        `/api/v1/bookings`,
        {
          facilityId,
          startTime,
          endTime,
          customerName: 'Pending Hold',
          customerPhone: '+966512345679',
          status: 'PENDING',
        },
        { headers: authHeaders() }
      );

      const res = await axios.post(
        `/api/v1/bookings/preview`,
        {
          facilityId,
          startTime,
          endTime,
        },
        { headers: authHeaders() }
      );

      expect(res.status).toBe(200);
      expect(res.data.canBook).toBe(false);
      expect(res.data.conflict).toBeDefined();
      expect(res.data.conflict.hasConflict).toBe(true);
    });

    it('should return validation errors for invalid input', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(15, 0, 0, 0);

      const startTime = tomorrow.toISOString();
      const endTime = new Date(
        tomorrow.getTime() - 60 * 60 * 1000
      ).toISOString();

      const res = await axios.post(
        `/api/v1/bookings/preview`,
        {
          facilityId,
          startTime,
          endTime,
        },
        { headers: authHeaders() }
      );

      expect(res.status).toBe(200);
      expect(res.data.canBook).toBe(false);
      expect(res.data.validationErrors).toBeDefined();
      expect(res.data.validationErrors.length).toBeGreaterThan(0);
    });

    it('should return 404 for non-existent facility', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);

      await expectHttpError(
        axios.post(
          `/api/v1/bookings/preview`,
          {
            facilityId: '00000000-0000-4000-8000-000000000000',
            startTime: tomorrow.toISOString(),
            endTime: new Date(
              tomorrow.getTime() + 60 * 60 * 1000
            ).toISOString(),
          },
          { headers: authHeaders() }
        ),
        404
      );
    });

    it('should apply promo code discount', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);

      const res = await axios.post(
        `/api/v1/bookings/preview`,
        {
          facilityId,
          startTime: tomorrow.toISOString(),
          endTime: new Date(tomorrow.getTime() + 60 * 60 * 1000).toISOString(),
          promoCode: 'SUMMER10',
        },
        { headers: authHeaders() }
      );

      expect(res.status).toBe(200);
      expect(res.data.priceBreakdown.promoCode).toBe('SUMMER10');
      expect(res.data.priceBreakdown.promoDiscount).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/bookings', () => {
    it('should return list of bookings (optionally filtered) for authenticated user', async () => {
      const res = await axios.get(`/api/v1/bookings`, {
        params: { facilityId },
        headers: authHeaders(),
      });

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

  describe('PATCH /api/v1/bookings/:id/status', () => {
    it('should reject invalid status transitions', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(16, 0, 0, 0);

      const startTime = tomorrow.toISOString();
      const endTime = new Date(
        tomorrow.getTime() + 60 * 60 * 1000
      ).toISOString();

      const created = await axios.post(
        `/api/v1/bookings`,
        {
          facilityId,
          startTime,
          endTime,
          customerName: 'Transition Test',
          customerPhone: '+966512345690',
        },
        { headers: authHeaders() }
      );

      const bookingId = created.data.id as string;

      await axios.patch(
        `/api/v1/bookings/${bookingId}/status`,
        {
          status: 'CANCELLED',
          cancellationReason: 'Customer requested cancellation',
        },
        { headers: authHeaders() }
      );

      await expectHttpError(
        axios.patch(
          `/api/v1/bookings/${bookingId}/status`,
          { status: 'CONFIRMED' },
          { headers: authHeaders() }
        ),
        400
      );
    });
  });
});
