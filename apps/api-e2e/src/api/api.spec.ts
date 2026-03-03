import axios from 'axios';

describe('API', () => {
  let facilityId: string;
  let bookedStartTime: string;
  let bookedEndTime: string;
  let accessToken: string;
  let tenantId: string;
  let currentUserRole: string;

  const tenantHeaders = () => ({
    'x-tenant-id': tenantId,
  });

  const authHeadersFor = (token: string) => ({
    Authorization: `Bearer ${token}`,
    ...tenantHeaders(),
  });

  const authHeaders = () => authHeadersFor(accessToken);

  const findAvailableSlot = async (baseStartTime: Date) => {
    for (let offsetHours = 0; offsetHours < 16; offsetHours += 1) {
      const candidateStart = new Date(
        baseStartTime.getTime() + offsetHours * 60 * 60 * 1000
      );
      const candidateEnd = new Date(candidateStart.getTime() + 60 * 60 * 1000);
      const preview = await axios.post(
        `/api/v1/bookings/preview`,
        {
          facilityId,
          startTime: candidateStart.toISOString(),
          endTime: candidateEnd.toISOString(),
        },
        { headers: authHeaders() }
      );

      if (preview.data?.canBook) {
        return {
          startTime: candidateStart.toISOString(),
          endTime: candidateEnd.toISOString(),
        };
      }
    }

    throw new Error('No available booking slot found for e2e test setup');
  };

  const findAvailableSlotFor = async (
    token: string,
    targetFacilityId: string,
    baseStartTime: Date
  ) => {
    for (let offsetHours = 0; offsetHours < 24; offsetHours += 1) {
      const candidateStart = new Date(
        baseStartTime.getTime() + offsetHours * 60 * 60 * 1000
      );
      const candidateEnd = new Date(candidateStart.getTime() + 60 * 60 * 1000);
      const preview = await axios.post(
        `/api/v1/bookings/preview`,
        {
          facilityId: targetFacilityId,
          startTime: candidateStart.toISOString(),
          endTime: candidateEnd.toISOString(),
        },
        { headers: authHeadersFor(token) }
      );

      if (preview.data?.canBook) {
        return {
          startTime: candidateStart.toISOString(),
          endTime: candidateEnd.toISOString(),
        };
      }
    }

    throw new Error('No available booking slot found for role-scope test');
  };

  const registerWithRetryOnThrottle = async (
    email: string,
    name: string
  ): Promise<{
    accessToken: string;
    user: { id: string; role: string };
  }> => {
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const res = await axios.post(
          `/api/v1/auth/register`,
          {
            email,
            password: 'Password123',
            name,
          },
          {
            headers: tenantHeaders(),
          }
        );

        return res.data;
      } catch (error: unknown) {
        const status = (error as { response?: { status?: number } }).response
          ?.status;
        if (status !== 429 || attempt === maxAttempts) {
          throw error;
        }

        await new Promise((resolve) => setTimeout(resolve, 61000));
      }
    }

    throw new Error('Registration retry exhausted');
  };

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
    const tenantRes = await axios.get(`/api/v1/auth/tenant`);
    tenantId = tenantRes.data?.id;
    expect(tenantId).toBeTruthy();

    const registerRes = await axios.post(
      `/api/v1/auth/register`,
      {
        email,
        password,
        name: 'Bookings E2E User',
      },
      {
        headers: tenantHeaders(),
      }
    );
    accessToken = registerRes.data.accessToken;
    currentUserRole = registerRes.data.user?.role;

    const facilitiesRes = await axios.get(`/api/v1/bookings/facilities`, {
      headers: authHeaders(),
    });
    facilityId = facilitiesRes.data?.[0]?.id;
    expect(facilityId).toBeTruthy();

    // Find an available slot for conflict/list tests to keep suite deterministic.
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(8, 0, 0, 0);

    const selectedSlot = await findAvailableSlot(tomorrow);
    bookedStartTime = selectedSlot.startTime;
    bookedEndTime = selectedSlot.endTime;

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
      expect(res.headers['x-request-id']).toBeTruthy();
    });

    it('should include API security headers', async () => {
      const res = await axios.get(`/api`);

      expect(res.status).toBe(200);
      expect(res.headers['x-powered-by']).toBeUndefined();
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['referrer-policy']).toBe('no-referrer');
      expect(res.headers['content-security-policy']).toBeUndefined();
      expect(res.headers['strict-transport-security']).toBeUndefined();
    });

    it('should echo a valid custom x-request-id header', async () => {
      const customRequestId = 'trace-id/e2e-123';
      const res = await axios.get(`/api`, {
        headers: {
          'x-request-id': customRequestId,
        },
      });

      expect(res.status).toBe(200);
      expect(res.headers['x-request-id']).toBe(customRequestId);
    });
  });

  describe('Security hardening', () => {
    it('should require authentication for POST /api/v1/test-email', async () => {
      await expectHttpError(
        axios.post('/api/v1/test-email', { email: 'test@khana.dev' }),
        401
      );
    });
  });

  describe('Auth session security', () => {
    it('should revoke session when a used refresh token is replayed', async () => {
      const registerRes = await axios.post(
        '/api/v1/auth/register',
        {
          email: `refresh-reuse-${Date.now()}@khana.dev`,
          password: 'Password123',
          name: 'Refresh Reuse Test',
        },
        { headers: tenantHeaders() }
      );

      const originalRefreshToken = registerRes.data.refreshToken as string;
      expect(originalRefreshToken).toBeTruthy();

      const rotated = await axios.post(
        '/api/v1/auth/refresh',
        { refreshToken: originalRefreshToken },
        { headers: tenantHeaders() }
      );
      const rotatedRefreshToken = rotated.data.refreshToken as string;
      expect(rotated.status).toBe(200);
      expect(rotatedRefreshToken).toBeTruthy();
      expect(rotatedRefreshToken).not.toBe(originalRefreshToken);

      // Replaying the already-used token should trigger session revocation.
      await expectHttpError(
        axios.post(
          '/api/v1/auth/refresh',
          { refreshToken: originalRefreshToken },
          { headers: tenantHeaders() }
        ),
        401
      );

      // The rotated token from the same session should also be invalid now.
      await expectHttpError(
        axios.post(
          '/api/v1/auth/refresh',
          { refreshToken: rotatedRefreshToken },
          { headers: tenantHeaders() }
        ),
        401
      );
    }, 20000);
  });

  describe('Auth throttling', () => {
    it('should throttle repeated register attempts', async () => {
      const statuses: number[] = [];

      for (let attempt = 0; attempt < 5; attempt += 1) {
        try {
          const res = await axios.post(
            '/api/v1/auth/register',
            {
              email: `register-throttle-${Date.now()}-${attempt}@khana.dev`,
              password: 'Password123',
              name: `Throttle ${attempt}`,
            },
            { headers: tenantHeaders() }
          );
          statuses.push(res.status);
        } catch (error: unknown) {
          const axiosError = error as { response?: { status?: number } };
          statuses.push(axiosError.response?.status ?? 0);
        }
      }

      expect(statuses).toContain(429);
    });

    it('should throttle repeated login attempts', async () => {
      const statuses: number[] = [];

      for (let attempt = 0; attempt < 6; attempt += 1) {
        try {
          const res = await axios.post(
            '/api/v1/auth/login',
            {
              email: `bookings-e2e-${Date.now()}@khana.dev`,
              password: 'WrongPassword123',
            },
            { headers: tenantHeaders() }
          );
          statuses.push(res.status);
        } catch (error: unknown) {
          const axiosError = error as { response?: { status?: number } };
          statuses.push(axiosError.response?.status ?? 0);
        }
      }

      expect(statuses).toContain(429);
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

    it('should preserve custom x-request-id on authenticated requests', async () => {
      const customRequestId = 'trace-id/facilities-echo-001';
      const res = await axios.get(`/api/v1/bookings/facilities`, {
        headers: {
          ...authHeaders(),
          'x-request-id': customRequestId,
        },
      });

      expect(res.status).toBe(200);
      expect(res.headers['x-request-id']).toBe(customRequestId);
    });
  });

  describe('POST /api/v1/bookings', () => {
    it('should reject invalid time windows at create', async () => {
      const invalidDay = new Date();
      invalidDay.setDate(invalidDay.getDate() + 3);
      invalidDay.setHours(10, 0, 0, 0);

      await expectHttpError(
        axios.post(
          '/api/v1/bookings',
          {
            facilityId,
            startTime: invalidDay.toISOString(),
            endTime: new Date(
              invalidDay.getTime() - 60 * 60 * 1000
            ).toISOString(),
            customerName: 'Invalid Window',
            customerPhone: '+966500000001',
          },
          { headers: authHeaders() }
        ),
        400
      );
    });

    it('should reject terminal status values at create', async () => {
      const statusDay = new Date();
      statusDay.setDate(statusDay.getDate() + 4);
      statusDay.setHours(9, 0, 0, 0);

      const slot = await findAvailableSlot(statusDay);

      await expectHttpError(
        axios.post(
          '/api/v1/bookings',
          {
            facilityId,
            startTime: slot.startTime,
            endTime: slot.endTime,
            customerName: 'Terminal Status',
            customerPhone: '+966500000002',
            status: 'COMPLETED',
          },
          { headers: authHeaders() }
        ),
        400
      );
    });

    it('should reject client-supplied paymentStatus at create', async () => {
      const paymentDay = new Date();
      paymentDay.setDate(paymentDay.getDate() + 4);
      paymentDay.setHours(11, 0, 0, 0);

      const slot = await findAvailableSlot(paymentDay);

      await expectHttpError(
        axios.post(
          '/api/v1/bookings',
          {
            facilityId,
            startTime: slot.startTime,
            endTime: slot.endTime,
            customerName: 'Payment Status Injection',
            customerPhone: '+966500000003',
            paymentStatus: 'PAID',
          },
          { headers: authHeaders() }
        ),
        400
      );
    });

    it('should prevent double-booking for concurrent creates', async () => {
      const raceDay = new Date();
      raceDay.setDate(raceDay.getDate() + 5);
      raceDay.setHours(8, 0, 0, 0);

      const slot = await findAvailableSlot(raceDay);
      const requestBody = {
        facilityId,
        startTime: slot.startTime,
        endTime: slot.endTime,
        customerName: 'Race Condition Test',
        customerPhone: '+966512345699',
      };

      const results = await Promise.allSettled([
        axios.post('/api/v1/bookings', requestBody, { headers: authHeaders() }),
        axios.post('/api/v1/bookings', requestBody, { headers: authHeaders() }),
      ]);

      const fulfilled = results.filter(
        (result) => result.status === 'fulfilled'
      );
      const rejected = results.filter((result) => result.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);

      const rejectedStatus = (rejected[0] as PromiseRejectedResult).reason
        ?.response?.status;
      expect(rejectedStatus).toBe(409);
    });
  });

  describe('POST /api/v1/bookings/preview', () => {
    it('should return successful preview for available slot', async () => {
      const previewDay = new Date();
      previewDay.setDate(previewDay.getDate() + 3);
      previewDay.setHours(8, 0, 0, 0);

      const slot = await findAvailableSlot(previewDay);

      const res = await axios.post(
        `/api/v1/bookings/preview`,
        {
          facilityId,
          startTime: slot.startTime,
          endTime: slot.endTime,
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
      const holdDay = new Date();
      holdDay.setDate(holdDay.getDate() + 2);
      holdDay.setHours(8, 0, 0, 0);

      const holdSlot = await findAvailableSlot(holdDay);
      const startTime = holdSlot.startTime;
      const endTime = holdSlot.endTime;

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

    it('should return promo validation for provided promo code', async () => {
      const promoDay = new Date();
      promoDay.setDate(promoDay.getDate() + 4);
      promoDay.setHours(8, 0, 0, 0);
      const slot = await findAvailableSlot(promoDay);

      const res = await axios.post(
        `/api/v1/bookings/preview`,
        {
          facilityId,
          startTime: slot.startTime,
          endTime: slot.endTime,
          promoCode: 'SUMMER10',
        },
        { headers: authHeaders() }
      );

      expect(res.status).toBe(200);
      expect(res.data.canBook).toBe(true);
      expect(res.data.promoValidation).toBeDefined();
      expect(res.data.promoValidation.code).toBe('SUMMER10');
      expect(res.data.promoValidation.isValid).toBe(false);
      expect(res.data.priceBreakdown.promoCode).toBeUndefined();
      expect(res.data.priceBreakdown.promoDiscount).toBeUndefined();
    });
  });

  describe('Promo Codes', () => {
    it('supports create/list/patch promo code lifecycle for owner/manager', async () => {
      if (currentUserRole !== 'OWNER' && currentUserRole !== 'MANAGER') {
        return;
      }

      const code = `OPS${Date.now()}`;
      const created = await axios.post(
        `/api/v1/promo-codes`,
        {
          code,
          discountType: 'PERCENTAGE',
          discountValue: 10,
          maxUses: 5,
          facilityScope: 'ALL_FACILITIES',
        },
        { headers: authHeaders() }
      );

      expect(created.status).toBe(201);
      expect(created.data.code).toBe(code.toUpperCase());

      const listed = await axios.get(`/api/v1/promo-codes`, {
        headers: authHeaders(),
      });
      expect(listed.status).toBe(200);
      expect(Array.isArray(listed.data.items)).toBe(true);
      expect(
        listed.data.items.some(
          (item: { id: string }) => item.id === created.data.id
        )
      ).toBe(true);

      const updated = await axios.patch(
        `/api/v1/promo-codes/${created.data.id}`,
        { isActive: false },
        { headers: authHeaders() }
      );

      expect(updated.status).toBe(200);
      expect(updated.data.isActive).toBe(false);
    });

    it('applies valid promo in preview and consumes maxUses on booking create', async () => {
      if (currentUserRole !== 'OWNER' && currentUserRole !== 'MANAGER') {
        return;
      }

      const code = `SAVE${Date.now()}`;
      await axios.post(
        `/api/v1/promo-codes`,
        {
          code,
          discountType: 'PERCENTAGE',
          discountValue: 15,
          maxUses: 1,
          facilityScope: 'ALL_FACILITIES',
        },
        { headers: authHeaders() }
      );

      const dayOne = new Date();
      dayOne.setDate(dayOne.getDate() + 6);
      dayOne.setHours(8, 0, 0, 0);
      const slotOne = await findAvailableSlot(dayOne);

      const previewOne = await axios.post(
        `/api/v1/bookings/preview`,
        {
          facilityId,
          startTime: slotOne.startTime,
          endTime: slotOne.endTime,
          promoCode: code,
        },
        { headers: authHeaders() }
      );

      expect(previewOne.status).toBe(200);
      expect(previewOne.data.promoValidation?.isValid).toBe(true);
      expect(previewOne.data.priceBreakdown?.promoCode).toBe(code);
      expect(previewOne.data.priceBreakdown?.promoDiscount).toBeGreaterThan(0);

      const created = await axios.post(
        `/api/v1/bookings`,
        {
          facilityId,
          startTime: slotOne.startTime,
          endTime: slotOne.endTime,
          customerName: 'Promo Customer',
          customerPhone: '+966500001111',
          promoCode: code.toLowerCase(),
        },
        { headers: authHeaders() }
      );

      expect(created.status).toBe(201);
      expect(created.data.priceBreakdown?.promoCode).toBe(code);

      const dayTwo = new Date();
      dayTwo.setDate(dayTwo.getDate() + 7);
      dayTwo.setHours(8, 0, 0, 0);
      const slotTwo = await findAvailableSlot(dayTwo);

      const previewTwo = await axios.post(
        `/api/v1/bookings/preview`,
        {
          facilityId,
          startTime: slotTwo.startTime,
          endTime: slotTwo.endTime,
          promoCode: code,
        },
        { headers: authHeaders() }
      );

      expect(previewTwo.status).toBe(200);
      expect(previewTwo.data.promoValidation?.isValid).toBe(false);
      expect(previewTwo.data.promoValidation?.reason).toBe('USAGE_EXCEEDED');
      expect(previewTwo.data.priceBreakdown?.promoCode).toBeUndefined();
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
      const transitionDay = new Date();
      transitionDay.setDate(transitionDay.getDate() + 6);
      transitionDay.setHours(8, 0, 0, 0);
      const slot = await findAvailableSlot(transitionDay);

      const created = await axios.post(
        `/api/v1/bookings`,
        {
          facilityId,
          startTime: slot.startTime,
          endTime: slot.endTime,
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
        currentUserRole === 'STAFF' ? 403 : 400
      );
    });
  });

  describe('Bookings RBAC ownership and scoping', () => {
    it('enforces staff own-only visibility and mutation rules', async () => {
      const ownerRes = await registerWithRetryOnThrottle(
        `bookings-rbac-owner-${Date.now()}@khana.dev`,
        'RBAC Owner User'
      );
      const staffRes = await registerWithRetryOnThrottle(
        `bookings-rbac-staff-${Date.now()}@khana.dev`,
        'RBAC Staff User'
      );

      expect(staffRes.user?.role).toBe('STAFF');

      const ownerToken = ownerRes.accessToken as string;
      const staffToken = staffRes.accessToken as string;
      const ownerUserId = ownerRes.user.id as string;
      const staffUserId = staffRes.user.id as string;

      const facilitiesRes = await axios.get(`/api/v1/bookings/facilities`, {
        headers: authHeadersFor(ownerToken),
      });
      const scopedFacilityId = facilitiesRes.data?.[0]?.id as string;
      expect(scopedFacilityId).toBeTruthy();

      const ownerBase = new Date();
      ownerBase.setDate(ownerBase.getDate() + 7);
      ownerBase.setHours(8, 0, 0, 0);
      const ownerSlot = await findAvailableSlotFor(
        ownerToken,
        scopedFacilityId,
        ownerBase
      );

      const ownerBooking = await axios.post(
        `/api/v1/bookings`,
        {
          facilityId: scopedFacilityId,
          startTime: ownerSlot.startTime,
          endTime: ownerSlot.endTime,
          customerName: 'RBAC Owner Booking',
          customerPhone: '+966511111111',
        },
        { headers: authHeadersFor(ownerToken) }
      );
      expect(ownerBooking.status).toBe(201);
      expect(ownerBooking.data.createdByUserId).toBe(ownerUserId);

      const staffBase = new Date(ownerBase.getTime() + 24 * 60 * 60 * 1000);
      const staffSlot = await findAvailableSlotFor(
        staffToken,
        scopedFacilityId,
        staffBase
      );
      const staffBooking = await axios.post(
        `/api/v1/bookings`,
        {
          facilityId: scopedFacilityId,
          startTime: staffSlot.startTime,
          endTime: staffSlot.endTime,
          customerName: 'RBAC Staff Booking',
          customerPhone: '+966522222222',
        },
        { headers: authHeadersFor(staffToken) }
      );
      expect(staffBooking.status).toBe(201);
      expect(staffBooking.data.createdByUserId).toBe(staffUserId);

      const staffList = await axios.get(`/api/v1/bookings`, {
        params: { facilityId: scopedFacilityId },
        headers: authHeadersFor(staffToken),
      });
      expect(staffList.status).toBe(200);
      expect(Array.isArray(staffList.data)).toBe(true);
      expect(staffList.data.length).toBeGreaterThan(0);
      expect(
        staffList.data.every(
          (booking: { createdByUserId?: string }) =>
            booking.createdByUserId === staffUserId
        )
      ).toBe(true);
      expect(
        staffList.data.some(
          (booking: { id: string }) => booking.id === ownerBooking.data.id
        )
      ).toBe(false);

      await expectHttpError(
        axios.patch(
          `/api/v1/bookings/${ownerBooking.data.id}/status`,
          {
            status: 'CANCELLED',
            cancellationReason: 'Attempt to cancel another user booking',
          },
          { headers: authHeadersFor(staffToken) }
        ),
        403
      );

      await expectHttpError(
        axios.patch(
          `/api/v1/bookings/${staffBooking.data.id}/status`,
          { paymentStatus: 'PAID' },
          { headers: authHeadersFor(staffToken) }
        ),
        403
      );

      const ownCancel = await axios.patch(
        `/api/v1/bookings/${staffBooking.data.id}/status`,
        {
          status: 'CANCELLED',
          cancellationReason: 'Staff own cancellation',
        },
        { headers: authHeadersFor(staffToken) }
      );
      expect(ownCancel.status).toBe(200);
      expect(ownCancel.data.status).toBe('CANCELLED');
    }, 120000);
  });
});
