import { of } from 'rxjs';
import {
  createBooking,
  createBookingPreview,
  createFacility,
} from './factories';
import {
  AnalyticsOccupancyResponseDto,
  AnalyticsPeakHoursResponseDto,
  AnalyticsRevenueResponseDto,
  AnalyticsSummaryResponseDto,
  BookingListItemDto,
  BookingPreviewResponseDto,
  FacilityListItemDto,
  FacilityManagementItemDto,
  InviteUserResponseDto,
  PromoDiscountType,
  PromoFacilityScope,
  UserDto,
  UserRole,
} from '@khana/shared-dtos';

export type ApiServiceMock = {
  getAnalyticsSummary: jest.Mock;
  getAnalyticsOccupancy: jest.Mock;
  getAnalyticsRevenue: jest.Mock;
  getAnalyticsPeakHours: jest.Mock;
  completeOnboarding: jest.Mock;
  getFacilities: jest.Mock;
  getManagedFacilities: jest.Mock;
  getManagedFacilityById: jest.Mock;
  createFacility: jest.Mock;
  updateFacility: jest.Mock;
  deactivateFacility: jest.Mock;
  listUsers: jest.Mock;
  updateUserRole: jest.Mock;
  updateUserStatus: jest.Mock;
  inviteUser: jest.Mock;
  createPromoCode: jest.Mock;
  listPromoCodes: jest.Mock;
  updatePromoCode: jest.Mock;
  getBookings: jest.Mock;
  previewBooking: jest.Mock;
  createBooking: jest.Mock;
  createRecurringBooking: jest.Mock;
  joinBookingWaitlist: jest.Mock;
  getBookingWaitlistStatus: jest.Mock;
  getWaitlistEntries: jest.Mock;
  notifyNextWaitlistSlot: jest.Mock;
  expireWaitlistEntry: jest.Mock;
  updateBookingStatus: jest.Mock;
};

type ApiMockOverrides = Partial<ApiServiceMock>;

