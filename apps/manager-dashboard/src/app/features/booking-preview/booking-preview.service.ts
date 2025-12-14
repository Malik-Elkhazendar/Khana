import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface FacilityDto {
  id: string;
  name: string;
  openTime: string;
  closeTime: string;
  slotDurationMinutes: number;
  basePrice: number;
  currency: string;
}

export interface BookingPreviewRequest {
  facilityId: string;
  startTime: string;
  endTime: string;
  promoCode?: string;
}

export interface PriceBreakdown {
  basePrice: number;
  timeMultiplier: number;
  dayMultiplier: number;
  durationDiscount: number;
  subtotal: number;
  discountAmount: number;
  promoDiscount?: number;
  promoCode?: string;
  total: number;
  currency: string;
}

export interface ConflictInfo {
  hasConflict: boolean;
  conflictType?: string;
  message: string;
  conflictingSlots: Array<{
    startTime: string;
    endTime: string;
    status: string;
    bookingReference?: string;
  }>;
}

export interface AlternativeSlot {
  startTime: string;
  endTime: string;
  price: number;
  currency: string;
}

export interface BookingPreviewResponse {
  canBook: boolean;
  priceBreakdown: PriceBreakdown;
  conflict?: ConflictInfo;
  suggestedAlternatives?: AlternativeSlot[];
  validationErrors?: string[];
}

@Injectable({
  providedIn: 'root',
})
export class BookingPreviewService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/api/v1/bookings';

  getFacilities(): Observable<FacilityDto[]> {
    return this.http.get<FacilityDto[]>(`${this.apiUrl}/facilities`);
  }

  previewBooking(request: BookingPreviewRequest): Observable<BookingPreviewResponse> {
    return this.http.post<BookingPreviewResponse>(`${this.apiUrl}/preview`, request);
  }
}
