import { Booking, User } from '@khana/data-access';
import {
  BookingListItemDto,
  CreateRecurringBookingResponseDto,
} from '@khana/shared-dtos';
import {
  BookingPreviewRequestDto,
  BookingPreviewResponseDto,
  CreateBookingDto,
  CreateRecurringBookingDto,
  UpdateBookingStatusDto,
} from './dto';
import { BookingsService } from './bookings.service';

describe('BookingsService facade', () => {
  let service: BookingsService;

  const listBookingsService = { execute: jest.fn() };
  const getBookingService = { execute: jest.fn() };
  const expirePendingHoldsService = { execute: jest.fn() };
  const previewBookingService = { execute: jest.fn() };
  const listBookingFacilitiesService = { execute: jest.fn() };
  const createBookingService = { execute: jest.fn() };
  const createRecurringBookingsService = { execute: jest.fn() };
  const updateBookingStatusService = { execute: jest.fn() };

  beforeEach(() => {
    service = new BookingsService(
      listBookingsService as never,
      getBookingService as never,
      expirePendingHoldsService as never,
      previewBookingService as never,
      listBookingFacilitiesService as never,
      createBookingService as never,
      createRecurringBookingsService as never,
      updateBookingStatusService as never
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('delegates findAll', async () => {
    const result = [{ id: 'booking-1' }] as BookingListItemDto[];
    const user = { id: 'user-1' } as User;
    listBookingsService.execute.mockResolvedValue(result);

    await expect(service.findAll('tenant-1', user, 'facility-1')).resolves.toBe(
      result
    );
    expect(listBookingsService.execute).toHaveBeenCalledWith(
      'tenant-1',
      user,
      'facility-1'
    );
  });

  it('delegates findOne', async () => {
    const result = { id: 'booking-1' } as BookingListItemDto;
    const user = { id: 'user-1' } as User;
    getBookingService.execute.mockResolvedValue(result);

    await expect(service.findOne('tenant-1', user, 'booking-1')).resolves.toBe(
      result
    );
    expect(getBookingService.execute).toHaveBeenCalledWith(
      'tenant-1',
      user,
      'booking-1'
    );
  });

  it('delegates expirePendingHolds', async () => {
    expirePendingHoldsService.execute.mockResolvedValue(2);

    await expect(
      service.expirePendingHolds(new Date('2025-03-10T09:01:00.000Z'))
    ).resolves.toBe(2);
    expect(expirePendingHoldsService.execute).toHaveBeenCalledWith(
      new Date('2025-03-10T09:01:00.000Z')
    );
  });

  it('delegates previewBooking', async () => {
    const dto = {
      facilityId: 'facility-1',
      startTime: '2025-03-10T09:00:00.000Z',
      endTime: '2025-03-10T10:00:00.000Z',
    } as BookingPreviewRequestDto;
    const result = { canBook: true } as BookingPreviewResponseDto;
    previewBookingService.execute.mockResolvedValue(result);

    await expect(service.previewBooking(dto, 'tenant-1')).resolves.toBe(result);
    expect(previewBookingService.execute).toHaveBeenCalledWith(dto, 'tenant-1');
  });

  it('delegates getFacilities', async () => {
    const result = [{ id: 'facility-1' }];
    listBookingFacilitiesService.execute.mockResolvedValue(result);

    await expect(service.getFacilities('tenant-1')).resolves.toBe(result);
    expect(listBookingFacilitiesService.execute).toHaveBeenCalledWith(
      'tenant-1'
    );
  });

  it('delegates createBooking', async () => {
    const dto = { facilityId: 'facility-1' } as CreateBookingDto;
    const result = { id: 'booking-1' } as Booking;
    createBookingService.execute.mockResolvedValue(result);

    await expect(
      service.createBooking(dto, 'tenant-1', 'user-1', 'OWNER')
    ).resolves.toBe(result);
    expect(createBookingService.execute).toHaveBeenCalledWith(
      dto,
      'tenant-1',
      'user-1',
      'OWNER'
    );
  });

  it('delegates createRecurringBookings', async () => {
    const dto = { facilityId: 'facility-1' } as CreateRecurringBookingDto;
    const result = {
      recurrenceGroupId: 'group-1',
      createdCount: 1,
      bookings: [],
    } as CreateRecurringBookingResponseDto;
    createRecurringBookingsService.execute.mockResolvedValue(result);

    await expect(
      service.createRecurringBookings(dto, 'tenant-1', 'user-1', 'OWNER')
    ).resolves.toBe(result);
    expect(createRecurringBookingsService.execute).toHaveBeenCalledWith(
      dto,
      'tenant-1',
      'user-1',
      'OWNER'
    );
  });

  it('delegates updateStatus', async () => {
    const dto = { status: 'CANCELLED' } as UpdateBookingStatusDto;
    const user = { id: 'user-1' } as User;
    const result = { id: 'booking-1' } as Booking;
    updateBookingStatusService.execute.mockResolvedValue(result);

    await expect(
      service.updateStatus('booking-1', dto, 'tenant-1', user)
    ).resolves.toBe(result);
    expect(updateBookingStatusService.execute).toHaveBeenCalledWith(
      'booking-1',
      dto,
      'tenant-1',
      user
    );
  });
});
