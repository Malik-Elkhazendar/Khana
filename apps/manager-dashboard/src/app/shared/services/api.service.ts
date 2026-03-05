import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import {
  AnalyticsBaseQueryDto,
  AnalyticsGroupBy,
  AnalyticsOccupancyResponseDto,
  AnalyticsPeakHoursResponseDto,
  AnalyticsRevenueResponseDto,
  AnalyticsSummaryResponseDto,
  GoalSettingsResponseDto,
  TodaySnapshotDto,
  BookingCancellationScope,
  CustomerSummaryDto,
  BookingPreviewRequestDto,
  BookingPreviewResponseDto,
  BookingListItemDto,
  BookingStatus,
  CompleteOnboardingRequestDto,
  CompleteOnboardingResponseDto,
  CreateRecurringBookingRequestDto,
  CreateRecurringBookingResponseDto,
  CreateBookingRequestDto,
  CreatePromoCodeRequestDto,
  CreateFacilityRequestDto,
  FacilityListItemDto,
  FacilityManagementItemDto,
  InviteUserRequestDto,
  InviteUserResponseDto,
  JoinWaitlistRequestDto,
  JoinWaitlistResponseDto,
  NotifyNextWaitlistRequestDto,
  NotifyNextWaitlistResponseDto,
  PaymentStatus,
  PromoCodeItemDto,
  PromoCodeListQueryDto,
  PromoCodeListResponseDto,
  UpdateUserRoleRequestDto,
  UpdateUserStatusRequestDto,
  UpdatePromoCodeRequestDto,
  UpdateGoalsRequestDto,
  UpdateFacilityRequestDto,
  UserDto,
  WaitlistListQueryDto,
  WaitlistListResponseDto,
  WaitlistStatusQueryDto,
  WaitlistStatusResponseDto,
  ExpireWaitlistEntryResponseDto,
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
  // ANALYTICS
  // ============================================================

  /**
   * Load analytics KPI summary and previous-period comparison.
   */
  getAnalyticsSummary(
    query: AnalyticsBaseQueryDto
  ): Observable<AnalyticsSummaryResponseDto> {
    return this.http
      .get<AnalyticsSummaryResponseDto>(
        `${this.baseUrl}/v1/analytics/summary`,
        {
          params: this.buildAnalyticsParams(query),
        }
      )
      .pipe(catchError(this.handleError('load analytics summary')));
  }

  /**
   * Load occupancy trends and per-facility occupancy rates.
   */
  getAnalyticsOccupancy(
    query: AnalyticsBaseQueryDto
  ): Observable<AnalyticsOccupancyResponseDto> {
    return this.http
      .get<AnalyticsOccupancyResponseDto>(
        `${this.baseUrl}/v1/analytics/occupancy`,
        {
          params: this.buildAnalyticsParams(query),
        }
      )
      .pipe(catchError(this.handleError('load analytics occupancy')));
  }

  /**
   * Load revenue/bookings trend and per-facility performance table.
   */
  getAnalyticsRevenue(
    query: AnalyticsBaseQueryDto & { groupBy: AnalyticsGroupBy }
  ): Observable<AnalyticsRevenueResponseDto> {
    return this.http
      .get<AnalyticsRevenueResponseDto>(
        `${this.baseUrl}/v1/analytics/revenue`,
        {
          params: this.buildAnalyticsParams(query),
        }
      )
      .pipe(catchError(this.handleError('load analytics revenue')));
  }

  /**
   * Load peak-hour and most-booked insights.
   */
  getAnalyticsPeakHours(
    query: AnalyticsBaseQueryDto
  ): Observable<AnalyticsPeakHoursResponseDto> {
    return this.http
      .get<AnalyticsPeakHoursResponseDto>(
        `${this.baseUrl}/v1/analytics/peak-hours`,
        {
          params: this.buildAnalyticsParams(query),
        }
      )
      .pipe(catchError(this.handleError('load analytics peak hours')));
  }

  /**
   * Load today's operational snapshot for owner/manager dashboard briefing.
   */
  getTodaySnapshot(facilityId?: string): Observable<TodaySnapshotDto> {
    const params: Record<string, string> = {};
    if (facilityId) {
      params['facilityId'] = facilityId;
    }

    return this.http
      .get<TodaySnapshotDto>(`${this.baseUrl}/v1/dashboard/today-snapshot`, {
        params,
      })
      .pipe(catchError(this.handleError('load dashboard today snapshot')));
  }

  lookupCustomerByPhone(phone: string): Observable<CustomerSummaryDto | null> {
    return this.http
      .get<CustomerSummaryDto | null>(`${this.baseUrl}/v1/customers/lookup`, {
        params: { phone },
      })
      .pipe(catchError(this.handleError('lookup customer by phone')));
  }

  updateCustomerTags(
    customerId: string,
    tags: string[]
  ): Observable<CustomerSummaryDto> {
    return this.http
      .patch<CustomerSummaryDto>(
        `${this.baseUrl}/v1/customers/${customerId}/tags`,
        {
          tags,
        }
      )
      .pipe(catchError(this.handleError('update customer tags')));
  }

  getTenantTags(): Observable<string[]> {
    return this.http
      .get<string[]>(`${this.baseUrl}/v1/customers/tags`)
      .pipe(catchError(this.handleError('load customer tags')));
  }

  // ============================================================
  // GOALS / SETTINGS
  // ============================================================

  getGoalSettings(): Observable<GoalSettingsResponseDto> {
    return this.http
      .get<GoalSettingsResponseDto>(`${this.baseUrl}/v1/settings/goals`)
      .pipe(catchError(this.handleError('load goal settings')));
  }

  updateGoalSettings(
    request: UpdateGoalsRequestDto
  ): Observable<GoalSettingsResponseDto> {
    return this.http
      .patch<GoalSettingsResponseDto>(
        `${this.baseUrl}/v1/settings/goals`,
        request
      )
      .pipe(catchError(this.handleError('update goal settings')));
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
  // PROMO CODES
  // ============================================================

  /**
   * Create a promo code for the current tenant.
   */
  createPromoCode(
    request: CreatePromoCodeRequestDto
  ): Observable<PromoCodeItemDto> {
    return this.http
      .post<PromoCodeItemDto>(`${this.baseUrl}/v1/promo-codes`, request)
      .pipe(catchError(this.handleError('create promo code')));
  }

  /**
   * List promo codes for the current tenant with optional filters.
   */
  listPromoCodes(
    query: PromoCodeListQueryDto
  ): Observable<PromoCodeListResponseDto> {
    return this.http
      .get<PromoCodeListResponseDto>(`${this.baseUrl}/v1/promo-codes`, {
        params: this.buildPromoCodeListParams(query),
      })
      .pipe(catchError(this.handleError('list promo codes')));
  }

  /**
   * Update an existing promo code.
   */
  updatePromoCode(
    id: string,
    request: UpdatePromoCodeRequestDto
  ): Observable<PromoCodeItemDto> {
    return this.http
      .patch<PromoCodeItemDto>(`${this.baseUrl}/v1/promo-codes/${id}`, request)
      .pipe(catchError(this.handleError('update promo code')));
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
   * Get a single booking by id.
   */
  getBooking(id: string): Observable<BookingListItemDto> {
    return this.http
      .get<BookingListItemDto>(`${this.baseUrl}/v1/bookings/${id}`)
      .pipe(catchError(this.handleError('load booking details')));
  }

  /**
   * Preview a booking without persisting it
   * Returns price calculation, conflict status, promoValidation, and suggested alternatives
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
   * Supports optional promoCode when preview promoValidation is valid
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
   * Join the waitlist for an unavailable facility slot.
   */
  joinBookingWaitlist(
    request: JoinWaitlistRequestDto
  ): Observable<JoinWaitlistResponseDto> {
    return this.http
      .post<JoinWaitlistResponseDto>(
        `${this.baseUrl}/v1/bookings/waitlist`,
        request
      )
      .pipe(catchError(this.handleError('join booking waitlist')));
  }

  /**
   * Get waitlist status for the currently selected slot.
   */
  getBookingWaitlistStatus(
    query: WaitlistStatusQueryDto
  ): Observable<WaitlistStatusResponseDto> {
    return this.http
      .get<WaitlistStatusResponseDto>(
        `${this.baseUrl}/v1/bookings/waitlist/status`,
        {
          params: {
            facilityId: query.facilityId,
            startTime: query.startTime,
            endTime: query.endTime,
          },
        }
      )
      .pipe(catchError(this.handleError('load booking waitlist status')));
  }

  /**
   * List waitlist entries for dashboard operations view.
   */
  getWaitlistEntries(
    query: WaitlistListQueryDto
  ): Observable<WaitlistListResponseDto> {
    return this.http
      .get<WaitlistListResponseDto>(`${this.baseUrl}/v1/bookings/waitlist`, {
        params: this.buildWaitlistListParams(query),
      })
      .pipe(catchError(this.handleError('load waitlist entries')));
  }

  /**
   * Trigger manual notify-next for a specific slot queue.
   */
  notifyNextWaitlistSlot(
    request: NotifyNextWaitlistRequestDto
  ): Observable<NotifyNextWaitlistResponseDto> {
    return this.http
      .post<NotifyNextWaitlistResponseDto>(
        `${this.baseUrl}/v1/bookings/waitlist/notify-next`,
        request
      )
      .pipe(catchError(this.handleError('manual waitlist notify next')));
  }

  /**
   * Manually expire an active waitlist entry.
   */
  expireWaitlistEntry(
    entryId: string
  ): Observable<ExpireWaitlistEntryResponseDto> {
    return this.http
      .patch<ExpireWaitlistEntryResponseDto>(
        `${this.baseUrl}/v1/bookings/waitlist/${entryId}/expire`,
        {}
      )
      .pipe(catchError(this.handleError('manual waitlist expire entry')));
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

  private buildAnalyticsParams(
    query: AnalyticsBaseQueryDto & Partial<{ groupBy: AnalyticsGroupBy }>
  ): Record<string, string> {
    const params: Record<string, string> = {
      from: query.from,
      to: query.to,
    };

    if (query.facilityId) {
      params['facilityId'] = query.facilityId;
    }
    if (query.timeZone) {
      params['timeZone'] = query.timeZone;
    }
    if (query.groupBy) {
      params['groupBy'] = query.groupBy;
    }

    return params;
  }

  private buildWaitlistListParams(
    query: WaitlistListQueryDto
  ): Record<string, string> {
    const params: Record<string, string> = {
      from: query.from,
      to: query.to,
    };
    if (query.facilityId) {
      params['facilityId'] = query.facilityId;
    }
    if (query.status) {
      params['status'] = query.status;
    }
    if (query.page) {
      params['page'] = String(query.page);
    }
    if (query.pageSize) {
      params['pageSize'] = String(query.pageSize);
    }
    return params;
  }

  private buildPromoCodeListParams(
    query: PromoCodeListQueryDto
  ): Record<string, string> {
    const params: Record<string, string> = {};

    if (query.facilityId) {
      params['facilityId'] = query.facilityId;
    }
    if (typeof query.isActive === 'boolean') {
      params['isActive'] = String(query.isActive);
    }
    if (typeof query.includeExpired === 'boolean') {
      params['includeExpired'] = String(query.includeExpired);
    }
    if (query.page) {
      params['page'] = String(query.page);
    }
    if (query.pageSize) {
      params['pageSize'] = String(query.pageSize);
    }
    return params;
  }
}
