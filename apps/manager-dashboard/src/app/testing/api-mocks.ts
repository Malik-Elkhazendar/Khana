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
  FacilityManagementItemDto,
} from '@khana/shared-dtos';

export type ApiServiceMock = {
  getFacilities: jest.Mock;
  getManagedFacilities: jest.Mock;
  getManagedFacilityById: jest.Mock;
  createFacility: jest.Mock;
  updateFacility: jest.Mock;
  deactivateFacility: jest.Mock;
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

  return {
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
    getBookings: jest.fn(() => of<BookingListItemDto[]>([booking])),
    previewBooking: jest.fn(() => of<BookingPreviewResponseDto>(preview)),
    createBooking: jest.fn(() => of<BookingListItemDto>(booking)),
    updateBookingStatus: jest.fn(() => of<BookingListItemDto>(booking)),
    ...overrides,
  };
};
