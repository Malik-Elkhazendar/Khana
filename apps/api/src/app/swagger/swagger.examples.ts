export const SWAGGER_TENANT_CONTEXT_EXAMPLE = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Khana Padel Club',
  slug: 'khana-padel-club',
  timezone: 'Asia/Riyadh',
};

export const SWAGGER_AUTH_LOGIN_REQUEST_EXAMPLE = {
  email: 'owner@khana.sa',
  password: 'Secret123!',
  subdomain: 'khana-padel-club',
};

export const SWAGGER_AUTH_REGISTER_REQUEST_EXAMPLE = {
  email: 'manager@khana.sa',
  password: 'Secret123!',
  name: 'Abeer Alotaibi',
  phone: '+966500000000',
};

export const SWAGGER_AUTH_SIGNUP_OWNER_REQUEST_EXAMPLE = {
  workspaceName: 'Khana Padel Club',
  workspaceSlug: 'khana-padel-club',
  name: 'Malek Elkhazendar',
  email: 'owner@khana.sa',
  phone: '+966500000000',
  password: 'Secret123!',
};

export const SWAGGER_AUTH_LOGIN_RESPONSE_EXAMPLE = {
  accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.access',
  refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh',
  expiresIn: 900,
  user: {
    id: '22222222-2222-4222-8222-222222222222',
    tenantId: '11111111-1111-4111-8111-111111111111',
    email: 'owner@khana.sa',
    name: 'Malek Elkhazendar',
    phone: '+966500000000',
    role: 'OWNER',
    isActive: true,
    onboardingCompleted: true,
    lastLoginAt: '2030-06-15T18:00:00.000Z',
    createdAt: '2030-06-01T10:00:00.000Z',
    updatedAt: '2030-06-15T18:00:00.000Z',
  },
  tenant: SWAGGER_TENANT_CONTEXT_EXAMPLE,
};

export const SWAGGER_AUTH_REFRESH_REQUEST_EXAMPLE = {
  refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh',
};

export const SWAGGER_AUTH_REFRESH_RESPONSE_EXAMPLE = {
  accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new-access',
  refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.new-refresh',
  expiresIn: 900,
};

export const SWAGGER_AUTH_MESSAGE_RESPONSE_EXAMPLE = {
  message: 'If the account exists, password reset instructions were sent.',
};

export const SWAGGER_BOOKING_FACILITY_EXAMPLE = {
  id: '33333333-3333-4333-8333-333333333333',
  name: 'Court 1',
  config: {
    pricePerHour: 180,
  },
};

export const SWAGGER_BOOKING_PRICE_BREAKDOWN_EXAMPLE = {
  basePrice: 180,
  timeMultiplier: 1,
  dayMultiplier: 1,
  durationDiscount: 0,
  subtotal: 180,
  discountAmount: 18,
  promoDiscount: 18,
  promoCode: 'SAVE10',
  taxAmount: 0,
  taxPercentage: 0,
  total: 162,
  currency: 'SAR',
};

export const SWAGGER_BOOKING_ITEM_EXAMPLE = {
  id: '44444444-4444-4444-8444-444444444444',
  bookingReference: 'BKG-20300615-001',
  facility: SWAGGER_BOOKING_FACILITY_EXAMPLE,
  startTime: '2030-06-15T18:00:00.000Z',
  endTime: '2030-06-15T19:00:00.000Z',
  customerName: 'Fahad Alharbi',
  customerPhone: '+966500000000',
  customerTags: ['vip', 'evening-league'],
  totalAmount: 162,
  currency: 'SAR',
  priceBreakdown: SWAGGER_BOOKING_PRICE_BREAKDOWN_EXAMPLE,
  holdUntil: null,
  cancellationReason: null,
  recurrenceGroupId: null,
  recurrenceInstanceNumber: null,
  recurrenceRule: null,
  status: 'CONFIRMED',
  paymentStatus: 'PENDING',
  createdAt: '2030-06-10T10:00:00.000Z',
  updatedAt: '2030-06-10T10:00:00.000Z',
};

export const SWAGGER_BOOKING_PREVIEW_REQUEST_EXAMPLE = {
  facilityId: '33333333-3333-4333-8333-333333333333',
  startTime: '2030-06-15T18:00:00.000Z',
  endTime: '2030-06-15T19:00:00.000Z',
  promoCode: 'SAVE10',
};

export const SWAGGER_BOOKING_PREVIEW_RESPONSE_EXAMPLE = {
  canBook: true,
  priceBreakdown: SWAGGER_BOOKING_PRICE_BREAKDOWN_EXAMPLE,
  promoValidation: {
    code: 'SAVE10',
    isValid: true,
    promoCodeId: '55555555-5555-4555-8555-555555555555',
    discountType: 'PERCENTAGE',
    discountValue: 10,
    discountAmount: 18,
  },
  conflict: {
    hasConflict: false,
    message: 'No booking conflicts were found for the selected slot.',
    conflictingSlots: [],
  },
  suggestedAlternatives: [],
  validationErrors: [],
};

