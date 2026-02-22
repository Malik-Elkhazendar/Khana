import { TestBed } from '@angular/core/testing';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';
import {
  BookingPreviewRequestDto,
  BookingStatus,
  PaymentStatus,
} from '@khana/shared-dtos';

describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;

  const API_BASE_URL = environment.apiBaseUrl.replace(/\/+$/, '');

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ApiService],
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

  it('should request bookings with facilityId query param', () => {
    const facilityId = 'facility-1';

    service.getBookings(facilityId).subscribe();

    const req = httpMock.expectOne(
      `${API_BASE_URL}/v1/bookings?facilityId=facility-1`
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
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

  it('should patch booking status using configured API base URL', () => {
    const bookingId = 'booking-1';

    service
      .updateBookingStatus(
        bookingId,
        BookingStatus.CONFIRMED,
        PaymentStatus.PAID,
        undefined
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
    });
    req.flush({});
  });
});
