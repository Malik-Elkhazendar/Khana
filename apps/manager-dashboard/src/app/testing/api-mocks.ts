import { of } from 'rxjs';
import {
  createBooking,
  createBookingPreview,
  createFacility,
} from './factories';
import {
  BookingListItemDto,
  BookingPreviewResponseDto,
  FacilityListItemDto,
} from '@khana/shared-dtos';

export type ApiServiceMock = {
  getFacilities: jest.Mock;
  getBookings: jest.Mock;
  previewBooking: jest.Mock;
  createBooking: jest.Mock;
  updateBookingStatus: jest.Mock;
};

type ApiMockOverrides = Partial<ApiServiceMock>;

export const createApiMock = (
  overrides: ApiMockOverrides = {}
): ApiServiceMock => {
  const facility = createFacility();
  const booking = createBooking();
  const preview = createBookingPreview();

  return {
    getFacilities: jest.fn(() => of<FacilityListItemDto[]>([facility])),
    getBookings: jest.fn(() => of<BookingListItemDto[]>([booking])),
    previewBooking: jest.fn(() => of<BookingPreviewResponseDto>(preview)),
    createBooking: jest.fn(() => of<BookingListItemDto>(booking)),
    updateBookingStatus: jest.fn(() => of<BookingListItemDto>(booking)),
    ...overrides,
  };
};
