import { signal } from '@angular/core';
import { BookingListItemDto } from '@khana/shared-dtos';

type StoreMockOptions = {
  bookings?: BookingListItemDto[];
  loading?: boolean;
  error?: Error | null;
  errorCode?: string | null;
  actionLoadingById?: Record<string, boolean>;
  actionErrorsById?: Record<string, string | null>;
};

export const createStoreMock = (options: StoreMockOptions = {}) => {
  const {
    bookings = [],
    loading = false,
    error = null,
    errorCode = null,
    actionLoadingById = {},
    actionErrorsById = {},
  } = options;

  return {
    bookings: signal<BookingListItemDto[]>(bookings),
    loading: signal(loading),
    error: signal<Error | null>(error),
    errorCode: signal<string | null>(errorCode),
    actionLoadingById: signal<Record<string, boolean>>(actionLoadingById),
    actionErrorsById: signal<Record<string, string | null>>(actionErrorsById),
    loadBookings: jest.fn(),
    setFacilityFilter: jest.fn(),
    clearError: jest.fn(),
    confirmBooking: jest.fn(() => Promise.resolve(true)),
    markBookingPaid: jest.fn(() => Promise.resolve(true)),
    cancelBooking: jest.fn(() => Promise.resolve(true)),
  };
};

export type BookingStoreMock = ReturnType<typeof createStoreMock>;