export const SWAGGER_CREATE_BOOKING_REQUEST_EXAMPLE = {
  facilityId: '33333333-3333-4333-8333-333333333333',
  startTime: '2030-06-15T18:00:00.000Z',
  endTime: '2030-06-15T19:00:00.000Z',
  customerName: 'Fahad Alharbi',
  customerPhone: '+966500000000',
  promoCode: 'SAVE10',
};

export const SWAGGER_CREATE_RECURRING_BOOKING_REQUEST_EXAMPLE = {
  facilityId: '33333333-3333-4333-8333-333333333333',
  startTime: '2030-06-17T18:00:00.000Z',
  endTime: '2030-06-17T19:00:00.000Z',
  customerName: 'Fahad Alharbi',
  customerPhone: '+966500000000',
  recurrenceRule: {
    frequency: 'WEEKLY',
    intervalWeeks: 1,
    occurrences: 8,
  },
};

export const SWAGGER_CREATE_RECURRING_BOOKING_RESPONSE_EXAMPLE = {
  recurrenceGroupId: '66666666-6666-4666-8666-666666666666',
  createdCount: 8,
  bookings: [SWAGGER_BOOKING_ITEM_EXAMPLE],
};

export const SWAGGER_UPDATE_BOOKING_STATUS_REQUEST_EXAMPLE = {
  status: 'CANCELLED',
  paymentStatus: 'REFUNDED',
  cancellationReason: 'Customer requested cancellation',
  cancellationScope: 'SINGLE',
};

export const SWAGGER_WAITLIST_JOIN_REQUEST_EXAMPLE = {
  facilityId: '33333333-3333-4333-8333-333333333333',
  desiredTimeSlot: {
    startTime: '2030-06-15T18:00:00.000Z',
    endTime: '2030-06-15T19:00:00.000Z',
  },
};

export const SWAGGER_WAITLIST_JOIN_RESPONSE_EXAMPLE = {
  entryId: '77777777-7777-4777-8777-777777777777',
  status: 'WAITING',
  queuePosition: 1,
  desiredTimeSlot: SWAGGER_WAITLIST_JOIN_REQUEST_EXAMPLE.desiredTimeSlot,
  createdAt: '2030-06-10T10:00:00.000Z',
};

export const SWAGGER_WAITLIST_STATUS_RESPONSE_EXAMPLE = {
  isOnWaitlist: true,
  entryId: '77777777-7777-4777-8777-777777777777',
  status: 'WAITING',
  queuePosition: 1,
};

export const SWAGGER_WAITLIST_LIST_RESPONSE_EXAMPLE = {
  items: [
    {
      entryId: '77777777-7777-4777-8777-777777777777',
      facilityId: '33333333-3333-4333-8333-333333333333',
      facilityName: 'Court 1',
      userId: '22222222-2222-4222-8222-222222222222',
      userName: 'Malek Elkhazendar',
      userEmail: 'owner@khana.sa',
      desiredStartTime: '2030-06-15T18:00:00.000Z',
      desiredEndTime: '2030-06-15T19:00:00.000Z',
      status: 'WAITING',
      queuePosition: 1,
      createdAt: '2030-06-10T10:00:00.000Z',
      notifiedAt: null,
      expiredAt: null,
      fulfilledByBookingId: null,
    },
  ],
  total: 1,
  page: 1,
  pageSize: 25,
  summary: {
    waiting: 1,
    notified: 0,
    expired: 0,
    fulfilled: 0,
  },
};

export const SWAGGER_NOTIFY_WAITLIST_REQUEST_EXAMPLE = {
  facilityId: '33333333-3333-4333-8333-333333333333',
  desiredStartTime: '2030-06-15T18:00:00.000Z',
  desiredEndTime: '2030-06-15T19:00:00.000Z',
};

export const SWAGGER_NOTIFY_WAITLIST_RESPONSE_EXAMPLE = {
  notified: true,
  entryId: '77777777-7777-4777-8777-777777777777',
  status: 'NOTIFIED',
};

export const SWAGGER_FACILITY_ITEM_EXAMPLE = {
  id: '33333333-3333-4333-8333-333333333333',
  tenantId: '11111111-1111-4111-8111-111111111111',
  name: 'Court 1',
  type: 'PADEL',
  isActive: true,
  config: {
    pricePerHour: 180,
    openTime: '08:00',
    closeTime: '23:00',
  },
  createdAt: '2030-06-01T10:00:00.000Z',
  updatedAt: '2030-06-10T10:00:00.000Z',
};

export const SWAGGER_CREATE_FACILITY_REQUEST_EXAMPLE = {
  name: 'Court 1',
  type: 'PADEL',
  config: {
    pricePerHour: 180,
    openTime: '08:00',
    closeTime: '23:00',
  },
};

