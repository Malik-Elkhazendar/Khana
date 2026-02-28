import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import {
  BookingCancellationScope,
  BookingPreviewRequestDto,
  BookingPreviewResponseDto,
  BookingListItemDto,
  BookingStatus,
  CompleteOnboardingRequestDto,
  CompleteOnboardingResponseDto,
  CreateRecurringBookingRequestDto,
  CreateRecurringBookingResponseDto,
  CreateBookingRequestDto,
  CreateFacilityRequestDto,
  FacilityListItemDto,
  FacilityManagementItemDto,
  InviteUserRequestDto,
  InviteUserResponseDto,
  PaymentStatus,
  UpdateUserRoleRequestDto,
  UpdateUserStatusRequestDto,
  UpdateFacilityRequestDto,
  UserDto,
} from '@khana/shared-dtos';
import { environment } from '../../../environments/environment';
import { LoggerService } from './logger.service';

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
  private readonly logger = inject(LoggerService);
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/+$/, '');

  private handleError(operation: string) {
    return (err: unknown) => {
      const requestId =
        err instanceof HttpErrorResponse
          ? err.headers?.get('x-request-id') ?? undefined
          : undefined;
      const context: Record<string, unknown> = { operation };
      if (requestId) {
        context['requestId'] = requestId;
      }

      this.logger.error(
        'client.api.request_failed',
        `Failed to ${operation}`,
        context,
        err
      );
      return throwError(() => err);
    };
  }

  // ============================================================
  // ONBOARDING
  // ============================================================

  /**
   * Complete tenant onboarding with business details + first facility
   */
  completeOnboarding(
    request: CompleteOnboardingRequestDto
  ): Observable<CompleteOnboardingResponseDto> {
    return this.http
      .post<CompleteOnboardingResponseDto>(
        `${this.baseUrl}/v1/onboarding/complete`,
        request
      )
      .pipe(catchError(this.handleError('complete onboarding')));
  }

  // ============================================================
  // FACILITIES
  // ============================================================

  /**
   * Get all facilities available for booking
   */
  getFacilities(): Observable<FacilityListItemDto[]> {
    return this.http
      .get<FacilityListItemDto[]>(`${this.baseUrl}/v1/bookings/facilities`)
      .pipe(catchError(this.handleError('load facilities')));
  }

  /**
   * Get facilities from management endpoint
   */
  getManagedFacilities(
    includeInactive = true
  ): Observable<FacilityManagementItemDto[]> {
    return this.http
      .get<FacilityManagementItemDto[]>(`${this.baseUrl}/v1/facilities`, {
        params: includeInactive ? { includeInactive: 'true' } : {},
      })
      .pipe(catchError(this.handleError('load managed facilities')));
  }

  /**
   * Get a single managed facility by id
   */
  getManagedFacilityById(id: string): Observable<FacilityManagementItemDto> {
    return this.http
      .get<FacilityManagementItemDto>(`${this.baseUrl}/v1/facilities/${id}`)
      .pipe(catchError(this.handleError('load managed facility')));
  }

  /**
   * Create a facility
   */
  createFacility(
    request: CreateFacilityRequestDto
  ): Observable<FacilityManagementItemDto> {
    return this.http
      .post<FacilityManagementItemDto>(`${this.baseUrl}/v1/facilities`, request)
      .pipe(catchError(this.handleError('create facility')));
  }

  /**
   * Update a managed facility
   */
  updateFacility(
    id: string,
    request: UpdateFacilityRequestDto
  ): Observable<FacilityManagementItemDto> {
    return this.http
      .patch<FacilityManagementItemDto>(
        `${this.baseUrl}/v1/facilities/${id}`,
        request
      )
      .pipe(catchError(this.handleError('update facility')));
  }

  /**
   * Soft-delete (deactivate) a managed facility
   */
  deactivateFacility(id: string): Observable<FacilityManagementItemDto> {
    return this.http
      .delete<FacilityManagementItemDto>(`${this.baseUrl}/v1/facilities/${id}`)
      .pipe(catchError(this.handleError('deactivate facility')));
  }

  // ============================================================
  // USERS
  // ============================================================

  /**
   * List all team members in current tenant
   */
  listUsers(): Observable<UserDto[]> {
    return this.http
      .get<UserDto[]>(`${this.baseUrl}/v1/users`)
      .pipe(catchError(this.handleError('load users')));
  }

  /**
   * Update role of a team member
   */
  updateUserRole(
    id: string,
    request: UpdateUserRoleRequestDto
  ): Observable<UserDto> {
    return this.http
      .patch<UserDto>(`${this.baseUrl}/v1/users/${id}/role`, request)
      .pipe(catchError(this.handleError('update user role')));
  }

  /**
   * Activate or deactivate team member
   */
  updateUserStatus(
    id: string,
    request: UpdateUserStatusRequestDto
  ): Observable<UserDto> {
    return this.http
      .patch<UserDto>(`${this.baseUrl}/v1/users/${id}/status`, request)
      .pipe(catchError(this.handleError('update user status')));
  }

  /**
   * Invite new team member by email
   */
  inviteUser(request: InviteUserRequestDto): Observable<InviteUserResponseDto> {
    return this.http
      .post<InviteUserResponseDto>(`${this.baseUrl}/v1/users/invite`, request)
      .pipe(catchError(this.handleError('invite user')));
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
    return this.http
      .get<BookingListItemDto[]>(`${this.baseUrl}/v1/bookings`, {
        params,
      })
      .pipe(catchError(this.handleError('load bookings')));
  }

  /**
   * Preview a booking without persisting it
   * Returns price calculation, conflict status, and suggested alternatives
   */
  previewBooking(
    request: BookingPreviewRequestDto
  ): Observable<BookingPreviewResponseDto> {
    return this.http
      .post<BookingPreviewResponseDto>(
        `${this.baseUrl}/v1/bookings/preview`,
        request
      )
      .pipe(catchError(this.handleError('preview booking')));
  }

  /**
   * Create a new booking
   */
  createBooking(
    request: CreateBookingRequestDto
  ): Observable<BookingListItemDto> {
    return this.http
      .post<BookingListItemDto>(`${this.baseUrl}/v1/bookings`, request)
      .pipe(catchError(this.handleError('create booking')));
  }

  /**
   * Create a recurring booking series
   */
  createRecurringBooking(
    request: CreateRecurringBookingRequestDto
  ): Observable<CreateRecurringBookingResponseDto> {
    return this.http
      .post<CreateRecurringBookingResponseDto>(
        `${this.baseUrl}/v1/bookings/recurring`,
        request
      )
      .pipe(catchError(this.handleError('create recurring booking')));
  }

  /**
   * Update booking status (cancel, mark as paid, etc.)
   */
  updateBookingStatus(
    id: string,
    status?: BookingStatus,
    paymentStatus?: PaymentStatus,
    cancellationReason?: string,
    cancellationScope?: BookingCancellationScope
  ): Observable<BookingListItemDto> {
    return this.http
      .patch<BookingListItemDto>(`${this.baseUrl}/v1/bookings/${id}/status`, {
        status,
        paymentStatus,
        cancellationReason,
        cancellationScope,
      })
      .pipe(catchError(this.handleError('update booking status')));
  }
}
