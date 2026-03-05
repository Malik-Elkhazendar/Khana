import { signal } from '@angular/core';
import { BookingListItemDto } from '@khana/shared-dtos';

type StoreMockOptions = {
  bookings?: BookingListItemDto[];
  bookingDetailsById?: Record<string, BookingListItemDto>;
  loading?: boolean;
  error?: Error | null;
  errorCode?: string | null;
  actionLoadingById?: Record<string, boolean>;
  actionErrorsById?: Record<string, string | null>;
  detailLoadingById?: Record<string, boolean>;
  detailErrorsById?: Record<string, string | null>;
};

export const createStoreMock = (options: StoreMockOptions = {}) => {
  const {
    bookings = [],
    bookingDetailsById = {},
    loading = false,
    error = null,
    errorCode = null,
    actionLoadingById = {},
    actionErrorsById = {},
    detailLoadingById = {},
    detailErrorsById = {},
  } = options;

  const mock = {
    bookings: signal<BookingListItemDto[]>(bookings),
    bookingDetailsById:
      signal<Record<string, BookingListItemDto>>(bookingDetailsById),
    loading: signal(loading),
    error: signal<Error | null>(error),
    errorCode: signal<string | null>(errorCode),
    actionLoadingById: signal<Record<string, boolean>>(actionLoadingById),
    actionErrorsById: signal<Record<string, string | null>>(actionErrorsById),
    detailLoadingById: signal<Record<string, boolean>>(detailLoadingById),
    detailErrorsById: signal<Record<string, string | null>>(detailErrorsById),
    loadBookings: jest.fn(),
    loadBookingById: jest.fn(() => Promise.resolve()),
    getBookingDetail: jest.fn(() => null),
    clearBookingDetailError: jest.fn(),
    setFacilityFilter: jest.fn(),
    clearError: jest.fn(),
    confirmBooking: jest.fn(() => Promise.resolve(true)),
    markBookingPaid: jest.fn(() => Promise.resolve(true)),
    cancelBooking: jest.fn(() => Promise.resolve(true)),
    cancelBookingWithScope: jest.fn(() => Promise.resolve(true)),
  };

  mock.getBookingDetail.mockImplementation(
    (id: string) =>
      mock.bookingDetailsById()[id] ??
      mock.bookings().find((booking) => booking.id === id) ??
      null
  );

  return mock;
};

export type BookingStoreMock = ReturnType<typeof createStoreMock>;
