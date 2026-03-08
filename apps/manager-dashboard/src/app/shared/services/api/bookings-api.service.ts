import { Injectable, inject } from '@angular/core';
import {
  BookingCancellationScope,
  BookingListItemDto,
  BookingPreviewRequestDto,
  BookingPreviewResponseDto,
  BookingStatus,
  CreateBookingRequestDto,
  CreateRecurringBookingRequestDto,
  CreateRecurringBookingResponseDto,
  FacilityListItemDto,
  PaymentStatus,
} from '@khana/shared-dtos';
import { Observable } from 'rxjs';
import { ApiRequestService } from './api-request.service';

@Injectable({ providedIn: 'root' })
export class BookingsApiService {
  private readonly api = inject(ApiRequestService);

  getFacilities(): Observable<FacilityListItemDto[]> {
    return this.api.get('/v1/bookings/facilities', 'load facilities');
  }

  getBookings(facilityId?: string): Observable<BookingListItemDto[]> {
    const params: Record<string, string> = {};
    if (facilityId) {
      params['facilityId'] = facilityId;
    }

    return this.api.get('/v1/bookings', 'load bookings', { params });
  }

  getBooking(id: string): Observable<BookingListItemDto> {
    return this.api.get(`/v1/bookings/${id}`, 'load booking details');
  }

  previewBooking(
    request: BookingPreviewRequestDto
  ): Observable<BookingPreviewResponseDto> {
    return this.api.post('/v1/bookings/preview', request, 'preview booking');
  }

  createBooking(
    request: CreateBookingRequestDto
  ): Observable<BookingListItemDto> {
    return this.api.post('/v1/bookings', request, 'create booking');
  }

  createRecurringBooking(
    request: CreateRecurringBookingRequestDto
  ): Observable<CreateRecurringBookingResponseDto> {
    return this.api.post(
      '/v1/bookings/recurring',
      request,
      'create recurring booking'
    );
  }

  updateBookingStatus(
    id: string,
    status?: BookingStatus,
    paymentStatus?: PaymentStatus,
    cancellationReason?: string,
    cancellationScope?: BookingCancellationScope
  ): Observable<BookingListItemDto> {
    return this.api.patch(
      `/v1/bookings/${id}/status`,
      {
        status,
        paymentStatus,
        cancellationReason,
        cancellationScope,
      },
      'update booking status'
    );
  }
}
