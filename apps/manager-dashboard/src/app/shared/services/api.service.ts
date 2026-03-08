import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AnalyticsBaseQueryDto,
  AnalyticsGroupBy,
  AnalyticsOccupancyResponseDto,
  AnalyticsPeakHoursResponseDto,
  AnalyticsRevenueResponseDto,
  AnalyticsSummaryResponseDto,
  GoalSettingsResponseDto,
  TenantSettingsResponseDto,
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
  UpdateTenantSettingsRequestDto,
  UpdateGoalsRequestDto,
  UpdateFacilityRequestDto,
  UserDto,
  WaitlistListQueryDto,
  WaitlistListResponseDto,
  WaitlistStatusQueryDto,
  WaitlistStatusResponseDto,
  ExpireWaitlistEntryResponseDto,
} from '@khana/shared-dtos';
import { AnalyticsApiService } from './api/analytics-api.service';
import { BookingsApiService } from './api/bookings-api.service';
import { CustomersApiService } from './api/customers-api.service';
import { DashboardApiService } from './api/dashboard-api.service';
import { FacilitiesApiService } from './api/facilities-api.service';
import { OnboardingApiService } from './api/onboarding-api.service';
import { PromoCodesApiService } from './api/promo-codes-api.service';
import { SettingsApiService } from './api/settings-api.service';
import { UsersApiService } from './api/users-api.service';
import { WaitlistApiService } from './api/waitlist-api.service';

/**
 * Backwards-compatible façade for existing callers.
 * Domain-specific clients live under shared/services/api/.
 */
