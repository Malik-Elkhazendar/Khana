import { PATH_METADATA } from '@nestjs/common/constants';
import { User } from '@khana/data-access';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

describe('BookingsController', () => {
  let controller: BookingsController;
  let service: jest.Mocked<BookingsService>;

  beforeEach(() => {
    service = {
      findAll: jest.fn(),
      createBooking: jest.fn(),
      createRecurringBookings: jest.fn(),
      updateStatus: jest.fn(),
      previewBooking: jest.fn(),
      getFacilities: jest.fn(),
      findOne: jest.fn(),
    } as unknown as jest.Mocked<BookingsService>;

    controller = new BookingsController(service);
  });

  it('uses status update route with UUID validation handled by pipe', () => {
    const routePath = Reflect.getMetadata(
      PATH_METADATA,
      controller.updateStatus
    );
    expect(routePath).toBe(':id/status');
  });

  it('uses booking lookup route with UUID validation handled by pipe', () => {
    const routePath = Reflect.getMetadata(PATH_METADATA, controller.findOne);
    expect(routePath).toBe(':id');
  });

  it('delegates findOne to service', async () => {
    const bookingId = '6f97cd3a-9f4f-4b13-9f4e-a084b9f99d2c';
    const tenantId = 'tenant-1';
    const user = { id: 'user-1', role: 'OWNER' } as User;
    service.findOne.mockResolvedValue({ id: bookingId } as never);

    await controller.findOne(bookingId, tenantId, user);

    expect(service.findOne).toHaveBeenCalledWith(tenantId, user, bookingId);
  });
});