export const createApiMock = (
  overrides: ApiMockOverrides = {}
): ApiServiceMock => {
  const facility = createFacility();
  const managedFacility: FacilityManagementItemDto = {
    id: facility.id,
    tenantId: 'tenant-1',
    name: facility.name,
    type: 'PADEL_COURT',
    isActive: true,
    config: {
      pricePerHour: facility.basePrice,
      openTime: facility.openTime,
      closeTime: facility.closeTime,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const booking = createBooking();
  const preview = createBookingPreview();
  const user: UserDto = {
    id: 'user-1',
    tenantId: 'tenant-1',
    email: 'owner@khana.dev',
    name: 'Owner',
    role: UserRole.OWNER,
    isActive: true,
    onboardingCompleted: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const inviteResponse: InviteUserResponseDto = {
    message: 'Invitation sent successfully.',
    user,
  };
  const analyticsSummary: AnalyticsSummaryResponseDto = {
    totalBookings: 8,
    totalRevenue: 1440,
    totalCancellations: 1,
    cancellationRate: 12.5,
    avgBookingValue: 180,
    revenueComparison: {
      currentPeriodValue: 1440,
      previousPeriodValue: 1200,
      percentageChange: 20,
    },
    bookingsComparison: {
      currentPeriodValue: 8,
      previousPeriodValue: 6,
      percentageChange: 33.33,
    },
  };
  const analyticsOccupancy: AnalyticsOccupancyResponseDto = {
    overallOccupancyRate: 42.5,
    facilities: [
      {
        facilityId: managedFacility.id,
        facilityName: managedFacility.name,
        occupiedMinutes: 420,
        availableMinutes: 900,
        occupancyRate: 46.67,
        daily: [
          {
            date: '2026-03-01',
            occupiedMinutes: 210,
            availableMinutes: 450,
            occupancyRate: 46.67,
            bookingCount: 4,
          },
        ],
      },
    ],
  };
  const analyticsRevenue: AnalyticsRevenueResponseDto = {
    groupBy: 'day',
    trend: [
      {
        periodStart: '2026-03-01T00:00:00.000Z',
        periodLabel: '2026-03-01',
        revenue: 720,
        bookings: 4,
      },
    ],
    facilityPerformance: [
      {
        facilityId: managedFacility.id,
        facilityName: managedFacility.name,
        totalBookings: 8,
        revenue: 1440,
        occupancyRate: 46.67,
        cancellationRate: 12.5,
      },
    ],
  };
  const analyticsPeakHours: AnalyticsPeakHoursResponseDto = {
    peakTimeRange: '19:00-21:00',
    mostBookedFacility: managedFacility.name,
    mostBookedCourt: null,
  };
  const promoCode = {
    id: 'promo-1',
    tenantId: 'tenant-1',
    code: 'SAVE10',
    discountType: PromoDiscountType.PERCENTAGE,
    discountValue: 10,
    maxUses: 100,
    currentUses: 0,
    remainingUses: 100,
    isExhausted: false,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    isExpired: false,
    facilityScope: PromoFacilityScope.ALL_FACILITIES,
    facilityId: null,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return {
    getAnalyticsSummary: jest.fn(() =>
      of<AnalyticsSummaryResponseDto>(analyticsSummary)
    ),
    getAnalyticsOccupancy: jest.fn(() =>
      of<AnalyticsOccupancyResponseDto>(analyticsOccupancy)
    ),
    getAnalyticsRevenue: jest.fn(() =>
      of<AnalyticsRevenueResponseDto>(analyticsRevenue)
    ),
    getAnalyticsPeakHours: jest.fn(() =>
      of<AnalyticsPeakHoursResponseDto>(analyticsPeakHours)
    ),
    completeOnboarding: jest.fn(() =>
      of({
        onboardingCompleted: true as const,
        tenantId: 'tenant-1',
        facilityId: managedFacility.id,
        redirectTo: '/dashboard' as const,
      })
    ),
    getFacilities: jest.fn(() => of<FacilityListItemDto[]>([facility])),
    getManagedFacilities: jest.fn(() =>
      of<FacilityManagementItemDto[]>([managedFacility])
    ),
    getManagedFacilityById: jest.fn(() =>
      of<FacilityManagementItemDto>(managedFacility)
    ),
    createFacility: jest.fn(() =>
      of<FacilityManagementItemDto>(managedFacility)
    ),
    updateFacility: jest.fn(() =>
      of<FacilityManagementItemDto>(managedFacility)
    ),
    deactivateFacility: jest.fn(() =>
      of<FacilityManagementItemDto>({ ...managedFacility, isActive: false })
    ),
    listUsers: jest.fn(() => of<UserDto[]>([user])),
    updateUserRole: jest.fn(() => of<UserDto>(user)),
    updateUserStatus: jest.fn(() => of<UserDto>(user)),
    inviteUser: jest.fn(() => of<InviteUserResponseDto>(inviteResponse)),
    createPromoCode: jest.fn(() => of(promoCode)),
    listPromoCodes: jest.fn(() =>
      of({
        items: [promoCode],
        total: 1,
        page: 1,
        pageSize: 20,
      })
    ),
    updatePromoCode: jest.fn(() => of(promoCode)),
    getBookings: jest.fn(() => of<BookingListItemDto[]>([booking])),
    previewBooking: jest.fn(() => of<BookingPreviewResponseDto>(preview)),
    createBooking: jest.fn(() => of<BookingListItemDto>(booking)),
    createRecurringBooking: jest.fn(() =>
      of({
        recurrenceGroupId: 'group-1',
        createdCount: 1,
        bookings: [booking],
      })
    ),
    joinBookingWaitlist: jest.fn(() =>
      of({
        entryId: 'waitlist-1',
        status: 'WAITING',
        queuePosition: 1,
        desiredTimeSlot: {
          startTime: booking.startTime,
          endTime: booking.endTime,
        },
        createdAt: new Date().toISOString(),
      })
    ),
    getBookingWaitlistStatus: jest.fn(() =>
      of({
        isOnWaitlist: false,
      })
    ),
    getWaitlistEntries: jest.fn(() =>
      of({
        items: [],
        total: 0,
        page: 1,
        pageSize: 20,
        summary: { waiting: 0, notified: 0, expired: 0, fulfilled: 0 },
      })
    ),
    notifyNextWaitlistSlot: jest.fn(() => of({ notified: false })),
    expireWaitlistEntry: jest.fn(() =>
      of({
        entryId: 'waitlist-1',
        status: 'EXPIRED',
        expiredAt: new Date().toISOString(),
      })
    ),
    updateBookingStatus: jest.fn(() => of<BookingListItemDto>(booking)),
    ...overrides,
  };
};
