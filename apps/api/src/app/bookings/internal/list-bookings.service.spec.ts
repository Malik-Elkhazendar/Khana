import { ForbiddenException } from '@nestjs/common';
import { Booking, Customer, Facility, User } from '@khana/data-access';
import { BookingStatus, PaymentStatus } from '@khana/shared-dtos';
import { ListBookingsService } from './list-bookings.service';

describe('ListBookingsService', () => {
  let service: ListBookingsService;
  let bookingRepository: {
    createQueryBuilder: jest.Mock;
  };
  let customerRepository: {
    find: jest.Mock;
  };
  let facilityRepository: {
    findOne: jest.Mock;
  };

  const tenantId = 'tenant-1';
  const activeFacility = {
    id: 'facility-1',
    name: 'Center Court',
    tenant: { id: tenantId },
    config: { pricePerHour: 100 },
  } as unknown as Facility;

  beforeEach(() => {
    bookingRepository = {
      createQueryBuilder: jest.fn(),
    };
    customerRepository = {
      find: jest.fn().mockResolvedValue([]),
    };
    facilityRepository = {
      findOne: jest.fn().mockResolvedValue(activeFacility),
    };

    service = new ListBookingsService(
      bookingRepository as never,
      customerRepository as never,
      facilityRepository as never
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('maps customer tags onto booking list items using normalized phone', async () => {
    const booking = {
      id: 'booking-1',
      bookingReference: 'REF-1',
      facility: activeFacility,
      startTime: new Date('2025-03-01T09:00:00.000Z'),
      endTime: new Date('2025-03-01T10:00:00.000Z'),
      customerName: 'Layla',
      customerPhone: '0551234567',
      totalAmount: 120,
      currency: 'SAR',
      status: BookingStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PENDING,
      createdAt: new Date('2025-03-01T08:00:00.000Z'),
      updatedAt: new Date('2025-03-01T08:00:00.000Z'),
      holdUntil: null,
      cancellationReason: null,
      recurrenceGroupId: null,
      recurrenceInstanceNumber: null,
      recurrenceRule: null,
    } as Booking;

    const listQuery = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([booking]),
    };

    bookingRepository.createQueryBuilder.mockReturnValueOnce(listQuery);
    customerRepository.find.mockResolvedValueOnce([
      {
        phone: '+966551234567',
        tags: ['VIP', 'Corporate'],
      } as Customer,
    ]);

    const result = await service.execute(tenantId, {
      id: 'user-1',
      role: 'MANAGER',
    } as User);

    expect(result).toHaveLength(1);
    expect(result[0]?.customerTags).toEqual(['VIP', 'Corporate']);
  });

  it('restricts staff listings to their own bookings', async () => {
    const listQuery = {
      innerJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    bookingRepository.createQueryBuilder.mockReturnValueOnce(listQuery);

    await service.execute(
      tenantId,
      { id: 'staff-1', role: 'STAFF' } as User,
      'facility-1'
    );

    expect(listQuery.andWhere).toHaveBeenCalledWith(
      'booking.createdByUserId = :actorUserId',
      { actorUserId: 'staff-1' }
    );
  });

  it('rejects cross-tenant facility filters before querying bookings', async () => {
    facilityRepository.findOne.mockResolvedValueOnce({
      ...activeFacility,
      tenant: { id: 'other-tenant' },
    });

    await expect(
      service.execute(
        tenantId,
        { id: 'user-1', role: 'MANAGER' } as User,
        'facility-1'
      )
    ).rejects.toThrow(ForbiddenException);
    expect(bookingRepository.createQueryBuilder).not.toHaveBeenCalled();
  });
});