@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly analyticsApi = inject(AnalyticsApiService);
  private readonly dashboardApi = inject(DashboardApiService);
  private readonly customersApi = inject(CustomersApiService);
  private readonly settingsApi = inject(SettingsApiService);
  private readonly onboardingApi = inject(OnboardingApiService);
  private readonly facilitiesApi = inject(FacilitiesApiService);
  private readonly usersApi = inject(UsersApiService);
  private readonly promoCodesApi = inject(PromoCodesApiService);
  private readonly bookingsApi = inject(BookingsApiService);
  private readonly waitlistApi = inject(WaitlistApiService);

  getAnalyticsSummary(
    query: AnalyticsBaseQueryDto
  ): Observable<AnalyticsSummaryResponseDto> {
    return this.analyticsApi.getAnalyticsSummary(query);
  }

  getAnalyticsOccupancy(
    query: AnalyticsBaseQueryDto
  ): Observable<AnalyticsOccupancyResponseDto> {
    return this.analyticsApi.getAnalyticsOccupancy(query);
  }

  getAnalyticsRevenue(
    query: AnalyticsBaseQueryDto & { groupBy: AnalyticsGroupBy }
  ): Observable<AnalyticsRevenueResponseDto> {
    return this.analyticsApi.getAnalyticsRevenue(query);
  }

  getAnalyticsPeakHours(
    query: AnalyticsBaseQueryDto
  ): Observable<AnalyticsPeakHoursResponseDto> {
    return this.analyticsApi.getAnalyticsPeakHours(query);
  }

  getTodaySnapshot(facilityId?: string): Observable<TodaySnapshotDto> {
    return this.dashboardApi.getTodaySnapshot(facilityId);
  }

  lookupCustomerByPhone(phone: string): Observable<CustomerSummaryDto | null> {
    return this.customersApi.lookupCustomerByPhone(phone);
  }

  updateCustomerTags(
    customerId: string,
    tags: string[]
  ): Observable<CustomerSummaryDto> {
    return this.customersApi.updateCustomerTags(customerId, tags);
  }

  getTenantTags(): Observable<string[]> {
    return this.customersApi.getTenantTags();
  }

  getTenantSettings(): Observable<TenantSettingsResponseDto> {
    return this.settingsApi.getTenantSettings();
  }

  updateTenantSettings(
    request: UpdateTenantSettingsRequestDto
  ): Observable<TenantSettingsResponseDto> {
    return this.settingsApi.updateTenantSettings(request);
  }

  getGoalSettings(): Observable<GoalSettingsResponseDto> {
    return this.settingsApi.getGoalSettings();
  }

  updateGoalSettings(
    request: UpdateGoalsRequestDto
  ): Observable<GoalSettingsResponseDto> {
    return this.settingsApi.updateGoalSettings(request);
  }

  completeOnboarding(
    request: CompleteOnboardingRequestDto
  ): Observable<CompleteOnboardingResponseDto> {
    return this.onboardingApi.completeOnboarding(request);
  }

  getFacilities(): Observable<FacilityListItemDto[]> {
    return this.bookingsApi.getFacilities();
  }

  getManagedFacilities(
    includeInactive = true
  ): Observable<FacilityManagementItemDto[]> {
    return this.facilitiesApi.getManagedFacilities(includeInactive);
  }

  getManagedFacilityById(id: string): Observable<FacilityManagementItemDto> {
    return this.facilitiesApi.getManagedFacilityById(id);
  }

  createFacility(
    request: CreateFacilityRequestDto
  ): Observable<FacilityManagementItemDto> {
    return this.facilitiesApi.createFacility(request);
  }

  updateFacility(
    id: string,
    request: UpdateFacilityRequestDto
  ): Observable<FacilityManagementItemDto> {
    return this.facilitiesApi.updateFacility(id, request);
  }

  deactivateFacility(id: string): Observable<FacilityManagementItemDto> {
    return this.facilitiesApi.deactivateFacility(id);
  }

  listUsers(): Observable<UserDto[]> {
    return this.usersApi.listUsers();
  }

  updateUserRole(
    id: string,
    request: UpdateUserRoleRequestDto
  ): Observable<UserDto> {
    return this.usersApi.updateUserRole(id, request);
  }

  updateUserStatus(
    id: string,
    request: UpdateUserStatusRequestDto
  ): Observable<UserDto> {
    return this.usersApi.updateUserStatus(id, request);
  }

  inviteUser(request: InviteUserRequestDto): Observable<InviteUserResponseDto> {
    return this.usersApi.inviteUser(request);
  }

  createPromoCode(
    request: CreatePromoCodeRequestDto
  ): Observable<PromoCodeItemDto> {
    return this.promoCodesApi.createPromoCode(request);
  }

  listPromoCodes(
    query: PromoCodeListQueryDto
  ): Observable<PromoCodeListResponseDto> {
    return this.promoCodesApi.listPromoCodes(query);
  }

  updatePromoCode(
    id: string,
    request: UpdatePromoCodeRequestDto
  ): Observable<PromoCodeItemDto> {
    return this.promoCodesApi.updatePromoCode(id, request);
  }

  getBookings(facilityId?: string): Observable<BookingListItemDto[]> {
    return this.bookingsApi.getBookings(facilityId);
  }

  getBooking(id: string): Observable<BookingListItemDto> {
    return this.bookingsApi.getBooking(id);
  }

  previewBooking(
    request: BookingPreviewRequestDto
  ): Observable<BookingPreviewResponseDto> {
    return this.bookingsApi.previewBooking(request);
  }

  createBooking(
    request: CreateBookingRequestDto
  ): Observable<BookingListItemDto> {
    return this.bookingsApi.createBooking(request);
  }

  createRecurringBooking(
    request: CreateRecurringBookingRequestDto
  ): Observable<CreateRecurringBookingResponseDto> {
    return this.bookingsApi.createRecurringBooking(request);
  }

  joinBookingWaitlist(
    request: JoinWaitlistRequestDto
  ): Observable<JoinWaitlistResponseDto> {
    return this.waitlistApi.joinBookingWaitlist(request);
  }

  getBookingWaitlistStatus(
    query: WaitlistStatusQueryDto
  ): Observable<WaitlistStatusResponseDto> {
    return this.waitlistApi.getBookingWaitlistStatus(query);
  }

  getWaitlistEntries(
    query: WaitlistListQueryDto
  ): Observable<WaitlistListResponseDto> {
    return this.waitlistApi.getWaitlistEntries(query);
  }

  notifyNextWaitlistSlot(
    request: NotifyNextWaitlistRequestDto
  ): Observable<NotifyNextWaitlistResponseDto> {
    return this.waitlistApi.notifyNextWaitlistSlot(request);
  }

  expireWaitlistEntry(
    entryId: string
  ): Observable<ExpireWaitlistEntryResponseDto> {
    return this.waitlistApi.expireWaitlistEntry(entryId);
  }

  updateBookingStatus(
    id: string,
    status?: BookingStatus,
    paymentStatus?: PaymentStatus,
    cancellationReason?: string,
    cancellationScope?: BookingCancellationScope
  ): Observable<BookingListItemDto> {
    return this.bookingsApi.updateBookingStatus(
      id,
      status,
      paymentStatus,
      cancellationReason,
      cancellationScope
    );
  }
}