export const SWAGGER_UPDATE_FACILITY_REQUEST_EXAMPLE = {
  name: 'Court 1 - VIP',
  isActive: true,
  config: {
    pricePerHour: 200,
    openTime: '09:00',
    closeTime: '22:00',
  },
};

export const SWAGGER_TENANT_SETTINGS_RESPONSE_EXAMPLE = {
  timezone: 'Asia/Riyadh',
  notificationPreferences: {
    morningDigest: {
      enabled: true,
      sendTime: '08:00',
      channels: {
        whatsapp: { enabled: true },
        email: { enabled: false },
      },
    },
    weeklySummary: {
      enabled: true,
      sendTime: '09:00',
      dayOfWeek: 1,
      channels: {
        whatsapp: { enabled: false },
        email: { enabled: true },
      },
    },
    bookingCreated: {
      enabled: true,
      channels: {
        whatsapp: { enabled: true },
        email: { enabled: true },
      },
    },
    bookingCancelled: {
      enabled: true,
      channels: {
        whatsapp: { enabled: true },
        email: { enabled: true },
      },
    },
    holdExpiring: {
      enabled: true,
      leadMinutes: 15,
      channels: {
        whatsapp: { enabled: true },
        email: { enabled: false },
      },
    },
  },
  updatedAt: '2030-06-10T10:00:00.000Z',
};

export const SWAGGER_UPDATE_SETTINGS_REQUEST_EXAMPLE = {
  timezone: 'Asia/Riyadh',
  notificationPreferences:
    SWAGGER_TENANT_SETTINGS_RESPONSE_EXAMPLE.notificationPreferences,
};

export const SWAGGER_GOAL_SETTINGS_RESPONSE_EXAMPLE = {
  monthlyRevenueTarget: 25000,
  monthlyOccupancyTarget: 72.5,
  goalsNudgeShownAt: null,
  goalsNudgeDismissedAt: null,
  shouldShowNudge: false,
  updatedAt: '2030-06-10T10:00:00.000Z',
};

export const SWAGGER_UPDATE_GOALS_REQUEST_EXAMPLE = {
  monthlyRevenueTarget: 25000,
  monthlyOccupancyTarget: 72.5,
};

export const SWAGGER_ANALYTICS_SUMMARY_RESPONSE_EXAMPLE = {
  totalBookings: 120,
  totalRevenue: 18400,
  totalCancellations: 8,
  cancellationRate: 6.67,
  avgBookingValue: 153.33,
  revenueComparison: {
    currentPeriodValue: 18400,
    previousPeriodValue: 17200,
    percentageChange: 6.98,
  },
  bookingsComparison: {
    currentPeriodValue: 120,
    previousPeriodValue: 110,
    percentageChange: 9.09,
  },
  goalProgress: {
    period: {
      monthStart: '2030-06-01T00:00:00.000Z',
      monthEnd: '2030-06-30T23:59:59.999Z',
      timeZone: 'Asia/Riyadh',
    },
    revenue: {
      target: 25000,
      actual: 18400,
      pct: 73.6,
      reached: false,
    },
    occupancy: {
      target: 72.5,
      actual: 68.4,
      pct: 94.34,
      reached: false,
    },
  },
  goalMilestones: [],
};

export const SWAGGER_ANALYTICS_OCCUPANCY_RESPONSE_EXAMPLE = {
  facilities: [
    {
      facilityId: '33333333-3333-4333-8333-333333333333',
      facilityName: 'Court 1',
      occupiedMinutes: 360,
      availableMinutes: 720,
      occupancyRate: 50,
      daily: [
        {
          date: '2030-06-15',
          occupiedMinutes: 360,
          availableMinutes: 720,
          occupancyRate: 50,
          bookingCount: 6,
        },
      ],
    },
  ],
  overallOccupancyRate: 62.4,
};

export const SWAGGER_ANALYTICS_REVENUE_RESPONSE_EXAMPLE = {
  groupBy: 'day',
  trend: [
    {
      periodStart: '2030-06-15T00:00:00.000Z',
      periodLabel: 'Jun 15',
      revenue: 4200,
      bookings: 24,
    },
  ],
  facilityPerformance: [
    {
      facilityId: '33333333-3333-4333-8333-333333333333',
      facilityName: 'Court 1',
      totalBookings: 42,
      revenue: 8400,
      occupancyRate: 68.4,
      cancellationRate: 3.2,
    },
  ],
};

export const SWAGGER_ANALYTICS_PEAK_HOURS_RESPONSE_EXAMPLE = {
  peakTimeRange: '18:00-19:00',
  mostBookedFacility: 'Padel Hall',
  mostBookedCourt: 'Court 1',
};

export const SWAGGER_DASHBOARD_SNAPSHOT_RESPONSE_EXAMPLE = {
  bookingsToday: 12,
  revenueToday: 1840,
  unpaidCount: 3,
  unpaidAmount: 540,
  expiringHoldsCount: 1,
  waitlistToday: 4,
  notifiedWaitlistCount: 1,
  noShowCount: 0,
};
