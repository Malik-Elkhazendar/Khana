import {
  BookingListItemDto,
  BookingPreviewResponseDto,
  BookingStatus,
  FacilityListItemDto,
  PaymentStatus,
  PriceBreakdown,
} from '@khana/shared-dtos';

export const createFacility = (
  overrides: Partial<FacilityListItemDto> = {}
): FacilityListItemDto => ({
  id: 'facility-1',
  name: 'Court A',
  openTime: '08:00',
  closeTime: '22:00',
  slotDurationMinutes: 60,
  basePrice: 120,
  currency: 'SAR',
  ...overrides,
});

export const createBooking = (
  overrides: Partial<BookingListItemDto> = {}
): BookingListItemDto => {
  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

  return {
    id: 'booking-1',
    bookingReference: 'BK-001',
    facility: {
      id: 'facility-1',
      name: 'Court A',
      config: { pricePerHour: 120 },
    },
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    customerName: 'Test Customer',
    customerPhone: '+966500000000',
    totalAmount: 100,
    currency: 'SAR',
    holdUntil: null,
    cancellationReason: null,
    status: BookingStatus.CONFIRMED,
    paymentStatus: PaymentStatus.PENDING,
    createdAt: startTime.toISOString(),
    updatedAt: startTime.toISOString(),
    ...overrides,
  };
};

export const createPriceBreakdown = (
  overrides: Partial<PriceBreakdown> = {}
): PriceBreakdown => ({
  basePrice: 100,
  timeMultiplier: 1,
  dayMultiplier: 1,
  durationDiscount: 0,
  subtotal: 100,
  discountAmount: 0,
  total: 100,
  currency: 'SAR',
  ...overrides,
});

export const createBookingPreview = (
  overrides: Partial<BookingPreviewResponseDto> = {}
): BookingPreviewResponseDto => ({
  canBook: true,
  priceBreakdown: createPriceBreakdown(),
  ...overrides,
});
