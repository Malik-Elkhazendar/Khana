import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Booking, Customer, Facility, User } from '@khana/data-access';
import { BookingStatus, PaymentStatus } from '@khana/shared-dtos';
import { GetBookingService } from './get-booking.service';

describe('GetBookingService', () => {
  let service: GetBookingService;
  let bookingRepository: {
    findOne: jest.Mock;
  };
  let customerRepository: {
    findOne: jest.Mock;
  };

  const tenantId = 'tenant-1';
  const userId = 'user-1';
  const facility = {
    id: 'facility-1',
    name: 'Center Court',
    tenant: { id: tenantId },
    config: { pricePerHour: 100 },
  } as unknown as Facility;

  const buildOwnedBooking = (overrides: Partial<Booking> = {}): Booking =>
    ({
      id: 'booking-find-one-1',
      bookingReference: 'REF-FIND-ONE-1',
      facility,
      startTime: new Date('2025-03-01T09:00:00.000Z'),
      endTime: new Date('2025-03-01T10:00:00.000Z'),
      customerName: 'Layla',
      customerPhone: '0551234567',
      createdByUserId: userId,
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
      ...overrides,
    } as Booking);

  beforeEach(() => {
    bookingRepository = {
      findOne: jest.fn(),
    };
    customerRepository = {
      findOne: jest.fn().mockResolvedValue(null),
    };

    service = new GetBookingService(
      bookingRepository as never,
      customerRepository as never
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns a booking dto with customer tags for owner and manager roles', async () => {
    bookingRepository.findOne.mockResolvedValue(buildOwnedBooking());
    customerRepository.findOne.mockResolvedValue({
      id: 'customer-1',
      tags: ['VIP'],
    } as Customer);

    const result = await service.execute(
      tenantId,
      { id: userId, role: 'MANAGER' } as User,
      'booking-find-one-1'
    );

    expect(result.id).toBe('booking-find-one-1');
    expect(result.customerTags).toEqual(['VIP']);
    expect(customerRepository.findOne).toHaveBeenCalledWith({
      select: ['id', 'tags'],
      where: {
        tenantId,
        phone: '+966551234567',
      },
    });
  });

  it('forbids staff from reading bookings they did not create', async () => {
    bookingRepository.findOne.mockResolvedValue(
      buildOwnedBooking({ createdByUserId: 'another-user' })
    );

    await expect(
      service.execute(
        tenantId,
        { id: userId, role: 'STAFF' } as User,
        'booking-find-one-1'
      )
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws not found when booking does not exist', async () => {
    bookingRepository.findOne.mockResolvedValue(null);

    await expect(
      service.execute(
        tenantId,
        { id: userId, role: 'OWNER' } as User,
        'missing-booking'
      )
    ).rejects.toThrow(NotFoundException);
  });
});
