import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';
import { LoggerService } from './logger.service';
import {
  BookingCancellationScope,
  BookingPreviewRequestDto,
  InviteUserRequestDto,
  RecurrenceFrequency,
  BookingStatus,
  PaymentStatus,
  UserRole,
} from '@khana/shared-dtos';

describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;
  let logger: jest.Mocked<LoggerService>;

  const API_BASE_URL = environment.apiBaseUrl.replace(/\/+$/, '');

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as unknown as jest.Mocked<LoggerService>;

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ApiService,
        { provide: LoggerService, useValue: logger },
      ],
    });

    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should request facilities using configured API base URL', () => {
    service.getFacilities().subscribe();

    const req = httpMock.expectOne(`${API_BASE_URL}/v1/bookings/facilities`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('should request today snapshot with optional facility filter', () => {
    service.getTodaySnapshot('facility-1').subscribe();

    const req = httpMock.expectOne(
      `${API_BASE_URL}/v1/dashboard/today-snapshot?facilityId=facility-1`
    );
    expect(req.request.method).toBe('GET');
    req.flush({
      bookingsToday: 0,
      revenueToday: 0,
      unpaidCount: 0,
      unpaidAmount: 0,
      expiringHoldsCount: 0,
      waitlistToday: 0,
      notifiedWaitlistCount: 0,
      noShowCount: 0,
    });
  });

  it('should complete onboarding using configured API base URL', () => {
    const request = {
      businessName: 'Elite Sports Hub',
      businessType: 'SPORTS' as const,
      contactEmail: 'owner@khana.dev',
      contactPhone: '+966500000000',
      facility: {
        name: 'Court 1',
        type: 'PADEL_COURT',
        pricePerHour: 180,
        openTime: '08:00',
        closeTime: '23:00',
      },
    };

    service.completeOnboarding(request).subscribe();

    const req = httpMock.expectOne(`${API_BASE_URL}/v1/onboarding/complete`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush({
      onboardingCompleted: true,
      tenantId: 'tenant-1',
      facilityId: 'facility-1',
      redirectTo: '/dashboard',
    });
  });

  it('should load tenant settings from settings endpoint', () => {
    service.getTenantSettings().subscribe();

    const req = httpMock.expectOne(`${API_BASE_URL}/v1/settings`);
    expect(req.request.method).toBe('GET');
    req.flush({
      timezone: 'Asia/Riyadh',
      updatedAt: new Date().toISOString(),
    });
  });

  it('should update tenant settings using patch request', () => {
    service.updateTenantSettings({ timezone: 'Europe/Istanbul' }).subscribe();

    const req = httpMock.expectOne(`${API_BASE_URL}/v1/settings`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ timezone: 'Europe/Istanbul' });
    req.flush({
      timezone: 'Europe/Istanbul',
      updatedAt: new Date().toISOString(),
    });
  });

  it('should request managed facilities with includeInactive=true', () => {
    service.getManagedFacilities(true).subscribe();

    const req = httpMock.expectOne(
      `${API_BASE_URL}/v1/facilities?includeInactive=true`
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('should request a single managed facility', () => {
    service.getManagedFacilityById('facility-1').subscribe();

    const req = httpMock.expectOne(`${API_BASE_URL}/v1/facilities/facility-1`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('should create a facility using configured API base URL', () => {
    const request = {
      name: 'Court 7',
      type: 'PADEL_COURT',
      config: {
        pricePerHour: 220,
        openTime: '08:00',
        closeTime: '23:00',
      },
    };

    service.createFacility(request).subscribe();

    const req = httpMock.expectOne(`${API_BASE_URL}/v1/facilities`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush({});
  });

  it('should update a facility using configured API base URL', () => {
    const request = {
      config: { pricePerHour: 300 },
      isActive: true,
    };

    service.updateFacility('facility-1', request).subscribe();

    const req = httpMock.expectOne(`${API_BASE_URL}/v1/facilities/facility-1`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(request);
    req.flush({});
  });

  it('should deactivate a facility using configured API base URL', () => {
    service.deactivateFacility('facility-1').subscribe();

    const req = httpMock.expectOne(`${API_BASE_URL}/v1/facilities/facility-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({});
  });

  it('should list users using configured API base URL', () => {
    service.listUsers().subscribe();

    const req = httpMock.expectOne(`${API_BASE_URL}/v1/users`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('should update user role using configured API base URL', () => {
    service
      .updateUserRole('user-1', {
        role: UserRole.MANAGER,
      })
      .subscribe();

    const req = httpMock.expectOne(`${API_BASE_URL}/v1/users/user-1/role`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ role: UserRole.MANAGER });
    req.flush({});
  });

  it('should update user status using configured API base URL', () => {
    service
      .updateUserStatus('user-1', {
        isActive: false,
      })
      .subscribe();

    const req = httpMock.expectOne(`${API_BASE_URL}/v1/users/user-1/status`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ isActive: false });
    req.flush({});
  });

  it('should invite user using configured API base URL', () => {
    const request: InviteUserRequestDto = {
      email: 'new.staff@khana.dev',
      role: UserRole.STAFF,
    };

    service.inviteUser(request).subscribe();

    const req = httpMock.expectOne(`${API_BASE_URL}/v1/users/invite`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush({ message: 'Invitation sent successfully.', user: {} });
  });

  it('should request bookings with facilityId query param', () => {
    const facilityId = 'facility-1';

    service.getBookings(facilityId).subscribe();

    const req = httpMock.expectOne(
      `${API_BASE_URL}/v1/bookings?facilityId=facility-1`
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('should request a single booking by id', () => {
    service.getBooking('booking-1').subscribe();

    const req = httpMock.expectOne(`${API_BASE_URL}/v1/bookings/booking-1`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('should lookup customer by phone', () => {
    service.lookupCustomerByPhone('0551234567').subscribe();

    const req = httpMock.expectOne(
      `${API_BASE_URL}/v1/customers/lookup?phone=0551234567`
    );
    expect(req.request.method).toBe('GET');
    req.flush({
      id: 'customer-1',
      name: 'Layla',
      phone: '+966551234567',
      totalBookings: 0,
      totalSpend: 0,
      tags: ['VIP'],
    });
  });

  it('should return null when customer lookup responds with null body', () => {
    let result: unknown;
    service.lookupCustomerByPhone('0551234567').subscribe((value) => {
      result = value;
    });

    const req = httpMock.expectOne(
      `${API_BASE_URL}/v1/customers/lookup?phone=0551234567`
    );
    req.flush(null);

    expect(result).toBeNull();
  });

  it('should update customer tags', () => {
    service.updateCustomerTags('customer-1', ['VIP']).subscribe();

    const req = httpMock.expectOne(
      `${API_BASE_URL}/v1/customers/customer-1/tags`
    );
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ tags: ['VIP'] });
    req.flush({
      id: 'customer-1',
      name: 'Layla',
      phone: '+966551234567',
      totalBookings: 0,
      totalSpend: 0,
      tags: ['VIP'],
    });
  });

  it('should get tenant tags', () => {
    service.getTenantTags().subscribe();

    const req = httpMock.expectOne(`${API_BASE_URL}/v1/customers/tags`);
    expect(req.request.method).toBe('GET');
    req.flush(['VIP', 'Corporate']);
  });

  it('should post booking preview using configured API base URL', () => {
    const request: BookingPreviewRequestDto = {
      facilityId: 'facility-1',
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };

    service.previewBooking(request).subscribe();

    const req = httpMock.expectOne(`${API_BASE_URL}/v1/bookings/preview`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush({
      canBook: true,
      priceBreakdown: { total: 100, currency: 'SAR' },
    });
  });

  it('should post create booking using configured API base URL', () => {
    const request = {
      facilityId: 'facility-1',
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      customerName: 'Test User',
      customerPhone: '+966500000000',
    };

    service.createBooking(request).subscribe();

    const req = httpMock.expectOne(`${API_BASE_URL}/v1/bookings`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush({});
  });

  it('should post create recurring booking using configured API base URL', () => {
    const request = {
      facilityId: 'facility-1',
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      customerName: 'Test User',
      customerPhone: '+966500000000',
      recurrenceRule: {
        frequency: RecurrenceFrequency.WEEKLY,
        intervalWeeks: 1,
        occurrences: 8,
      },
    };

    service.createRecurringBooking(request).subscribe();

    const req = httpMock.expectOne(`${API_BASE_URL}/v1/bookings/recurring`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush({ recurrenceGroupId: 'group-1', createdCount: 8, bookings: [] });
  });

  it('should patch booking status using configured API base URL', () => {
    const bookingId = 'booking-1';

    service
      .updateBookingStatus(
        bookingId,
        BookingStatus.CONFIRMED,
        PaymentStatus.PAID,
        undefined,
        BookingCancellationScope.SINGLE
      )
      .subscribe();

    const req = httpMock.expectOne(
      `${API_BASE_URL}/v1/bookings/${bookingId}/status`
    );
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({
      status: BookingStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PAID,
      cancellationReason: undefined,
      cancellationScope: BookingCancellationScope.SINGLE,
    });
    req.flush({});
  });

  it('extracts requestId from error responses when logging failures', () => {
    service.getFacilities().subscribe({
      error: () => undefined,
    });

    const req = httpMock.expectOne(`${API_BASE_URL}/v1/bookings/facilities`);
    req.flush(
      { message: 'Server error' },
      {
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'x-request-id': 'req-123' },
      }
    );

    expect(logger.error).toHaveBeenCalledWith(
      'client.api.request_failed',
      'Failed to load facilities',
      { operation: 'load facilities', requestId: 'req-123' },
      expect.any(HttpErrorResponse)
    );
  });
});
