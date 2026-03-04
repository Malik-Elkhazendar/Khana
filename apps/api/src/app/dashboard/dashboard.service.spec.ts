import {
  BookingStatus,
  PaymentStatus,
  WaitlistStatus,
} from '@khana/shared-dtos';
import { DashboardService } from './dashboard.service';

type QueryBuilderMock = {
  select: jest.Mock;
  innerJoin: jest.Mock;
  where: jest.Mock;
  andWhere: jest.Mock;
  getRawOne: jest.Mock;
};

const createQueryBuilderMock = (
  raw: Record<string, unknown>
): QueryBuilderMock => {
  const builder: QueryBuilderMock = {
    select: jest.fn(),
    innerJoin: jest.fn(),
    where: jest.fn(),
    andWhere: jest.fn(),
    getRawOne: jest.fn().mockResolvedValue(raw),
  };

  builder.select.mockReturnValue(builder);
  builder.innerJoin.mockReturnValue(builder);
  builder.where.mockReturnValue(builder);
  builder.andWhere.mockReturnValue(builder);

  return builder;
};

describe('DashboardService', () => {
  let service: DashboardService;
  let bookingRepository: { createQueryBuilder: jest.Mock };
  let waitlistRepository: { createQueryBuilder: jest.Mock };

  const tenantId = 'tenant-1';

  beforeEach(() => {
    bookingRepository = {
      createQueryBuilder: jest.fn(),
    };
    waitlistRepository = {
      createQueryBuilder: jest.fn(),
    };

    service = new DashboardService(
      bookingRepository as never,
      waitlistRepository as never
    );
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('coerces raw string counts/sums into numbers', async () => {
    const bookingBuilders = [
      createQueryBuilderMock({ count: '7' }),
      createQueryBuilderMock({ sum: '1200.50' }),
      createQueryBuilderMock({ count: '2' }),
      createQueryBuilderMock({ sum: '300.25' }),
      createQueryBuilderMock({ count: '1' }),
      createQueryBuilderMock({ count: '4' }),
    ];
    const waitlistBuilders = [
      createQueryBuilderMock({ count: '5' }),
      createQueryBuilderMock({ count: '3' }),
    ];

    bookingRepository.createQueryBuilder.mockImplementation(() => {
      const builder = bookingBuilders.shift();
      if (!builder) {
        throw new Error('Missing booking query builder mock');
      }
      return builder;
    });
    waitlistRepository.createQueryBuilder.mockImplementation(() => {
      const builder = waitlistBuilders.shift();
      if (!builder) {
        throw new Error('Missing waitlist query builder mock');
      }
      return builder;
    });

    const result = await service.getTodaySnapshot(tenantId);

    expect(result).toEqual({
      bookingsToday: 7,
      revenueToday: 1200.5,
      unpaidCount: 2,
      unpaidAmount: 300.25,
      expiringHoldsCount: 1,
      waitlistToday: 5,
      notifiedWaitlistCount: 3,
      noShowCount: 4,
    });
  });

  it('defaults sum values to 0 when raw sums are null', async () => {
    const bookingBuilders = [
      createQueryBuilderMock({ count: '0' }),
      createQueryBuilderMock({ sum: null }),
      createQueryBuilderMock({ count: '0' }),
      createQueryBuilderMock({ sum: null }),
      createQueryBuilderMock({ count: '0' }),
      createQueryBuilderMock({ count: '0' }),
    ];
    const waitlistBuilders = [
      createQueryBuilderMock({ count: '0' }),
      createQueryBuilderMock({ count: '0' }),
    ];

    bookingRepository.createQueryBuilder.mockImplementation(() => {
      const builder = bookingBuilders.shift();
      if (!builder) {
        throw new Error('Missing booking query builder mock');
      }
      return builder;
    });
    waitlistRepository.createQueryBuilder.mockImplementation(() => {
      const builder = waitlistBuilders.shift();
      if (!builder) {
        throw new Error('Missing waitlist query builder mock');
      }
      return builder;
    });

    const result = await service.getTodaySnapshot(tenantId);

    expect(result.revenueToday).toBe(0);
    expect(result.unpaidAmount).toBe(0);
  });

  it('applies tenant and facility filters to all queries', async () => {
    const bookingBuilders = Array.from({ length: 6 }, () =>
      createQueryBuilderMock({ count: '0', sum: '0' })
    );
    const waitlistBuilders = Array.from({ length: 2 }, () =>
      createQueryBuilderMock({ count: '0' })
    );

    bookingRepository.createQueryBuilder.mockImplementation(() => {
      const builder = bookingBuilders.shift();
      if (!builder) {
        throw new Error('Missing booking query builder mock');
      }
      return builder;
    });
    waitlistRepository.createQueryBuilder.mockImplementation(() => {
      const builder = waitlistBuilders.shift();
      if (!builder) {
        throw new Error('Missing waitlist query builder mock');
      }
      return builder;
    });

    await service.getTodaySnapshot(tenantId, 'facility-1');

    for (const builder of [...bookingBuilders, ...waitlistBuilders]) {
      expect(builder).toBeUndefined();
    }

    const bookingCalls = bookingRepository.createQueryBuilder.mock.results
      .map((entry) => entry.value as QueryBuilderMock)
      .filter(Boolean);
    const waitlistCalls = waitlistRepository.createQueryBuilder.mock.results
      .map((entry) => entry.value as QueryBuilderMock)
      .filter(Boolean);

    for (const builder of bookingCalls) {
      expect(builder.where).toHaveBeenCalledWith(
        'facility.tenantId = :tenantId',
        {
          tenantId,
        }
      );
      expect(builder.andWhere).toHaveBeenCalledWith(
        'facility.id = :facilityId',
        {
          facilityId: 'facility-1',
        }
      );
    }

    for (const builder of waitlistCalls) {
      expect(builder.where).toHaveBeenCalledWith(
        'facility.tenantId = :tenantId',
        {
          tenantId,
        }
      );
      expect(builder.andWhere).toHaveBeenCalledWith(
        'entry.facilityId = :facilityId',
        {
          facilityId: 'facility-1',
        }
      );
    }
  });

  it('uses status filters for each metric and creates 8 independent queries', async () => {
    const bookingBuilders = [
      createQueryBuilderMock({ count: '0' }),
      createQueryBuilderMock({ sum: '0' }),
      createQueryBuilderMock({ count: '0' }),
      createQueryBuilderMock({ sum: '0' }),
      createQueryBuilderMock({ count: '0' }),
      createQueryBuilderMock({ count: '0' }),
    ];
    const waitlistBuilders = [
      createQueryBuilderMock({ count: '0' }),
      createQueryBuilderMock({ count: '0' }),
    ];

    bookingRepository.createQueryBuilder.mockImplementation(() => {
      const builder = bookingBuilders.shift();
      if (!builder) {
        throw new Error('Missing booking query builder mock');
      }
      return builder;
    });
    waitlistRepository.createQueryBuilder.mockImplementation(() => {
      const builder = waitlistBuilders.shift();
      if (!builder) {
        throw new Error('Missing waitlist query builder mock');
      }
      return builder;
    });

    await service.getTodaySnapshot(tenantId);

    const createdBookingBuilders =
      bookingRepository.createQueryBuilder.mock.results.map(
        (entry) => entry.value as QueryBuilderMock
      );
    const createdWaitlistBuilders =
      waitlistRepository.createQueryBuilder.mock.results.map(
        (entry) => entry.value as QueryBuilderMock
      );

    expect(bookingRepository.createQueryBuilder).toHaveBeenCalledTimes(6);
    expect(waitlistRepository.createQueryBuilder).toHaveBeenCalledTimes(2);

    const bookingsTodayBuilder = createdBookingBuilders[0];
    expect(bookingsTodayBuilder.andWhere).toHaveBeenCalledWith(
      'booking.status IN (:...activeStatuses)',
      {
        activeStatuses: [
          BookingStatus.CONFIRMED,
          BookingStatus.COMPLETED,
          BookingStatus.NO_SHOW,
        ],
      }
    );

    const revenueBuilder = createdBookingBuilders[1];
    expect(revenueBuilder.andWhere).toHaveBeenCalledWith(
      'booking.status IN (:...revenueStatuses)',
      {
        revenueStatuses: [BookingStatus.CONFIRMED, BookingStatus.COMPLETED],
      }
    );

    const unpaidCountBuilder = createdBookingBuilders[2];
    expect(unpaidCountBuilder.andWhere).toHaveBeenCalledWith(
      'booking.status = :confirmedStatus',
      {
        confirmedStatus: BookingStatus.CONFIRMED,
      }
    );
    expect(unpaidCountBuilder.andWhere).toHaveBeenCalledWith(
      'booking.paymentStatus = :pendingPaymentStatus',
      {
        pendingPaymentStatus: PaymentStatus.PENDING,
      }
    );

    const expiringBuilder = createdBookingBuilders[4];
    expect(expiringBuilder.andWhere).toHaveBeenCalledWith(
      'booking.status = :pendingStatus',
      {
        pendingStatus: BookingStatus.PENDING,
      }
    );

    const noShowBuilder = createdBookingBuilders[5];
    expect(noShowBuilder.andWhere).toHaveBeenCalledWith(
      'booking.status = :noShowStatus',
      {
        noShowStatus: BookingStatus.NO_SHOW,
      }
    );

    const waitingBuilder = createdWaitlistBuilders[0];
    expect(waitingBuilder.andWhere).toHaveBeenCalledWith(
      'entry.status = :waitingStatus',
      {
        waitingStatus: WaitlistStatus.WAITING,
      }
    );

    const notifiedBuilder = createdWaitlistBuilders[1];
    expect(notifiedBuilder.andWhere).toHaveBeenCalledWith(
      'entry.status = :notifiedStatus',
      {
        notifiedStatus: WaitlistStatus.NOTIFIED,
      }
    );
    expect(notifiedBuilder.andWhere).toHaveBeenCalledWith(
      'entry.fulfilledByBookingId IS NULL'
    );
  });

  it('builds expiring hold window using now and now + 30 minutes', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-04T05:10:00.000Z'));

    const bookingBuilders = [
      createQueryBuilderMock({ count: '0' }),
      createQueryBuilderMock({ sum: '0' }),
      createQueryBuilderMock({ count: '0' }),
      createQueryBuilderMock({ sum: '0' }),
      createQueryBuilderMock({ count: '2' }),
      createQueryBuilderMock({ count: '0' }),
    ];
    const waitlistBuilders = [
      createQueryBuilderMock({ count: '0' }),
      createQueryBuilderMock({ count: '0' }),
    ];

    bookingRepository.createQueryBuilder.mockImplementation(() => {
      const builder = bookingBuilders.shift();
      if (!builder) {
        throw new Error('Missing booking query builder mock');
      }
      return builder;
    });
    waitlistRepository.createQueryBuilder.mockImplementation(() => {
      const builder = waitlistBuilders.shift();
      if (!builder) {
        throw new Error('Missing waitlist query builder mock');
      }
      return builder;
    });

    await service.getTodaySnapshot(tenantId);

    const expiringBuilder = bookingRepository.createQueryBuilder.mock.results[4]
      ?.value as QueryBuilderMock;
    const holdWindowCall = expiringBuilder.andWhere.mock.calls.find(
      (call) => call[0] === 'booking.holdUntil BETWEEN :now AND :holdWindowEnd'
    );

    expect(holdWindowCall).toBeDefined();
    expect(holdWindowCall?.[1]).toEqual({
      now: new Date('2026-03-04T05:10:00.000Z'),
      holdWindowEnd: new Date('2026-03-04T05:40:00.000Z'),
    });
  });
});
