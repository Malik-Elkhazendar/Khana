import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  FacilityListItemDto,
  BookingPreviewRequestDto,
  BookingPreviewResponseDto,
  CreateBookingRequestDto,
  BookingListItemDto,
  BookingStatus,
  PaymentStatus,
} from '@khana/shared-dtos';

/**
 * Centralized API Service
 *
 * Single point of contact for all API calls.
 * All features should use this service instead of making HTTP calls directly.
 */
@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:3000/api';

  // ============================================================
  // FACILITIES
  // ============================================================

  /**
   * Get all facilities available for booking
   */
  getFacilities(): Observable<FacilityListItemDto[]> {
    return this.http.get<FacilityListItemDto[]>(`${this.baseUrl}/v1/bookings/facilities`);
  }

  // ============================================================
  // BOOKINGS
  // ============================================================

  /**
   * Get all bookings, optionally filtered by facility
   */
  getBookings(facilityId?: string): Observable<BookingListItemDto[]> {
    const params: Record<string, string> = {};
    if (facilityId) {
      params['facilityId'] = facilityId;
    }
    return this.http.get<BookingListItemDto[]>(`${this.baseUrl}/v1/bookings`, { params });
  }

  /**
   * Preview a booking without persisting it
   * Returns price calculation, conflict status, and suggested alternatives
   */
  previewBooking(request: BookingPreviewRequestDto): Observable<BookingPreviewResponseDto> {
    return this.http.post<BookingPreviewResponseDto>(`${this.baseUrl}/v1/bookings/preview`, request);
  }

  /**
   * Create a new booking
   */
  createBooking(request: CreateBookingRequestDto): Observable<BookingListItemDto> {
    return this.http.post<BookingListItemDto>(`${this.baseUrl}/v1/bookings`, request);
  }

  /**
   * Update booking status (cancel, mark as paid, etc.)
   */
  updateBookingStatus(
    id: string,
    status?: BookingStatus,
    paymentStatus?: PaymentStatus,
    cancellationReason?: string
  ): Observable<BookingListItemDto> {
    return this.http.patch<BookingListItemDto>(`${this.baseUrl}/v1/bookings/${id}/status`, {
      status,
      paymentStatus,
      cancellationReason,
    });
  }
}
